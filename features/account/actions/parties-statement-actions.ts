'use server'

import { createClient } from '@/lib/supabase/server'

export interface PartiesStatementItem {
    supplier_id: string
    supplier_name: string
    total_purchase_amount: number
    pan_vat_bill_amount: number
}

interface GetPartiesStatementParams {
    startDate?: string
    endDate?: string
    search?: string
}

export async function getPartiesStatement({ startDate, endDate, search }: GetPartiesStatementParams) {
    const supabase = await createClient()

    // 1. Get all suppliers
    let suppliersQuery = supabase
        .from('suppliers')
        .select('id, supplier_name')
        .eq('is_deleted', false)
        .order('supplier_name')

    if (search) {
        suppliersQuery = suppliersQuery.ilike('supplier_name', `%${search}%`)
    }

    const { data: suppliers, error: suppliersError } = await suppliersQuery

    if (suppliersError) {
        console.error('Error fetching suppliers:', suppliersError)
        return []
    }

    if (!suppliers.length) return []

    // 2. Get total purchase amount for each supplier within date range
    let purchasesQuery = supabase
        .from('purchases')
        .select('supplier_id, total_amount')

    if (startDate && endDate) {
        purchasesQuery = purchasesQuery
            .gte('purchase_date', startDate)
            .lte('purchase_date', endDate)
    }

    const { data: purchases, error: purchasesError } = await purchasesQuery

    if (purchasesError) {
        console.error('Error fetching purchases:', purchasesError)
        return []
    }

    // 3. Get Pan/Vat Bill amount for each supplier (via PanVatCompany)
    // First get all pan_vat_companies linked to our suppliers
    let companiesQuery = supabase
        .from('pan_vat_companies')
        .select('id, supplier_id')
        .not('supplier_id', 'is', null)

    const { data: companies, error: companiesError } = await companiesQuery

    if (companiesError) {
        console.error('Error fetching pan_vat_companies:', companiesError)
        return []
    }

    // Then get bills for these companies
    let billsQuery = supabase
        .from('pan_vat_bills')
        .select('supplier_company_id, total_amount')
        .eq('is_deleted', false)

    if (startDate && endDate) {
        billsQuery = billsQuery
            .gte('issue_bill_date_ad', startDate)
            .lte('issue_bill_date_ad', endDate)
    }

    const { data: bills, error: billsError } = await billsQuery

    if (billsError) {
        console.error('Error fetching bills:', billsError)
        return []
    }

    // 4. Aggregate data (Optimized with Maps)

    // Group purchases by Supplier ID
    const purchasesMap = new Map<string, number>()
    purchases?.forEach(p => {
        if (p.supplier_id) {
            const current = purchasesMap.get(p.supplier_id) || 0
            purchasesMap.set(p.supplier_id, current + (p.total_amount || 0))
        }
    })

    // Map Supplier ID -> List of PanVatCompany IDs
    const supplierToCompanyMap = new Map<string, string[]>()
    companies?.forEach(c => {
        if (c.supplier_id) {
            const list = supplierToCompanyMap.get(c.supplier_id) || []
            list.push(c.id)
            supplierToCompanyMap.set(c.supplier_id, list)
        }
    })

    // Group Bills by Company ID
    const billsMap = new Map<string, number>()
    bills?.forEach(b => {
        if (b.supplier_company_id) {
            const current = billsMap.get(b.supplier_company_id) || 0
            billsMap.set(b.supplier_company_id, current + (b.total_amount || 0))
        }
    })

    const result: PartiesStatementItem[] = suppliers.map(supplier => {
        // 1. Get Purchase Total (O(1) lookup)
        const totalPurchaseAmount = purchasesMap.get(supplier.id) || 0

        // 2. Get Pan/Vat Bill Total
        // Get linked companies
        const linkedCompanyIds = supplierToCompanyMap.get(supplier.id) || []

        // Sum bills for these companies
        const totalPanVatBillAmount = linkedCompanyIds.reduce((sum, companyId) => {
            return sum + (billsMap.get(companyId) || 0)
        }, 0)

        return {
            supplier_id: supplier.id,
            supplier_name: supplier.supplier_name,
            total_purchase_amount: totalPurchaseAmount,
            pan_vat_bill_amount: totalPanVatBillAmount
        }
    })

    return result
}
