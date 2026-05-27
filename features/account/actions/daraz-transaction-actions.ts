'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface DarazWeeklyTransaction {
    id?: string
    start_date: string
    end_date: string
    seller_account: string
    company_name: string
    estimated_sales_amount: number
    sales_amount: number
    cofunded_voucher_max: number
    payment_fee: number
    daraz_coins_discount_participation_fee: number
    free_shipping_max_fee: number
    commission_fee: number
    general_sales_tax_withholding: number
    handling_fee: number
    total_commission_fees: number
    fiscal_year_id?: string | null
    created_at?: string
    updated_at?: string
    created_by?: string | null
}

// Fetch all saved weekly transactions for a fiscal year
export async function getDarazWeeklyTransactions(fiscalYearId?: string) {
    const supabase = await createClient()

    let query = supabase
        .from('daraz_weekly_transactions')
        .select('*')

    if (fiscalYearId && fiscalYearId !== 'all') {
        query = query.eq('fiscal_year_id', fiscalYearId)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching Daraz weekly transactions:', error)
        throw error
    }

    return data as DarazWeeklyTransaction[]
}

// Save or update weekly transaction
export async function saveDarazWeeklyTransaction(transaction: Omit<DarazWeeklyTransaction, 'id' | 'created_at' | 'updated_at' | 'created_by'>) {
    const supabase = await createClient()

    // Get current user for audit
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
        .from('daraz_weekly_transactions')
        .upsert({
            ...transaction,
            created_by: user?.id || null,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'start_date,end_date,seller_account'
        })
        .select()
        .single()

    if (error) {
        console.error('Error saving Daraz weekly transaction:', error)
        throw error
    }

    revalidatePath('/dashboard/account/pan-vat-billing/daraz-transaction')
    return data as DarazWeeklyTransaction
}

// Fetch weekly estimated sales from delivered orders for a seller and date range
export async function getWeeklyEstimatedSales(startDate: string, endDate: string, sellerAccount: string) {
    const supabase = await createClient()

    // Query get_daily_profit_stats RPC to sum up revenue for the date range
    const { data, error } = await supabase.rpc('get_daily_profit_stats', {
        search_term_param: '',
        sync_status_param: 'all',
        start_date_param: startDate,
        end_date_param: endDate,
        seller_account_param: sellerAccount
    })

    if (error) {
        console.error('Error calculating weekly estimated sales:', error)
        return 0
    }

    // Sum up the revenue field from all matching daily records
    const totalRevenue = (data || []).reduce((sum: number, row: any) => sum + (parseFloat(row.revenue) || 0), 0)
    return totalRevenue
}
