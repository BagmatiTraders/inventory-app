import { getDb } from './database';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export interface StoreSaleItem {
    id: string;
    sale_id: string;
    product_id?: string;
    product_name: string;
    product_code?: string;
    qty: number;
    amount: number;
}

export interface StoreSale {
    id: string;
    sale_date: string;
    customer_name: string;
    payment_type: string;
    remarks?: string;
    total_amount: number;
    items: StoreSaleItem[];
    created_at: string;
    updated_at: string;
    sync_status: 'synced' | 'pending';
}

export const StoreSalesRepo = {
    async getRecentSales(limit = 5): Promise<StoreSale[]> {
        const db = await getDb();
        const sales = await db.getAllAsync<any>(`
            SELECT * FROM store_sales 
            ORDER BY sale_date DESC, created_at DESC 
            LIMIT ?
        `, [limit]);

        const result: StoreSale[] = [];
        for (const sale of sales) {
            const items = await db.getAllAsync<StoreSaleItem>(`
                SELECT * FROM store_sales_items WHERE sale_id = ?
            `, [sale.id]);
            result.push({ ...sale, items });
        }
        return result;
    },

    async getAllSales(): Promise<StoreSale[]> {
        const db = await getDb();
        const sales = await db.getAllAsync<any>(`
            SELECT * FROM store_sales 
            ORDER BY sale_date DESC, created_at DESC
        `);

        const result: StoreSale[] = [];
        for (const sale of sales) {
            const items = await db.getAllAsync<StoreSaleItem>(`
                SELECT * FROM store_sales_items WHERE sale_id = ?
            `, [sale.id]);
            result.push({ ...sale, items });
        }
        return result;
    },

    async addStoreSale(sale: Omit<StoreSale, 'id' | 'created_at' | 'updated_at' | 'sync_status' | 'items'> & { items: Omit<StoreSaleItem, 'id' | 'sale_id'>[] }) {
        const db = await getDb();
        const saleId = uuidv4();
        const now = new Date().toISOString();

        await db.withTransactionAsync(async () => {
            await db.runAsync(
                `INSERT INTO store_sales (id, sale_date, customer_name, payment_type, remarks, total_amount, created_at, updated_at, sync_status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [saleId, sale.sale_date, sale.customer_name || 'User', sale.payment_type || 'Cash', sale.remarks || '', sale.total_amount, now, now, 'pending']
            );

            for (const item of sale.items) {
                const itemId = uuidv4();
                await db.runAsync(
                    `INSERT INTO store_sales_items (id, sale_id, product_id, product_name, product_code, qty, amount) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [itemId, saleId, item.product_id || null, item.product_name, item.product_code || null, item.qty, item.amount]
                );
            }
        });

        // Sync to Supabase
        try {
            const { data: supaUser } = await supabase.auth.getUser();
            if (supaUser.user) {
                const { error: saleError } = await supabase
                    .from('store_sales')
                    .insert({
                        id: saleId,
                        sale_date: sale.sale_date,
                        customer_name: sale.customer_name || 'User',
                        payment_type: sale.payment_type || 'Cash',
                        remarks: sale.remarks,
                        total_amount: sale.total_amount,
                        created_by: supaUser.user.id,
                        updated_by: supaUser.user.id
                    });

                if (!saleError) {
                    const itemsToInsert = sale.items.map(item => ({
                        sale_id: saleId,
                        product_id: item.product_id || null,
                        product_name: item.product_name,
                        product_code: item.product_code,
                        qty: item.qty,
                        amount: item.amount
                    }));

                    const { error: itemsError } = await supabase
                        .from('store_sales_items')
                        .insert(itemsToInsert);

                    if (!itemsError) {
                        await db.runAsync('UPDATE store_sales SET sync_status = ? WHERE id = ?', ['synced', saleId]);
                    }
                }
            }
        } catch (error) {
            console.error('Error syncing store sale:', error);
        }

        return saleId;
    },

    async syncFromRemote() {
        const db = await getDb();
        try {
            const { data: remoteSales, error: salesError } = await supabase
                .from('store_sales')
                .select('*, items:store_sales_items(*)')
                .eq('deleted', false)
                .order('sale_date', { ascending: false })
                .limit(100);

            if (salesError) throw salesError;

            if (remoteSales) {
                await db.withTransactionAsync(async () => {
                    for (const sale of remoteSales) {
                        await db.runAsync(
                            `INSERT OR REPLACE INTO store_sales (id, sale_date, customer_name, payment_type, remarks, total_amount, created_at, updated_at, sync_status) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [sale.id, sale.sale_date, sale.customer_name, sale.payment_type, sale.remarks, sale.total_amount, sale.created_at, sale.updated_at, 'synced']
                        );

                        // Delete local items for this sale and re-insert from remote
                        await db.runAsync('DELETE FROM store_sales_items WHERE sale_id = ?', [sale.id]);
                        if (sale.items) {
                            for (const item of sale.items) {
                                await db.runAsync(
                                    `INSERT INTO store_sales_items (id, sale_id, product_id, product_name, product_code, qty, amount) 
                                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                    [item.id, sale.id, item.product_id, item.product_name, item.product_code, item.qty, item.amount]
                                );
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Failed to sync store sales from remote:', error);
        }
    }
};
