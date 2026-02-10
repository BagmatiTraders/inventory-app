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
            }
        } catch (error) {
            console.error('Failed to sync suppliers:', error);
        }
    },

    async getSupplierLedger(search: string = '') {
        // 1. Get Active Fiscal Year
        const { data: fy } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('is_active', true)
            .single();

        if (!fy) throw new Error('No active fiscal year found');
        const { start_date: startDate, end_date: endDate } = fy;

        // 2. Get Suppliers
        let supplierQuery = supabase
            .from('suppliers')
            .select('id, supplier_name')
            .eq('is_deleted', false);

        if (search) {
            supplierQuery = supplierQuery.ilike('supplier_name', `%${search}%`);
        }

        const { data: suppliers, error: sError } = await supplierQuery;
        if (sError) throw sError;

        const supplierIds = suppliers.map(s => s.id);
        if (supplierIds.length === 0) return [];

        // 3. Fetch Purchases and Transactions
        const [{ data: allPurchases }, { data: allTransactions }] = await Promise.all([
            supabase
                .from('purchases')
                .select('supplier_id, purchase_date, purchase_type, payment_type, total_amount')
                .in('supplier_id', supplierIds)
                .lte('purchase_date', endDate),
            supabase
                .from('supplier_transactions')
                .select('supplier_id, transaction_date, transaction_type, amount')
                .in('supplier_id', supplierIds)
                .lte('transaction_date', endDate)
        ]);

        // 4. Aggregate Data
        const ledgerMap = new Map<string, SupplierLedgerEntry>();
        suppliers.forEach(s => {
            ledgerMap.set(s.id, {
                supplier_id: s.id,
                supplier_name: s.supplier_name,
                opening_balance: 0,
                debit: 0,
                credit: 0,
                running_balance: 0
            });
        });

        allPurchases?.forEach(p => {
            const entry = ledgerMap.get(p.supplier_id);
            if (!entry) return;

            const amount = Number(p.total_amount) || 0;
            const isBefore = p.purchase_date < startDate;
            const isCurrent = p.purchase_date >= startDate && p.purchase_date <= endDate;

            if (isBefore) {
                if (isCreditPurchase(p)) entry.opening_balance += amount;
                if (isDebitPurchase(p)) entry.opening_balance -= amount;
            } else if (isCurrent) {
                if (isDebitPurchase(p)) entry.debit += amount;
                if (isCreditPurchase(p)) entry.credit += amount;
            }
        });

        allTransactions?.forEach(t => {
            const entry = ledgerMap.get(t.supplier_id);
            if (!entry) return;

            const amount = Number(t.amount) || 0;
            const isBefore = t.transaction_date < startDate;
            const isCurrent = t.transaction_date >= startDate && t.transaction_date <= endDate;

            if (isBefore) {
                if (t.transaction_type === 'Received') entry.opening_balance += amount;
                if (t.transaction_type === 'Paid') entry.opening_balance -= amount;
            } else if (isCurrent) {
                if (t.transaction_type === 'Paid') entry.debit += amount;
                if (t.transaction_type === 'Received') entry.credit += amount;
            }
        });

        return Array.from(ledgerMap.values())
            .map(entry => ({
                ...entry,
                running_balance: entry.opening_balance + entry.credit - entry.debit
            }))
            .sort((a, b) => Math.abs(b.running_balance) - Math.abs(a.running_balance));
    },

    async getSupplierStats(supplierId: string) {
        // 1. Get Dates
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('is_active', true).single();
        if (!fy) throw new Error('No active Fiscal Year found');
        const { start_date: startDate, end_date: endDate } = fy;

        // 2. Fetch Aggregates
        const [{ data: purchases }, { data: transactions }, { data: prevPurchases }, { data: prevTransactions }, { data: supplier }] = await Promise.all([
            supabase.from('purchases').select('purchase_type, payment_type, total_amount').eq('supplier_id', supplierId).gte('purchase_date', startDate).lte('purchase_date', endDate),
            supabase.from('supplier_transactions').select('transaction_type, amount').eq('supplier_id', supplierId).gte('transaction_date', startDate).lte('transaction_date', endDate),
            supabase.from('purchases').select('purchase_type, payment_type, total_amount').eq('supplier_id', supplierId).lt('purchase_date', startDate),
            supabase.from('supplier_transactions').select('transaction_type, amount').eq('supplier_id', supplierId).lt('transaction_date', startDate),
            supabase.from('suppliers').select('supplier_name').eq('id', supplierId).single()
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
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('is_active', true).single();
        if (!fy) throw new Error('No active Fiscal Year found');
        const { start_date: startDate, end_date: endDate } = fy;

        if (['PAID', 'RECEIVED'].includes(type)) {
            let query = supabase.from('supplier_transactions').select('*', { count: 'exact' }).eq('supplier_id', supplierId).gte('transaction_date', startDate).lte('transaction_date', endDate).order('transaction_date', { ascending: false }).range(from, to);
            if (type === 'PAID') query = query.eq('transaction_type', 'Paid');
            if (type === 'RECEIVED') query = query.eq('transaction_type', 'Received');

            const { data, count, error } = await query;
            if (error) throw error;
            return {
                transactions: (data || []).map((t: any) => ({
                    id: t.id,
                    date: t.transaction_date,
                    description: `Transaction (${t.transaction_mode})`,
                    reference: t.payment_method,
                    amount: t.amount,
                    type: t.transaction_type
                })),
                totalCount: count || 0
            };
        } else {
            const isBuy = type.includes('BUY');
            const isCash = type.includes('CASH');
            let query = supabase.from('purchases').select('*, product:products(product_name)', { count: 'exact' }).eq('supplier_id', supplierId).gte('purchase_date', startDate).lte('purchase_date', endDate).order('purchase_date', { ascending: false }).range(from, to);
            if (isBuy) query = query.eq('purchase_type', 'Buy'); else query = query.eq('purchase_type', 'Sell');
            if (isCash) query = query.neq('payment_type', 'Due'); else query = query.eq('payment_type', 'Due');

            const { data, count, error } = await query;
            if (error) throw error;
            return {
                transactions: (data || []).map((p: any) => ({
                    id: p.id,
                    date: p.purchase_date,
                    description: `${p.purchase_type} - ${p.product?.product_name || 'Item'}`,
                    reference: p.payment_type,
                    amount: p.total_amount,
                    type: p.purchase_type
                })),
                totalCount: count || 0
            };
        }
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
