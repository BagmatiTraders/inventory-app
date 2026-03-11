import { getDb } from './database';
import { supabase } from '../lib/supabase';

export interface PurchasePlan {
    id: string;
    plan_date: string;
    product_id: string;
    quantity: number;
    remarks?: string;
    status: 'Pending' | 'Complete' | 'Cancel';
    expires_at: string;
    created_at: string;
    snapshot_latest_price?: number;
    snapshot_latest_supplier?: string;
    snapshot_low_price?: number;
    snapshot_low_supplier?: string;
    cached_product_name?: string;
    cached_product_image?: string;
    sync_status: 'synced' | 'pending';
    product?: {
        product_name: string;
        image_url?: string;
        sku?: string;
    };
}

export interface Purchase {
    id: string;
    purchase_date: string;
    product_id: string;
    supplier_id: string;
    quantity: number;
    unit_amount: number;
    total_amount: number;
    payment_type?: string;
    remarks?: string;
    purchase_type?: string;
    purchase_name?: string;
    sync_status: 'synced' | 'pending';
    product?: {
        product_name: string;
    };
    supplier?: {
        supplier_name: string;
    };
}

export const PurchaseRepo = {
    // --- Purchase Plans ---

    async getPlans(): Promise<PurchasePlan[]> {
        const db = await getDb();
        const now = new Date().toISOString();

        // Use LEFT JOIN so we don't hide plans if product sync is slightly behind
        const query = `
            SELECT pp.*, p.name as product_name, p.image_url as product_image, p.sku as product_sku
            FROM purchase_plans pp
            LEFT JOIN products p ON pp.product_id = p.id
            WHERE pp.expires_at > ? OR pp.status = 'Pending'
            ORDER BY pp.created_at DESC
        `;
        const result = await db.getAllAsync<any>(query, [now]);
        return result.map(p => ({
            ...p,
            product: {
                product_name: p.product_name || p.cached_product_name || 'Syncing Product...',
                image_url: p.product_image || p.cached_product_image,
                sku: p.product_sku
            }
        }));
    },

    async hasPendingPlan(productId: string): Promise<boolean> {
        const db = await getDb();
        const result = await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM purchase_plans WHERE product_id = ? AND status = 'Pending'`,
            [productId]
        );
        return (result?.count || 0) > 0;
    },

    async updatePlanStatus(id: string, status: 'Pending' | 'Complete' | 'Cancel') {
        const db = await getDb();

        // Determine new expiry time based on status (matching web logic)
        let expiresAt: string | null = null;
        const now = new Date();

        if (status === 'Complete') {
            // Complete: 12 hours from now
            expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
        } else if (status === 'Cancel') {
            // Cancel: 2 hours from now
            expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
        } else if (status === 'Pending') {
            // Pending: Reset to 24 hours from now
            expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        }

        const query = expiresAt
            ? `UPDATE purchase_plans SET status = ?, expires_at = ?, sync_status = 'pending' WHERE id = ?`
            : `UPDATE purchase_plans SET status = ?, sync_status = 'pending' WHERE id = ?`;

        const params = expiresAt ? [status, expiresAt, id] : [status, id];
        await db.runAsync(query, params);

        // Try to sync with remote immediately (Fire and forget)
        this.syncPlanUpdateToRemote(id, status, expiresAt);
    },

    async syncPlanUpdateToRemote(id: string, status: string, expiresAt: string | null) {
        try {
            const updateData: any = { status };
            if (expiresAt) updateData.expires_at = expiresAt;

            const { error } = await supabase
                .from('purchase_plans')
                .update(updateData)
                .eq('id', id);

            if (!error) {
                const db = await getDb();
                await db.runAsync(`UPDATE purchase_plans SET sync_status = 'synced' WHERE id = ?`, [id]);
            } else {
                console.error('Supabase status update error:', error);
            }
        } catch (error) {
            console.error('Failed to sync plan status update:', error);
        }
    },

    async upsertPlan(plan: PurchasePlan) {
        const db = await getDb();
        const pName = plan.product?.product_name || plan.cached_product_name || null;
        const pImage = plan.product?.image_url || plan.cached_product_image || null;

        await db.runAsync(
            `INSERT OR REPLACE INTO purchase_plans 
            (id, plan_date, product_id, quantity, remarks, status, expires_at, created_at, 
             snapshot_latest_price, snapshot_latest_supplier, snapshot_low_price, snapshot_low_supplier, 
             cached_product_name, cached_product_image, sync_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                plan.id, plan.plan_date, plan.product_id, plan.quantity, plan.remarks || null,
                plan.status, plan.expires_at, plan.created_at,
                plan.snapshot_latest_price || null, plan.snapshot_latest_supplier || null,
                plan.snapshot_low_price || null, plan.snapshot_low_supplier || null,
                pName, pImage, plan.sync_status
            ]
        );

        if (plan.sync_status === 'pending') {
            this.syncPlanToRemote(plan);
        }
    },

    async syncPlanToRemote(plan: PurchasePlan) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('purchase_plans')
                .upsert({
                    id: plan.id,
                    plan_date: plan.plan_date,
                    product_id: plan.product_id,
                    quantity: plan.quantity,
                    remarks: plan.remarks,
                    status: plan.status,
                    expires_at: plan.expires_at,
                    created_at: plan.created_at,
                    created_by: user.id,
                    snapshot_latest_price: plan.snapshot_latest_price,
                    snapshot_latest_supplier: plan.snapshot_latest_supplier,
                    snapshot_low_price: plan.snapshot_low_price,
                    snapshot_low_supplier: plan.snapshot_low_supplier
                });

            if (!error) {
                const db = await getDb();
                await db.runAsync(`UPDATE purchase_plans SET sync_status = 'synced' WHERE id = ?`, [plan.id]);
            } else {
                console.error('Supabase upsert error:', error);
            }
        } catch (error) {
            console.error('Failed to sync plan to remote:', error);
        }
    },

    async syncPlansWithRemote() {
        try {
            // Cleanup expired locally first
            const db = await getDb();
            const now = new Date().toISOString();
            await db.runAsync("DELETE FROM purchase_plans WHERE expires_at < ? AND status != 'Pending'", [now]);

            console.log('Starting paginated purchase plans sync...');
            const supabase = require('../lib/supabase').supabase;
            let hasMore = true;
            let offset = 0;
            const batchSize = 100;
            let totalFetched = 0;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('purchase_plans')
                    .select(`
                        *,
                        product:products(
                            product_name, 
                            image_url,
                            seller_sku1,
                            seller_sku2,
                            seller_sku3,
                            seller_sku4
                        )
                    `)
                    .order('created_at', { ascending: false })
                    .range(offset, offset + batchSize - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    totalFetched += data.length;
                    const db = await getDb();
                    await db.withTransactionAsync(async () => {
                        for (const plan of data) {
                            await this.upsertPlan({
                                ...plan,
                                product: plan.product,
                                sync_status: 'synced'
                            });
                        }
                    });
                    offset += batchSize;
                }

                if (!data || data.length < batchSize) {
                    hasMore = false;
                }
            }
            console.log(`Successfully synced ${totalFetched} purchase plans.`);
        } catch (error) {
            console.error('Failed to sync purchase plans:', error);
        }
    },

    async completePlanForProduct(productId: string) {
        const db = await getDb();
        const now = new Date();
        // Auto-complete (Purchased): 8 hours from now
        const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();

        // 1. Update local database
        await db.runAsync(
            `UPDATE purchase_plans SET status = 'Complete', expires_at = ?, sync_status = 'pending' 
             WHERE product_id = ? AND status = 'Pending'`,
            [expiresAt, productId]
        );

        // 2. Sync to remote (Fire and forget)
        (async () => {
            try {
                const { error } = await require('../lib/supabase').supabase
                    .from('purchase_plans')
                    .update({ status: 'Complete', expires_at: expiresAt })
                    .eq('product_id', productId)
                    .eq('status', 'Pending');

                if (!error) {
                    await db.runAsync(
                        `UPDATE purchase_plans SET sync_status = 'synced' 
                         WHERE product_id = ? AND status = 'Complete' AND expires_at = ?`,
                        [productId, expiresAt]
                    );
                }
            } catch (err) {
                console.error('Remote auto-complete fail:', err);
            }
        })();
    },

    // --- Purchases ---

    async getTodayPurchases(): Promise<Purchase[]> {
        const db = await getDb();
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        const query = `
            SELECT pu.*, pr.name as product_name, s.supplier_name
            FROM purchases pu
            JOIN products pr ON pu.product_id = pr.id
            JOIN suppliers s ON pu.supplier_id = s.id
            WHERE pu.purchase_date = ?
            ORDER BY pu.id DESC
        `;
        const result = await db.getAllAsync<any>(query, [today]);
        return result.map(p => ({
            ...p,
            product: { product_name: p.product_name },
            supplier: { supplier_name: p.supplier_name }
        }));
    },

    async upsertPurchase(purchase: Purchase) {
        const db = await getDb();
        await db.runAsync(
            `INSERT OR REPLACE INTO purchases 
            (id, purchase_date, product_id, supplier_id, quantity, unit_amount, total_amount, 
             payment_type, remarks, purchase_type, purchase_name, sync_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                purchase.id, purchase.purchase_date, purchase.product_id, purchase.supplier_id,
                purchase.quantity, purchase.unit_amount, purchase.total_amount,
                purchase.payment_type || null, purchase.remarks || null,
                purchase.purchase_type || null, purchase.purchase_name || null,
                purchase.sync_status
            ]
        );
    },

    async deletePurchase(id: string) {
        const db = await getDb();
        await db.runAsync(`DELETE FROM purchases WHERE id = ?`, [id]);

        // Background sync to remote
        (async () => {
            try {
                const { error } = await supabase
                    .from('purchases')
                    .delete()
                    .eq('id', id);
                if (error) console.error('Remote delete failed:', error);
            } catch (err) {
                console.error('Remote delete fail:', err);
            }
        })();
    },

    async updatePurchase(purchase: Purchase) {
        // Since upsertPurchase already uses INSERT OR REPLACE and we pass the ID, 
        // it serves as an update for existing records in SQLite.
        await this.upsertPurchase({ ...purchase, sync_status: 'pending' });

        // Background sync to remote
        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { error } = await supabase
                    .from('purchases')
                    .update({
                        purchase_date: purchase.purchase_date,
                        product_id: purchase.product_id,
                        supplier_id: purchase.supplier_id,
                        quantity: purchase.quantity,
                        unit_amount: purchase.unit_amount,
                        total_amount: purchase.total_amount,
                        payment_type: purchase.payment_type,
                        remarks: purchase.remarks,
                        purchase_type: purchase.purchase_type,
                        updated_by: user.id
                    })
                    .eq('id', purchase.id);

                if (!error) {
                    await this.upsertPurchase({ ...purchase, sync_status: 'synced' });
                } else {
                    console.error('Remote update failed:', error);
                }
            } catch (err) {
                console.error('Remote update fail:', err);
            }
        })();
    },

    async syncPurchasesWithRemote() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            console.log('Starting paginated purchases sync...');
            let hasMore = true;
            let offset = 0;
            const batchSize = 1000;
            let totalFetched = 0;

            const db = await getDb();

            while (hasMore) {
                const { data, error } = await supabase
                    .from('purchases')
                    .select('*')
                    .order('purchase_date', { ascending: false })
                    .order('id', { ascending: true }) // Stable tie-breaker
                    .range(offset, offset + batchSize - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    totalFetched += data.length;
                    await db.withTransactionAsync(async () => {
                        for (const p of data) {
                            await this.upsertPurchase({ ...p, sync_status: 'synced' });
                        }
                    });
                    offset += batchSize;
                }

                if (!data || data.length < batchSize) {
                    hasMore = false;
                }
            }
            console.log(`Successfully synced ${totalFetched} purchases.`);
        } catch (error) {
            console.error('Failed to sync purchases:', error);
        }
    },

    async getHistoryForProduct(productId: string, limit: number = 3): Promise<Purchase[]> {
        const db = await getDb();

        // 1. Try local first
        const localQuery = `
            SELECT pu.*, s.supplier_name
            FROM purchases pu
            JOIN suppliers s ON pu.supplier_id = s.id
            WHERE pu.product_id = ?
            ORDER BY pu.purchase_date DESC, pu.id DESC
            LIMIT ?
        `;
        let result = await db.getAllAsync<any>(localQuery, [productId, limit]);

        // 2. If local is empty or less than limit, try fetching from remote and sync
        if (result.length < limit) {
            try {
                const { data, error } = await supabase
                    .from('purchases')
                    .select('*, supplier:suppliers(supplier_name)')
                    .eq('product_id', productId)
                    .order('purchase_date', { ascending: false })
                    .limit(limit);

                if (!error && data) {
                    for (const row of data) {
                        await this.upsertPurchase({
                            ...row,
                            sync_status: 'synced'
                        });
                    }
                    // Re-query local to include synced items (and get joined names correctly)
                    result = await db.getAllAsync<any>(localQuery, [productId, limit]);
                }
            } catch (err) {
                console.error('Remote history fetch failed:', err);
            }
        }

        return result.map(p => ({
            ...p,
            supplier: { supplier_name: p.supplier_name }
        }));
    },

    async getSnapshotStats(productId: string) {
        const db = await getDb();

        // Latest purchase price
        const latestQuery = `
            SELECT p.unit_amount, s.supplier_name
            FROM purchases p
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.product_id = ?
            ORDER BY p.purchase_date DESC, p.id DESC
            LIMIT 1
        `;
        const latest = await db.getFirstAsync<any>(latestQuery, [productId]);

        // All-time low price
        const lowQuery = `
            SELECT p.unit_amount, s.supplier_name
            FROM purchases p
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.product_id = ?
            ORDER BY p.unit_amount ASC, p.purchase_date DESC
            LIMIT 1
        `;
        const low = await db.getFirstAsync<any>(lowQuery, [productId]);

        return {
            latestPrice: latest?.unit_amount || 0,
            latestSupplier: latest?.supplier_name || 'N/A',
            lowPrice: low?.unit_amount || 0,
            lowSupplier: low?.supplier_name || 'N/A'
        };
    },

    async getAllPurchasesPaginated(offset: number, limit: number, filters: {
        productName?: string,
        supplierName?: string,
        startDate?: string,
        endDate?: string
    }): Promise<Purchase[]> {
        const db = await getDb();
        let query = `
            SELECT pu.*, pr.name as product_name, s.supplier_name
            FROM purchases pu
            JOIN products pr ON pu.product_id = pr.id
            JOIN suppliers s ON pu.supplier_id = s.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (filters.productName || filters.supplierName) {
            query += ` AND (pr.name LIKE ? OR s.supplier_name LIKE ?)`;
            params.push(`%${filters.productName || filters.supplierName}%`, `%${filters.productName || filters.supplierName}%`);
        }

        if (filters.startDate) {
            query += ` AND pu.purchase_date >= ?`;
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            query += ` AND pu.purchase_date <= ?`;
            params.push(filters.endDate);
        }

        query += ` ORDER BY pu.purchase_date DESC, pu.id DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const result = await db.getAllAsync<any>(query, params);
        return result.map(p => ({
            ...p,
            product: { product_name: p.product_name },
            supplier: { supplier_name: p.supplier_name }
        }));
    },

    async getDateWisePurchaseSummary(): Promise<any[]> {
        const db = await getDb();
        const query = `
            SELECT 
                purchase_date as date,
                SUM(CASE WHEN LOWER(purchase_type) = 'sell' THEN total_amount ELSE 0 END) as sales_amount,
                SUM(CASE WHEN LOWER(purchase_type) = 'buy' OR purchase_type IS NULL OR purchase_type = '' THEN total_amount ELSE 0 END) as purchase_amount
            FROM purchases
            GROUP BY purchase_date
            ORDER BY purchase_date DESC
        `;
        return await db.getAllAsync<any>(query);
    }
};
