'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveFiscalYear } from '@/features/settings/actions/settingsActions'

export interface StockAnalysisItem {
    particulars: string
    hs_code: string
    opening_stock: number
    purchase_stock: number
    purchase_amount: number
    sales_qty: number
    running_stock: number
    weighted_average_rate: number
}

export async function getStockAnalysisData(filters?: {
    fiscalYearId?: string
    search?: string
}): Promise<StockAnalysisItem[]> {
    const supabase = await createClient()

    // 1. Determine Date Range
    let startDate: string
    let endDate: string

    if (filters?.fiscalYearId && filters.fiscalYearId !== 'all') {
        const { data: fy, error } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', filters.fiscalYearId)
            .single()

        if (error) throw new Error('Fiscal Year not found')
        startDate = fy.start_date
        endDate = fy.end_date
    } else {
        // Default to active fiscal year if not provided or 'all' (though 'all' logic might differ, 
        // usually stock analysis is per period. If 'all', we might just show everything up to now.)
        // For 'all', we effectively want startDate = min_date and endDate = max_date.
        // But the prompt implies "Running Stock = Opening + Purchase ... [When fiscal year is change lock this]"
        // So let's default to Active FY if 'all' or undefined to be safe, or handle 'all' as "All Time"

        // If 'all' is explicitly passed, we set a very old start date
        if (filters?.fiscalYearId === 'all') {
            startDate = '2000-01-01'
            endDate = new Date().toISOString()
        } else {
            const { data: activeFy, error: fyError } = await getActiveFiscalYear()
            if (fyError || !activeFy) throw new Error('No active fiscal year found')
            startDate = activeFy.start_date
            endDate = activeFy.end_date
        }
    }

    // 2. Fetch All Valid Items to Aggregate
    // We need joined data: Item -> Bill (for date)
    // Supabase join syntax: pan_vat_bill_items (..., pan_vat_bills!inner (issue_bill_date_ad))

    let query = supabase
        .from('pan_vat_bill_items')
        .select(`
            *,
            pan_vat_bills!inner (
                issue_bill_date_ad,
                is_deleted
            )
        `)
        .eq('pan_vat_bills.is_deleted', false)

    if (filters?.search) {
        query = query.ilike('particulars', `%${filters.search}%`)
    }

    const { data: allItems, error } = await query

    if (error) {
        console.error('Error fetching stock data:', error)
        throw error
    }

    // 3. Aggregate Data in Memory (Grouping by Particulars)
    // We do this in JS because complex conditional sums (Opening vs Purchase) with grouping 
    // and efficient string matching is often easier/cleaner in app layer for moderate datasets.

    const productMap = new Map<string, StockAnalysisItem>()

    for (const item of allItems) {
        // Normalize Product Name
        const productName = item.particulars.trim()
        const billDate = item.pan_vat_bills.issue_bill_date_ad

        if (!productMap.has(productName)) {
            productMap.set(productName, {
                particulars: productName,
                hs_code: item.hs_code || '', // Will be overwritten by latest
                opening_stock: 0,
                purchase_stock: 0,
                purchase_amount: 0,
                sales_qty: 0, // Placeholder
                running_stock: 0,
                weighted_average_rate: 0
            })
        }

        const entry = productMap.get(productName)!

        // Update HS Code (keep the latest valid one, or just any non-null)
        if (item.hs_code) entry.hs_code = item.hs_code

        // Logic:
        // Opening Stock: Bill Date < Start Date
        // Purchase Stock: Start Date <= Bill Date <= End Date

        if (billDate < startDate) {
            entry.opening_stock += item.quantity
        } else if (billDate >= startDate && billDate <= endDate) {
            entry.purchase_stock += item.quantity
            entry.purchase_amount += item.amount
        }
        // Future dates (after endDate) are ignored for this analysis period
    }

    // 4. Final Calculations (Running Stock & Valuation Rate)
    const results = Array.from(productMap.values()).map(entry => {
        // Running Stock
        entry.running_stock = entry.opening_stock + entry.purchase_stock - entry.sales_qty

        // Calculate Rate for Valuation
        // If we want valuation based on *current period* purchase rate:
        if (entry.purchase_stock > 0) {
            entry.weighted_average_rate = entry.purchase_amount / entry.purchase_stock
        } else {
            // Fallback? Maybe 0. We don't have historical amount data easily separated unless we aggregate that too.
            // For now, 0 or keep as is.
            entry.weighted_average_rate = 0
        }

        return entry
    })

    // Sort by name
    results.sort((a, b) => a.particulars.localeCompare(b.particulars))

    return results
}
