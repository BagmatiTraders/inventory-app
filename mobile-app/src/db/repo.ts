import { getDb } from './database';
import { supabase } from '../lib/supabase';

export interface Product {
    id: string;
    name: string;
    sku: string;
    price: number;
    stock: number;
    image_url?: string;
    product_type?: string;
    product_id?: string;
    updated_at: string;
}

export interface Transaction {
    id: string;
    party_name: string;
    amount: number;
    type: 'IN' | 'OUT';
    timestamp: string;
    sync_status: 'synced' | 'pending';
}

export const ProductRepo = {
    async getAll(): Promise<Product[]> {
        const db = await getDb();
        const result = await db.getAllAsync<Product>('SELECT * FROM products ORDER BY name ASC');
        return result;
    },

    async getById(id: string): Promise<Product | null> {
        const db = await getDb();
        const result = await db.getFirstAsync<Product>('SELECT * FROM products WHERE id = ?', [id]);
        return result;
    },

    async upsert(product: Product) {
        const db = await getDb();
        await db.runAsync(
            `INSERT OR REPLACE INTO products (id, name, sku, price, stock, image_url, product_type, product_id, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [product.id, product.name, product.sku, product.price, product.stock, product.image_url || null, product.product_type || 'single', product.product_id || null, product.updated_at]
        );
    },

    async syncWithRemote() {
        try {
            console.log('Starting paginated product sync...');
            let hasMore = true;
            let offset = 0;
            const batchSize = 1000;
            let totalFetched = 0;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('products')
                    .select('id, product_name, seller_sku1, est_price, image_url, product_type, product_id, updated_at')
                    .eq('is_deleted', false)
                    .order('id', { ascending: true })
                    .range(offset, offset + batchSize - 1);

                if (error) {
                    console.error('Supabase sync error:', error);
                    throw error;
                }

                if (data && data.length > 0) {
                    totalFetched += data.length;
                    const db = await getDb();
                    await db.withTransactionAsync(async () => {
                        for (const p of data) {
                            await this.upsert({
                                id: p.id,
                                name: p.product_name,
                                sku: p.seller_sku1 || '',
                                price: Number(p.est_price) || 0,
                                stock: 0,
                                image_url: p.image_url,
                                product_type: p.product_type,
                                product_id: p.product_id,
                                updated_at: p.updated_at
                            });
                        }
                    });
                    offset += batchSize;
                }

                if (!data || data.length < batchSize) {
                    hasMore = false;
                }
            }
            console.log(`Successfully synced ${totalFetched} products.`);
        } catch (error) {
            console.error('Failed to sync products:', error);
        }
    }
};

export const TransactionRepo = {
    async getAll(): Promise<Transaction[]> {
        const db = await getDb();
        const result = await db.getAllAsync<Transaction>('SELECT * FROM transactions ORDER BY timestamp DESC');
        return result;
    },

    async insert(tx: Transaction) {
        const db = await getDb();
        await db.runAsync(
            `INSERT INTO transactions (id, party_name, amount, type, timestamp, sync_status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
            [tx.id, tx.party_name, tx.amount, tx.type, tx.timestamp, tx.sync_status]
        );
    },

    async getSummary() {
        const db = await getDb();
        const result = await db.getFirstAsync<{ total_in: number, total_out: number }>(
            "SELECT SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END) as total_in, " +
            "SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END) as total_out " +
            "FROM transactions WHERE date(timestamp) = date('now')"
        );
        return result || { total_in: 0, total_out: 0 };
    }
};
