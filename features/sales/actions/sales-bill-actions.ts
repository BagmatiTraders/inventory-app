'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface SalesBillItem {
    id?: string
    hs_code?: string | null
    particulars: string
    quantity: number
    rate: number
    amount: number
    line_order: number
}

export interface SalesBill {
    id: string
    bill_date_ad: string
    bill_date_bs: string
    seller_company_id: string | null
    invoice_no: string
    customer_name: string
    customer_address: string | null
    customer_pan_vat: string | null
    sub_total_amount: number
    vat_amount: number
    total_amount: number
    fiscal_year_id: string | null
    created_at: string
    items?: SalesBillItem[]
}

export interface CreateSalesBillParams {
    bill_date_ad: string
    bill_date_bs: string
    seller_company_id?: string | null
    invoice_no: string
    customer_name: string
    customer_address?: string | null
    customer_pan_vat?: string | null
    sub_total_amount: number
    vat_amount: number
    total_amount: number
    fiscal_year_id?: string | null
    items: Omit<SalesBillItem, 'id'>[]
}

// Get all Sales bills
export async function getSalesBills(filters?: {
    fiscalYearId?: string
    startDate?: string
    endDate?: string
    search?: string
}) {
    const supabase = await createClient()

    let query = supabase
        .from('sales_bills')
        .select('*')
        .eq('is_deleted', false)
        .order('bill_date_ad', { ascending: false })

    // Filter by Fiscal Year ID (Get dates first)
    if (filters?.fiscalYearId && filters.fiscalYearId !== 'all') {
        const { data: fy } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', filters.fiscalYearId)
            .single()

        if (fy) {
            query = query
                .gte('bill_date_ad', fy.start_date)
                .lte('bill_date_ad', fy.end_date)
        }
    } else if (filters?.startDate && filters?.endDate) {
        query = query
            .gte('bill_date_ad', filters.startDate)
            .lte('bill_date_ad', filters.endDate)
    }

    if (filters?.search) {
        query = query.or(
            `customer_name.ilike.%${filters.search}%,invoice_no.ilike.%${filters.search}%`
        )
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching Sales bills:', error)
        throw error
    }

    return data as SalesBill[]
}

// Create new Sales bill
export async function createSalesBill(params: CreateSalesBillParams) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Insert bill
    const { data: bill, error: billError } = await supabase
        .from('sales_bills')
        .insert({
            bill_date_ad: params.bill_date_ad,
            bill_date_bs: params.bill_date_bs,
            seller_company_id: params.seller_company_id || null,
            invoice_no: params.invoice_no,
            customer_name: params.customer_name,
            customer_address: params.customer_address || null,
            customer_pan_vat: params.customer_pan_vat || null,
            sub_total_amount: params.sub_total_amount,
            vat_amount: params.vat_amount,
            total_amount: params.total_amount,
            fiscal_year_id: params.fiscal_year_id || null,
            created_by: user?.id || null,
        })
        .select()
        .single()

    if (billError) throw billError

    // Insert items
    if (params.items.length > 0) {
        const itemsToInsert = params.items.map((item) => ({
            bill_id: bill.id,
            hs_code: item.hs_code || null,
            particulars: item.particulars,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
            line_order: item.line_order,
        }))

        const { error: itemsError } = await supabase
            .from('sales_bill_items')
            .insert(itemsToInsert)

        if (itemsError) throw itemsError
    }

    revalidatePath('/dashboard/account/pan-vat-billing/sales-billing')
    return bill as SalesBill
}

// Get single Sales bill with items
export async function getSalesBillById(id: string) {
    const supabase = await createClient()

    const { data: bill, error: billError } = await supabase
        .from('sales_bills')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .single()

    if (billError) throw billError

    const { data: items, error: itemsError } = await supabase
        .from('sales_bill_items')
        .select('*')
        .eq('bill_id', id)
        .order('line_order', { ascending: true })

    if (itemsError) throw itemsError

    return { ...bill, items } as SalesBill
}

// Update Sales bill
export async function updateSalesBill(id: string, params: CreateSalesBillParams) {
    const supabase = await createClient()

    // Update bill
    const { data: bill, error: billError } = await supabase
        .from('sales_bills')
        .update({
            bill_date_ad: params.bill_date_ad,
            bill_date_bs: params.bill_date_bs,
            seller_company_id: params.seller_company_id || null,
            invoice_no: params.invoice_no,
            customer_name: params.customer_name,
            customer_address: params.customer_address || null,
            customer_pan_vat: params.customer_pan_vat || null,
            sub_total_amount: params.sub_total_amount,
            vat_amount: params.vat_amount,
            total_amount: params.total_amount,
            fiscal_year_id: params.fiscal_year_id || null,
        })
        .eq('id', id)
        .select()
        .single()

    if (billError) throw billError

    // Delete existing items
    const { error: deleteError } = await supabase
        .from('sales_bill_items')
        .delete()
        .eq('bill_id', id)

    if (deleteError) throw deleteError

    // Insert new items
    if (params.items.length > 0) {
        const itemsToInsert = params.items.map((item) => ({
            bill_id: id,
            hs_code: item.hs_code || null,
            particulars: item.particulars,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
            line_order: item.line_order,
        }))

        const { error: itemsError } = await supabase
            .from('sales_bill_items')
            .insert(itemsToInsert)

        if (itemsError) throw itemsError
    }

    revalidatePath('/dashboard/account/pan-vat-billing/sales-billing')
    return bill as SalesBill
}
