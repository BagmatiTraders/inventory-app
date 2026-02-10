import { getDb } from './database';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export interface OpeningStock {
    id: string;
    date: string;
    location: string;
    product_id: string;
    quantity: number;
    remarks?: string;
    created_at: string;
    updated_at: string;
    product_name?: string;
    sync_status?: 'pending' | 'synced';
}

export interface ManualAdjustment {
    id: string;
    date: string;
    location: string;
    product_id: string;
    quantity: number;
    reason?: string;
    created_at: string;
    updated_at: string;
    product_name?: string;
    sync_status?: 'pending' | 'synced';
}

export const StockRepo = {
    // --- Opening Stock ---

    getOpeningStocks: async () => {
        const db = await getDb();
        const rows = await db.getAllAsync<any>(`
      SELECT os.*, p.name as product_name 
      FROM opening_stocks os
      LEFT JOIN products p ON os.product_id = p.id
      ORDER BY os.date DESC, os.created_at DESC
    `);
        return rows as OpeningStock[];
    },

    addOpeningStock: async (data: Omit<OpeningStock, 'id' | 'created_at' | 'updated_at' | 'sync_status'>) => {
        const db = await getDb();
        const id = uuidv4();
        const now = new Date().toISOString();

        await db.runAsync(
            `INSERT INTO opening_stocks (id, date, location, product_id, quantity, remarks, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, data.date, data.location, data.product_id, data.quantity, data.remarks || '', now, now, 'pending']
        );

        // Sync to Supabase
        try {
            const { error } = await supabase
                .from('opening_stocks')
                .insert({
                    id,
                    date: data.date,
                    location: data.location,
                    product_id: data.product_id,
                    quantity: data.quantity,
                    remarks: data.remarks
                });

            if (!error) {
                await db.runAsync('UPDATE opening_stocks SET sync_status = ? WHERE id = ?', ['synced', id]);
            }
        } catch (error) {
            console.error('Error syncing opening stock:', error);
        }

        return id;
    },

    // --- Manual Adjustment ---

    getManualAdjustments: async () => {
        const db = await getDb();
        const rows = await db.getAllAsync<any>(`
      SELECT ma.*, p.name as product_name 
      FROM manual_adjustments ma
      LEFT JOIN products p ON ma.product_id = p.id
      ORDER BY ma.date DESC, ma.created_at DESC
    `);
        return rows as ManualAdjustment[];
    },

    addManualAdjustment: async (data: Omit<ManualAdjustment, 'id' | 'created_at' | 'updated_at' | 'sync_status'>) => {
        const db = await getDb();
        const id = uuidv4();
        const now = new Date().toISOString();

        await db.runAsync(
            `INSERT INTO manual_adjustments (id, date, location, product_id, quantity, reason, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, data.date, data.location, data.product_id, data.quantity, data.reason || '', now, now, 'pending']
        );

        // Sync to Supabase
        try {
            const { error } = await supabase
                .from('manual_adjustments')
                .insert({
                    id,
                    date: data.date,
                    location: data.location,
                    product_id: data.product_id,
                    quantity: data.quantity,
                    reason: data.reason
                });

            if (!error) {
                await db.runAsync('UPDATE manual_adjustments SET sync_status = ? WHERE id = ?', ['synced', id]);
            }
        } catch (error) {
            console.error('Error syncing manual adjustment:', error);
        }

        return id;
    },

    // --- Sync from Remote ---

    syncFromRemote: async () => {
        const db = await getDb();

        // Sync Opening Stocks
        const { data: remoteOS, error: osError } = await supabase
            .from('opening_stocks')
            .select('*');

        if (!osError && remoteOS) {
            for (const item of remoteOS) {
                await db.runAsync(
                    `INSERT OR REPLACE INTO opening_stocks (id, date, location, product_id, quantity, remarks, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [item.id, item.date, item.location, item.product_id, item.quantity, item.remarks, item.created_at, item.updated_at, 'synced']
                );
            }
        }

        // Sync Manual Adjustments
        const { data: remoteMA, error: maError } = await supabase
            .from('manual_adjustments')
            .select('*');

        if (!maError && remoteMA) {
            for (const item of remoteMA) {
                await db.runAsync(
                    `INSERT OR REPLACE INTO manual_adjustments (id, date, location, product_id, quantity, reason, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [item.id, item.date, item.location, item.product_id, item.quantity, item.reason, item.created_at, item.updated_at, 'synced']
                );
            }
        }
    },

    getAutoAdjustments: async () => {
        try {
            const PRODUCT_FIELDS = `
                id,
                product_name,
                product_type,
                product_combos!product_combos_parent_product_id_fkey (
                    quantity,
                    child:products!product_combos_child_product_id_fkey (
                        product_name
                    )
                )
            `;
            const PRODUCT_SELECT = `product:products!inner (${PRODUCT_FIELDS})`;

            const { data: darazItems, error: darazError } = await supabase
                .from('daraz_order_items')
                .select(`
                    id,
                    quantity,
                    order:daraz_orders (
                        id,
                        order_date,
                        order_status
                    ),
                    ${PRODUCT_SELECT}
                `)
                .in('product.product_type', ['combo', 'variation'])
                .order('created_at', { ascending: false })
                .limit(50);

            const { data: marketplaceItems, error: marketplaceError } = await supabase
                .from('marketplace_order_items')
                .select(`
                    id,
                    quantity,
                    order:marketplace_orders (
                        id,
                        order_date,
                        order_status
                    ),
                    ${PRODUCT_SELECT}
                `)
                .in('product.product_type', ['combo', 'variation'])
                .order('created_at', { ascending: false })
                .limit(50);

            const { data: storeItemsRaw, error: storeError } = await supabase
                .from('store_sales_items')
                .select(`
                    id,
                    qty,
                    product_id,
                    sale:store_sales (
                        id,
                        sale_date
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            let storeItemsProcessed: any[] = [];
            if (storeItemsRaw && storeItemsRaw.length > 0) {
                const productIds = Array.from(new Set(storeItemsRaw.map(i => i.product_id).filter(Boolean)));
                if (productIds.length > 0) {
                    const { data: products } = await supabase
                        .from('products')
                        .select(PRODUCT_FIELDS)
                        .in('id', productIds)
                        .in('product_type', ['combo', 'variation']);

                    const productMap = new Map((products || []).map(p => [p.id, p]));
                    storeItemsProcessed = storeItemsRaw.map((item: any) => ({
                        ...item,
                        product: productMap.get(item.product_id)
                    })).filter(item => item.product);
                }
            }

            const groupedResults: any[] = [];

            const processItems = (items: any[], source: string) => {
                if (!items) return;
                items.forEach(item => {
                    const isStoreSale = source === 'Store Sales';
                    const order = isStoreSale ? item.sale : item.order;
                    if (!order) return;

                    const product = item.product;
                    const comboComponents = product.product_combos || [];
                    const salesQty = isStoreSale ? item.qty : item.quantity;
                    let status = isStoreSale ? 'Delivered' : order.order_status || 'Pending';

                    let stockEffect: 'positive' | 'negative' | 'neutral' = 'neutral';
                    if (['Shipped', 'Delivered', 'Returning to Seller', 'Completed'].includes(status)) {
                        stockEffect = 'negative';
                    } else if (['Fail Delivered', 'Failed Delivery', 'Customer Return', 'Returned', 'Returned Delivered'].includes(status)) {
                        stockEffect = 'positive';
                    }

                    const components = comboComponents.map((comp: any) => {
                        const totalQty = salesQty * comp.quantity;
                        let stockDisplay = '0';
                        if (stockEffect === 'negative') stockDisplay = `-${totalQty}`;
                        else if (stockEffect === 'positive') stockDisplay = `+${totalQty}`;

                        return {
                            name: comp.child?.product_name || 'Unknown',
                            qty_display: totalQty,
                            stock_display: stockDisplay,
                            stock_effect: stockEffect
                        };
                    });

                    groupedResults.push({
                        id: `${source}-${item.id}`,
                        date: isStoreSale ? order.sale_date : order.order_date,
                        combo_product_name: product.product_name,
                        source,
                        status,
                        components
                    });
                });
            };

            processItems(darazItems || [], 'Daraz');
            processItems(marketplaceItems || [], 'Marketplace');
            processItems(storeItemsProcessed, 'Store Sales');

            return groupedResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } catch (error) {
            console.error('Error fetching auto adjustments:', error);
            return [];
        }
    }
};
