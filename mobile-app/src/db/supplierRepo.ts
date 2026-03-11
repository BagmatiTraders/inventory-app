import { supabase } from '../lib/supabase';
import { getDb } from './database';

export interface Supplier {
    id: string;
    supplier_name: string;
    contact_details?: string;
    remarks?: string;
    is_deleted?: boolean;
    updated_at?: string;
}

export interface SupplierTransaction {
    id: string;
    transaction_date: string;
    supplier_id: string;
    transaction_mode: string;
    transaction_type: string;
    amount: number;
    payment_method: string;
    cheque_date?: string | null;
    remarks?: string | null;
    sync_status?: 'pending' | 'synced';
}

export interface SupplierLedgerEntry {
    supplier_id: string;
    supplier_name: string;
    opening_balance: number;
    debit: number;
    credit: number;
    running_balance: number;
}

const isDebitPurchase = (p: any) => {
    const isCashOrOnline = p.payment_type !== 'Due';
    if (p.purchase_type === 'Buy' && isCashOrOnline) return true;
    if (p.purchase_type === 'Sell' && isCashOrOnline) return true;
    if (p.purchase_type === 'Sell' && p.payment_type === 'Due') return true;
    return false;
};

const isCreditPurchase = (p: any) => {
    const isCashOrOnline = p.payment_type !== 'Due';
    if (p.purchase_type === 'Buy' && isCashOrOnline) return true;
    if (p.purchase_type === 'Sell' && isCashOrOnline) return true;
    if (p.purchase_type === 'Buy' && p.payment_type === 'Due') return true;
    return false;
};

export const SupplierRepo = {
    async getAll(): Promise<Supplier[]> {
        const db = await getDb();
        return await db.getAllAsync<Supplier>('SELECT * FROM suppliers WHERE is_deleted = 0 ORDER BY supplier_name ASC');
    },

    async upsert(supplier: Supplier) {
        const db = await getDb();
        await db.runAsync(
            'INSERT OR REPLACE INTO suppliers (id, supplier_name, contact_details, remarks, is_deleted, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [supplier.id, supplier.supplier_name, supplier.contact_details || null, supplier.remarks || null, supplier.is_deleted ? 1 : 0, supplier.updated_at || null]
        );
    },

    async syncWithRemote() {
        try {
            console.log('Syncing suppliers from remote...');
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .eq('is_deleted', false);

            if (error) throw error;

            if (data) {
                const db = await getDb();
                await db.withTransactionAsync(async () => {
                    for (const s of data) {
                        await this.upsert({
                            id: s.id,
                            supplier_name: s.supplier_name,
                            contact_details: s.contact_details,
                            remarks: s.remarks,
                            is_deleted: s.is_deleted,
                            updated_at: s.updated_at
                        });
                    }
                });
                console.log(`Successfully synced ${data.length} suppliers.`);
            }
        } catch (error) {
            console.error('Failed to sync suppliers:', error);
        }
    },

    async syncTransactionsWithRemote() {
        try {
            console.log('Starting paginated supplier transactions sync...');
            let hasMore = true;
            let offset = 0;
            const batchSize = 1000;
            let totalFetched = 0;

            const db = await getDb();

            while (hasMore) {
                const { data, error } = await supabase
                    .from('supplier_transactions')
                    .select('*')
                    .order('transaction_date', { ascending: false })
                    .order('id', { ascending: true }) // Stable tie-breaker
                    .range(offset, offset + batchSize - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    totalFetched += data.length;
                    await db.withTransactionAsync(async () => {
                        for (const t of data) {
                            await this.upsertSupplierTransaction({
                                ...t,
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
            console.log(`Successfully synced ${totalFetched} supplier transactions.`);
        } catch (error) {
            console.error('Failed to sync supplier transactions:', error);
        }
    },

    async getSupplierLedger(search: string = '') {
        const db = await getDb();

        // Get all suppliers
        let suppliersQuery = 'SELECT id, supplier_name FROM suppliers WHERE is_deleted = 0';
        const params: any[] = [];

        if (search) {
            suppliersQuery += ' AND supplier_name LIKE ?';
            params.push(`%${search}%`);
        }

        suppliersQuery += ' ORDER BY supplier_name ASC';

        const suppliers = await db.getAllAsync<{ id: string; supplier_name: string }>(suppliersQuery, params);

        if (suppliers.length === 0) return [];

        // Calculate ledger for each supplier
        const ledgerEntries: SupplierLedgerEntry[] = [];

        for (const supplier of suppliers) {
            // Fetch purchases for this supplier
            const purchases = await db.getAllAsync<any>(`
                SELECT purchase_type, payment_type, total_amount
                FROM purchases
                WHERE supplier_id = ?
            `, [supplier.id]);

            // Fetch transactions for this supplier
            const transactions = await db.getAllAsync<any>(`
                SELECT transaction_type, amount
                FROM supplier_transactions
                WHERE supplier_id = ?
            `, [supplier.id]);

            // Calculate totals
            let debit = 0;
            let credit = 0;

            // Process purchases
            purchases.forEach(p => {
                const amount = Number(p.total_amount) || 0;
                if (isDebitPurchase(p)) debit += amount;
                if (isCreditPurchase(p)) credit += amount;
            });

            // Process transactions
            transactions.forEach(t => {
                const amount = Number(t.amount) || 0;
                if (t.transaction_type === 'Paid') debit += amount;
                if (t.transaction_type === 'Received') credit += amount;
            });

            const running_balance = credit - debit;

            ledgerEntries.push({
                supplier_id: supplier.id,
                supplier_name: supplier.supplier_name,
                opening_balance: 0,
                debit,
                credit,
                running_balance
            });
        }

        // Sort by absolute running balance (highest first)
        return ledgerEntries.sort((a, b) => Math.abs(b.running_balance) - Math.abs(a.running_balance));
    },

    async getSupplierStats(supplierId: string) {
        // 1. Get Dates (Keep remote fiscal year for now, but data from local)
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('is_active', true).single();
        if (!fy) throw new Error('No active Fiscal Year found');
        const { start_date: startDate, end_date: endDate } = fy;

        const db = await getDb();

        // 2. Fetch Aggregates from local SQLite
        const [purchases, transactions, prevPurchases, prevTransactions, supplier] = await Promise.all([
            db.getAllAsync<any>('SELECT purchase_type, payment_type, total_amount FROM purchases WHERE supplier_id = ? AND purchase_date >= ? AND purchase_date <= ?', [supplierId, startDate, endDate]),
            db.getAllAsync<any>('SELECT transaction_type, amount FROM supplier_transactions WHERE supplier_id = ? AND transaction_date >= ? AND transaction_date <= ?', [supplierId, startDate, endDate]),
            db.getAllAsync<any>('SELECT purchase_type, payment_type, total_amount FROM purchases WHERE supplier_id = ? AND purchase_date < ?', [supplierId, startDate]),
            db.getAllAsync<any>('SELECT transaction_type, amount FROM supplier_transactions WHERE supplier_id = ? AND transaction_date < ?', [supplierId, startDate]),
            db.getFirstAsync<any>('SELECT supplier_name FROM suppliers WHERE id = ?', [supplierId])
        ]);

        // A. Opening Balance
        let openingBalance = 0;
        prevPurchases?.forEach(p => {
            const amount = Number(p.total_amount) || 0;
            if (isCreditPurchase(p)) openingBalance += amount;
            if (isDebitPurchase(p)) openingBalance -= amount;
        });
        prevTransactions?.forEach(t => {
            const amount = Number(t.amount) || 0;
            if (t.transaction_type === 'Received') openingBalance += amount;
            if (t.transaction_type === 'Paid') openingBalance -= amount;
        });

        // B. Current Period Stats
        let cashBuy = 0;
        let cashSell = 0;
        let dueSell = 0;
        let dueBuy = 0;
        let paid = 0;
        let received = 0;

        purchases?.forEach(p => {
            const amount = Number(p.total_amount) || 0;
            const isCashOrOnline = p.payment_type !== 'Due';
            if (p.purchase_type === 'Buy' && isCashOrOnline) cashBuy += amount;
            if (p.purchase_type === 'Sell' && isCashOrOnline) cashSell += amount;
            if (p.purchase_type === 'Sell' && p.payment_type === 'Due') dueSell += amount;
            if (p.purchase_type === 'Buy' && p.payment_type === 'Due') dueBuy += amount;
        });

        transactions?.forEach(t => {
            const amount = Number(t.amount) || 0;
            if (t.transaction_type === 'Paid') paid += amount;
            if (t.transaction_type === 'Received') received += amount;
        });

        return {
            stats: { cashBuy, cashSell, dueSell, dueBuy, paid, received, openingBalance },
            supplierName: supplier?.supplier_name || 'Unknown Supplier',
            timeRange: { startDate, endDate }
        };
    },

    async getSupplierDetailedTransactions(supplierId: string, type: 'CASH_BUY' | 'CASH_SELL' | 'DUE_SELL' | 'DUE_BUY' | 'PAID' | 'RECEIVED', from: number = 0, to: number = 19) {
        // 1. Get Dates
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('is_active', true).single();
        if (!fy) throw new Error('No active Fiscal Year found');
        const { start_date: startDate, end_date: endDate } = fy;

        const db = await getDb();
        const limit = to - from + 1;
        const offset = from;

        if (['PAID', 'RECEIVED'].includes(type)) {
            const queryType = type === 'PAID' ? 'Paid' : 'Received';
            const query = `
                SELECT * FROM supplier_transactions 
                WHERE supplier_id = ? AND transaction_type = ? 
                AND transaction_date >= ? AND transaction_date <= ?
                ORDER BY transaction_date DESC 
                LIMIT ? OFFSET ?
            `;
            const countQuery = `
                SELECT COUNT(*) as count FROM supplier_transactions 
                WHERE supplier_id = ? AND transaction_type = ? 
                AND transaction_date >= ? AND transaction_date <= ?
            `;

            const [data, countResult] = await Promise.all([
                db.getAllAsync<any>(query, [supplierId, queryType, startDate, endDate, limit, offset]),
                db.getFirstAsync<any>(countQuery, [supplierId, queryType, startDate, endDate])
            ]);

            return {
                transactions: (data || []).map((t: any) => ({
                    id: t.id,
                    date: t.transaction_date,
                    description: `Transaction (${t.transaction_mode})`,
                    reference: t.payment_method,
                    amount: t.amount,
                    type: t.transaction_type
                })),
                totalCount: countResult?.count || 0
            };
        } else {
            const isBuy = type.includes('BUY');
            const isCash = type.includes('CASH');
            const purchaseType = isBuy ? 'Buy' : 'Sell';
            const paymentTypeCondition = isCash ? "payment_type != 'Due'" : "payment_type = 'Due'";

            const query = `
                SELECT p.*, pr.name as product_name 
                FROM purchases p
                LEFT JOIN products pr ON p.product_id = pr.id
                WHERE p.supplier_id = ? AND p.purchase_type = ? AND ${paymentTypeCondition}
                AND p.purchase_date >= ? AND p.purchase_date <= ?
                ORDER BY p.purchase_date DESC 
                LIMIT ? OFFSET ?
            `;
            const countQuery = `
                SELECT COUNT(*) as count 
                FROM purchases p
                WHERE p.supplier_id = ? AND p.purchase_type = ? AND ${paymentTypeCondition}
                AND p.purchase_date >= ? AND p.purchase_date <= ?
            `;

            const [data, countResult] = await Promise.all([
                db.getAllAsync<any>(query, [supplierId, purchaseType, startDate, endDate, limit, offset]),
                db.getFirstAsync<any>(countQuery, [supplierId, purchaseType, startDate, endDate])
            ]);

            return {
                transactions: (data || []).map((p: any) => ({
                    id: p.id,
                    date: p.purchase_date,
                    description: `${p.purchase_type} - ${p.product_name || 'Item'}`,
                    reference: p.payment_type,
                    amount: p.total_amount,
                    type: p.purchase_type
                })),
                totalCount: countResult?.count || 0
            };
        }
    },

    async getSupplierLedgerDetails(supplierId: string): Promise<any[]> {
        const db = await getDb();

        // Fetch all purchases for this supplier with product info
        const purchases = await db.getAllAsync<any>(`
            SELECT 
                p.id,
                p.purchase_date as date,
                p.purchase_type,
                p.payment_type,
                p.total_amount,
                pr.name as product_name
            FROM purchases p
            LEFT JOIN products pr ON p.product_id = pr.id
            WHERE p.supplier_id = ?
            ORDER BY p.purchase_date DESC
        `, [supplierId]);

        // Fetch all transactions for this supplier
        const transactions = await db.getAllAsync<any>(`
            SELECT 
                id,
                transaction_date as date,
                transaction_type,
                transaction_mode,
                payment_method,
                amount,
                remarks
            FROM supplier_transactions
            WHERE supplier_id = ?
            ORDER BY transaction_date DESC
        `, [supplierId]);

        // Combine and format
        const ledgerEntries: any[] = [];

        // Process purchases
        purchases.forEach(p => {
            const isCashOrOnline = p.payment_type !== 'Due';
            let debit = 0;
            let credit = 0;

            // Calculate debit and credit
            if (p.purchase_type === 'Buy' && isCashOrOnline) {
                debit = p.total_amount;
                credit = p.total_amount;
            } else if (p.purchase_type === 'Sell' && isCashOrOnline) {
                debit = p.total_amount;
                credit = p.total_amount;
            } else if (p.purchase_type === 'Sell' && p.payment_type === 'Due') {
                debit = p.total_amount;
            } else if (p.purchase_type === 'Buy' && p.payment_type === 'Due') {
                credit = p.total_amount;
            }

            const paymentLabel = isCashOrOnline ? 'Cash' : 'Due';
            const typeLabel = p.purchase_type;

            ledgerEntries.push({
                id: p.id,
                date: p.date,
                particular: p.product_name || 'Unknown Product',
                particular_detail: `${paymentLabel} ${typeLabel}`,
                debit,
                credit,
                running_amount: 0,
                type: 'purchase'
            });
        });

        // Process transactions
        transactions.forEach(t => {
            const isPaid = t.transaction_type === 'Paid';
            const isReceived = t.transaction_type === 'Received';

            let particular = `${t.transaction_type} (${t.payment_method || t.transaction_mode})`;
            if (t.remarks) {
                particular += ` - ${t.remarks}`;
            }

            ledgerEntries.push({
                id: t.id,
                date: t.date,
                particular,
                particular_detail: null,
                debit: isPaid ? t.amount : 0,
                credit: isReceived ? t.amount : 0,
                running_amount: 0,
                type: 'transaction'
            });
        });

        // Sort by date descending (latest first)
        ledgerEntries.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA;
        });

        // Calculate running balance
        let runningBalance = 0;
        // Reverse to calculate from oldest to newest
        for (let i = ledgerEntries.length - 1; i >= 0; i--) {
            runningBalance = runningBalance + ledgerEntries[i].credit - ledgerEntries[i].debit;
            ledgerEntries[i].running_amount = runningBalance;
        }

        return ledgerEntries;
    },

    async addSupplierTransaction(transaction: SupplierTransaction) {
        const db = await getDb();
        await db.runAsync(
            'INSERT INTO supplier_transactions (id, transaction_date, supplier_id, transaction_mode, transaction_type, amount, payment_method, cheque_date, remarks, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [transaction.id, transaction.transaction_date, transaction.supplier_id, transaction.transaction_mode, transaction.transaction_type, transaction.amount, transaction.payment_method, transaction.cheque_date || null, transaction.remarks || null, transaction.sync_status || 'pending']
        );
    },

    async upsertSupplierTransaction(transaction: SupplierTransaction) {
        const db = await getDb();
        await db.runAsync(
            'INSERT OR REPLACE INTO supplier_transactions (id, transaction_date, supplier_id, transaction_mode, transaction_type, amount, payment_method, cheque_date, remarks, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [transaction.id, transaction.transaction_date, transaction.supplier_id, transaction.transaction_mode, transaction.transaction_type, transaction.amount, transaction.payment_method, transaction.cheque_date || null, transaction.remarks || null, transaction.sync_status || 'synced']
        );
    }
};
