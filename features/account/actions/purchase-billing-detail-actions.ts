'use server'

import { createClient } from '@/lib/supabase/server'
import type { PanVatBill } from './pan-vat-bill-actions'

export interface PurchaseBillingDetailParams {
    supplierCompanyId: string | null
    buyerCompanyId: string | null
    fiscalYearId?: string | null
    startDate?: string
    endDate?: string
}

export interface PurchaseBillingDetailResult {
    bills: PanVatBill[]
    totalAmount: number
    supplierCompanyName: string | null
    buyerCompanyName: string | null
}

export async function getPurchaseBillingDetail(params: PurchaseBillingDetailParams): Promise<PurchaseBillingDetailResult> {
    const supabase = await createClient()

    // Build query to get all bills for this supplier-buyer combination
    let query = supabase
        .from('pan_vat_bills')
        .select('*')
        .eq('is_deleted', false)
        .order('issue_bill_date_ad', { ascending: false })

    // Filter by supplier company
    if (params.supplierCompanyId) {
        query = query.eq('supplier_company_id', params.supplierCompanyId)
    } else {
        query = query.is('supplier_company_id', null)
    }

    // Filter by buyer company
    if (params.buyerCompanyId) {
        query = query.eq('buyer_company_id', params.buyerCompanyId)
    } else {
        query = query.is('buyer_company_id', null)
    }

    // Filter by fiscal year date range
    if (params.startDate && params.endDate) {
        query = query
            .gte('issue_bill_date_ad', params.startDate)
            .lte('issue_bill_date_ad', params.endDate)
    }

    const { data: bills, error } = await query

    if (error) {
        console.error('Error fetching purchase billing detail:', error)
        throw error
    }

    // Calculate total amount
    const totalAmount = bills.reduce((sum, bill) => sum + bill.total_amount, 0)

    // Get supplier and buyer names (from first bill if available)
    const supplierCompanyName = bills[0]?.supplier_company_name || null
    const buyerCompanyName = bills[0]?.buyer_company_name || null

    return {
        bills: bills as PanVatBill[],
        totalAmount,
        supplierCompanyName,
        buyerCompanyName,
    }
}
