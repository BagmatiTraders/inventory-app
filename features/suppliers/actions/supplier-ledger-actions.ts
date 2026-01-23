'use server'

import { createClient } from '@/lib/supabase/server'

export interface SupplierLedgerEntry {
    supplier_id: string
    supplier_name: string
    opening_balance: number
    debit: number
    credit: number
    running_balance: number
}

// Helper to check debit conditions (Logic defined in requirement)
const isDebitPurchase = (p: any) => {
    // 1. Buy + (Cash/Online/Others)
    if (p.purchase_type === 'Buy' && ['Cash', 'Online Payment', 'Others'].includes(p.payment_type)) return true
    // 2. Sell + (Cash/Online/Others)
    if (p.purchase_type === 'Sell' && ['Cash', 'Online Payment', 'Others'].includes(p.payment_type)) return true
    // 3. Sell + Due
    if (p.purchase_type === 'Sell' && p.payment_type === 'Due') return true
    return false
}

const isCreditPurchase = (p: any) => {
    // 1. Buy + (Cash/Online/Others)
    if (p.purchase_type === 'Buy' && ['Cash', 'Online Payment', 'Others'].includes(p.payment_type)) return true
    // 2. Sell + (Cash/Online/Others)
    if (p.purchase_type === 'Sell' && ['Cash', 'Online Payment', 'Others'].includes(p.payment_type)) return true
    // 3. Buy + Due
    if (p.purchase_type === 'Buy' && p.payment_type === 'Due') return true
    return false
}

export async function getSupplierLedger({
    fiscalYearId,
    search = ''
}: {
    fiscalYearId?: string
    search?: string
}): Promise<{ ledger: SupplierLedgerEntry[], error?: string }> {
    const supabase = await createClient()

    // 1. Get Fiscal Year Dates
    let startDate: string
    let endDate: string

    if (fiscalYearId) {
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('id', fiscalYearId).single()
        if (!fy) return { ledger: [], error: 'Fiscal Year not found' }
        startDate = fy.start_date
        endDate = fy.end_date
    } else {
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('is_active', true).single()
        if (!fy) return { ledger: [], error: 'No active Fiscal Year found' }
        startDate = fy.start_date
        endDate = fy.end_date
    }

    // 2. Get Suppliers
    let supplierQuery = supabase.from('suppliers').select('id, supplier_name').eq('is_deleted', false)
    if (search) {
        supplierQuery = supplierQuery.ilike('supplier_name', `%${search}%`)
    }
    const { data: suppliers, error: supplierError } = await supplierQuery

    if (supplierError || !suppliers) {
        return { ledger: [], error: supplierError?.message || 'Failed to fetch suppliers' }
    }

    const supplierIds = suppliers.map(s => s.id)

    // 3. Fetch ALL relevant financial data (Purchases & Transactions)
    // Optimization: filtering by supplierIds to avoid full table scan if search is active
    // We need "Previous" data (before startDate) for Opening Balance
    // And "Current" data (startDate <= date <= endDate) for Debit/Credit

    // Fetch Purchases
    const { data: allPurchases, error: purchaseError } = await supabase
        .from('purchases')
        .select('supplier_id, purchase_date, purchase_type, payment_type, total_amount')
        .in('supplier_id', supplierIds)
        .lte('purchase_date', endDate) // No need for future data

    // Fetch Transactions
    const { data: allTransactions, error: transactionError } = await supabase
        .from('supplier_transactions')
        .select('supplier_id, transaction_date, transaction_type, amount')
        .in('supplier_id', supplierIds)
        .lte('transaction_date', endDate)

    if (purchaseError || transactionError) {
        console.error('Error fetching ledger data', purchaseError, transactionError)
        return { ledger: [], error: 'Failed to fetch financial data' }
    }

    // 4. Client-side Aggregation
    const ledgerMap = new Map<string, SupplierLedgerEntry>()

    // Initialize map
    suppliers.forEach(s => {
        ledgerMap.set(s.id, {
            supplier_id: s.id,
            supplier_name: s.supplier_name,
            opening_balance: 0,
            debit: 0,
            credit: 0,
            running_balance: 0
        })
    })

    // Process Purchases
    allPurchases?.forEach(p => {
        const entry = ledgerMap.get(p.supplier_id)
        if (!entry) return

        const amount = Number(p.total_amount) || 0
        const isBefore = p.purchase_date < startDate
        const isCurrent = p.purchase_date >= startDate && p.purchase_date <= endDate

        // Helper boolean values regarding Debit/Credit contribution
        const contributesDebit = isDebitPurchase(p)
        const contributesCredit = isCreditPurchase(p)

        if (isBefore) {
            // Logic for Opening Balance:
            // Opening Balance is essentially the "Running Balance" from the past.
            // Running Balance = Opening + Credit - Debit
            // So contribution to Opening Balance = Credit contribution - Debit contribution
            if (contributesCredit) entry.opening_balance += amount
            if (contributesDebit) entry.opening_balance -= amount
        } else if (isCurrent) {
            if (contributesDebit) entry.debit += amount
            if (contributesCredit) entry.credit += amount
        }
    })

    // Process Transactions
    allTransactions?.forEach(t => {
        const entry = ledgerMap.get(t.supplier_id)
        if (!entry) return

        const amount = Number(t.amount) || 0
        const isBefore = t.transaction_date < startDate
        const isCurrent = t.transaction_date >= startDate && t.transaction_date <= endDate

        const isPaid = t.transaction_type === 'Paid'
        const isReceived = t.transaction_type === 'Received'

        // Debit Logic: Transaction Type = Paid
        // Credit Logic: Transaction Type = Received

        if (isBefore) {
            // Paid -> contributes to Debit -> decreases balance
            if (isPaid) entry.opening_balance -= amount
            // Received -> contributes to Credit -> increases balance
            if (isReceived) entry.opening_balance += amount
        } else if (isCurrent) {
            if (isPaid) entry.debit += amount
            if (isReceived) entry.credit += amount
        }
    })

    // 5. Calculate Final Running Balance and Format
    const results = Array.from(ledgerMap.values()).map(entry => {
        entry.running_balance = entry.opening_balance + entry.credit - entry.debit
        return entry
    })

    return { ledger: results }
}

// ============================================================================
// DETAIL PAGE ACTIONS
// ============================================================================

export type LedgerDetailType = 'CASH_BUY' | 'CASH_SELL' | 'DUE_SELL' | 'DUE_BUY' | 'PAID' | 'RECEIVED'

export async function getSupplierStats({
    supplierId,
    fiscalYearId
}: {
    supplierId: string
    fiscalYearId?: string
}) {
    const supabase = await createClient()

    // 1. Get Dates
    let startDate: string
    let endDate: string

    if (fiscalYearId) {
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('id', fiscalYearId).single()
        if (!fy) return { error: 'Fiscal Year not found' }
        startDate = fy.start_date
        endDate = fy.end_date
    } else {
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('is_active', true).single()
        if (!fy) return { error: 'No active Fiscal Year found' }
        startDate = fy.start_date
        endDate = fy.end_date
    }

    // 2. Fetch Aggregates
    // We can't easy do complex conditional sums in one standard Supabase query without RPC or excessive data fetching.
    // For specific supplier, fetching all rows is reasonably efficient.

    // Purchases
    const { data: purchases, error: pError } = await supabase
        .from('purchases')
        .select('purchase_type, payment_type, total_amount')
        .eq('supplier_id', supplierId)
        .gte('purchase_date', startDate)
        .lte('purchase_date', endDate)

    // Transactions
    const { data: transactions, error: tError } = await supabase
        .from('supplier_transactions')
        .select('transaction_type, amount')
        .eq('supplier_id', supplierId)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)

    if (pError || tError) return { error: 'Failed to fetch stats' }

    // 3. Fetch Opening Balance Data (Before Start Date)
    // We need to calculate opening balance for this specific supplier
    const { data: prevPurchases } = await supabase
        .from('purchases')
        .select('purchase_type, payment_type, total_amount')
        .eq('supplier_id', supplierId)
        .lt('purchase_date', startDate)

    const { data: prevTransactions } = await supabase
        .from('supplier_transactions')
        .select('transaction_type, amount')
        .eq('supplier_id', supplierId)
        .lt('transaction_date', startDate)

    // --- Calculations ---

    // A. Opening Balance
    let openingBalance = 0

    prevPurchases?.forEach(p => {
        const amount = Number(p.total_amount) || 0
        const isCashOrOnline = ['Cash', 'Online Payment', 'Others'].includes(p.payment_type)

        // Credit Contributions (Buy + Cash/Online, Sell + Cash/Online, Buy + Due)
        if ((p.purchase_type === 'Buy' && isCashOrOnline) ||
            (p.purchase_type === 'Sell' && isCashOrOnline) ||
            (p.purchase_type === 'Buy' && p.payment_type === 'Due')) {
            openingBalance += amount
        }

        // Debit Contributions (Buy + Cash/Online, Sell + Cash/Online, Sell + Due)
        if ((p.purchase_type === 'Buy' && isCashOrOnline) ||
            (p.purchase_type === 'Sell' && isCashOrOnline) ||
            (p.purchase_type === 'Sell' && p.payment_type === 'Due')) {
            openingBalance -= amount
        }
    })

    prevTransactions?.forEach(t => {
        const amount = Number(t.amount) || 0
        if (t.transaction_type === 'Received') openingBalance += amount
        if (t.transaction_type === 'Paid') openingBalance -= amount
    })

    // B. Current Period Stats
    let cashBuy = 0
    let cashSell = 0
    let dueSell = 0
    let dueBuy = 0
    let paid = 0
    let received = 0

    purchases?.forEach(p => {
        const amount = Number(p.total_amount) || 0
        const isCashOrOnline = ['Cash', 'Online Payment', 'Others'].includes(p.payment_type)

        if (p.purchase_type === 'Buy' && isCashOrOnline) cashBuy += amount
        if (p.purchase_type === 'Sell' && isCashOrOnline) cashSell += amount
        if (p.purchase_type === 'Sell' && p.payment_type === 'Due') dueSell += amount
        if (p.purchase_type === 'Buy' && p.payment_type === 'Due') dueBuy += amount
    })

    transactions?.forEach(t => {
        const amount = Number(t.amount) || 0
        if (t.transaction_type === 'Paid') paid += amount
        if (t.transaction_type === 'Received') received += amount
    })

    // Get Supplier Name
    const { data: supplier } = await supabase.from('suppliers').select('supplier_name').eq('id', supplierId).single()

    return {
        stats: { cashBuy, cashSell, dueSell, dueBuy, paid, received, openingBalance },
        supplierName: supplier?.supplier_name || 'Unknown Supplier',
        timeRange: { startDate, endDate }
    }
}

export async function getSupplierDetailedTransactions({
    supplierId,
    type,
    page = 1,
    limit = 10,
    fiscalYearId
}: {
    supplierId: string
    type: LedgerDetailType
    page?: number
    limit?: number
    fiscalYearId?: string
}) {
    const supabase = await createClient()

    // Get Dates
    let startDate: string
    let endDate: string

    if (fiscalYearId) {
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('id', fiscalYearId).single()
        if (!fy) return { error: 'Fiscal Year not found' }
        startDate = fy.start_date
        endDate = fy.end_date
    } else {
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('is_active', true).single()
        if (!fy) return { error: 'No active Fiscal Year found' }
        startDate = fy.start_date
        endDate = fy.end_date
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    let data = [], count = 0

    if (['PAID', 'RECEIVED'].includes(type)) {
        // Query Supplier Transactions
        let query = supabase
            .from('supplier_transactions')
            .select('*', { count: 'exact' })
            .eq('supplier_id', supplierId)
            .gte('transaction_date', startDate)
            .lte('transaction_date', endDate)
            .order('transaction_date', { ascending: false })
            .range(from, to)

        if (type === 'PAID') query = query.eq('transaction_type', 'Paid')
        if (type === 'RECEIVED') query = query.eq('transaction_type', 'Received')

        const { data: resData, count: resCount, error } = await query
        if (error) return { error: error.message }

        // Normalize to common structure
        data = (resData || []).map((t: any) => ({
            id: t.id,
            date: t.transaction_date,
            description: `Transaction (${t.transaction_mode})`,
            reference: t.payment_method, // or Mode
            amount: t.amount,
            type: t.transaction_type, // 'Paid' | 'Received'
            meta: t // Store full object if needed
        }))
        count = resCount || 0

    } else {
        // Query Purchases
        const isBuy = type.includes('BUY')
        const isCash = type.includes('CASH')

        let query = supabase
            .from('purchases')
            .select('*, product:products(product_name)', { count: 'exact' })
            .eq('supplier_id', supplierId)
            .gte('purchase_date', startDate)
            .lte('purchase_date', endDate)
            .order('purchase_date', { ascending: false })
            .range(from, to)

        // Filter Type (Buy/Sell)
        if (isBuy) query = query.eq('purchase_type', 'Buy')
        else query = query.eq('purchase_type', 'Sell')

        // Filter Payment
        if (isCash) {
            query = query.in('payment_type', ['Cash', 'Online Payment', 'Others'])
        } else {
            query = query.eq('payment_type', 'Due')
        }

        const { data: resData, count: resCount, error } = await query
        if (error) return { error: error.message }

        // Normalize
        data = (resData || []).map((p: any) => ({
            id: p.id,
            date: p.purchase_date,
            description: `${p.purchase_type} - ${p.product?.product_name}`,
            reference: p.payment_type,
            amount: p.total_amount,
            type: p.purchase_type, // 'Buy' | 'Sell'
            meta: p
        }))
        count = resCount || 0
    }

    return {
        transactions: data,
        totalCount: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page
    }
}
