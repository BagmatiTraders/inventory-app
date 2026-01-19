'use server'

import { createClient } from '@/lib/supabase/server'
import { startOfWeek, endOfWeek, parseISO, format, addDays } from 'date-fns'

export interface WeeklyStatement {
    id: string // "YYYY-WXX" or date range string
    periodLabel: string // "Jan 1 - Jan 7, 2024"
    startDate: string
    endDate: string
    revenue: number
    darazFees: number
    otherCharges: number
    netPayout: number
    status: string // "Paid" or "Pending" (Derived)
    transactionCount: number
}

export async function getDarazStatement(storeId: string) {
    const supabase = await createClient()

    // 1. Fetch ALL transactions for the store
    // Optimization: In future, we can paginate or limit to last year. For now, fetch all.
    const { data: transactions, error } = await supabase
        .from('daraz_finance_transactions')
        .select('*')
        .eq('store_id', storeId)
        .order('transaction_date', { ascending: false })

    if (error) {
        console.error('Error fetching statements:', error)
        return []
    }

    if (!transactions || transactions.length === 0) {
        return []
    }

    // 2. Group by Week (Monday - Sunday)
    const grouped: Record<string, WeeklyStatement> = {}

    transactions.forEach(t => {
        const date = parseISO(t.transaction_date)

        // Daraz Payout Cycle: Monday to Sunday
        // We use date-fns `startOfWeek` with weekStartsOn: 1 (Monday)
        const weekStart = startOfWeek(date, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 })

        const key = format(weekStart, 'yyyy-MM-dd') // Unique Key

        if (!grouped[key]) {
            grouped[key] = {
                id: key,
                periodLabel: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
                startDate: format(weekStart, 'yyyy-MM-dd'),
                endDate: format(weekEnd, 'yyyy-MM-dd'),
                revenue: 0,
                darazFees: 0,
                otherCharges: 0,
                netPayout: 0,
                status: 'Estimated', // Default
                transactionCount: 0
            }
        }

        const amt = Number(t.amount)
        const type = (t.transaction_type || '').toLowerCase()
        const feeName = (t.fee_name || '').toLowerCase()

        // 3. Aggregate Logic
        // "Payout" transaction itself is a transfer/withdrawal, usually separates ledger?
        // Actually detailed ledger contains the "Payout" entry which zeros out the balance?
        // Let's check typical generic API response structure. 
        // usually: Credit (Item Price) - Debit (Fees) = Balance. 
        // If there is a 'Payout' entry, it might be a debit that reduces balance to 0.
        // We want to calculate "Net Payout" *from the operations*, so we exclude the actual Payout withdrawal entry if it exists to avoid double counting?
        // Or if the user wants to see "What was paid", we look for the Payout entry.
        // STRATEGY: 
        // "Net Payout" = (Effective Revenue - Fees). This is what *should* be paid.
        // "Status" = If we find a 'Payout' transaction in this week or next week referencing this statement, it's 'Paid'.

        // Simple Classification:
        // Revenue: Item Price, Shipping paid by customer (if credited)
        // Check `amount`: Positive usually Revenue/Reversal. Negative usually Fee/Refund.

        // Refined Logic based on typical Daraz Finance API:
        // amount > 0: Revenue (Item Price, Shipping, Claims)
        // amount < 0: Deductions (Comm, Payment Fee, Refunds)

        // Special Case: "Automatic Payout" transaction. This is a debit that clears the account. 
        // We should EXCLUDE strict "Payout" transactions from the calculations of "Net Payout" 
        // because we are calculating what the payout *should be*.

        const isPayout = type.includes('payout') || feeName.includes('payout') || feeName.includes('remittance')

        if (isPayout) {
            // This marks the week as likely Paid, but don't add to sum (it zeros it out)
            grouped[key].status = 'Paid'
        } else {
            grouped[key].transactionCount++

            if (amt > 0) {
                grouped[key].revenue += amt
            } else {
                // Negative amounts
                // If it's a Fee (Commission, Payment Fee, Shipping Fee)
                if (feeName.includes('commission') || feeName.includes('payment fee') || feeName.includes('shipping fee') || feeName.includes('handling')) {
                    grouped[key].darazFees += amt // It's negative, so we add negative
                } else {
                    // Refunds, Claims, Penalties, etc.
                    grouped[key].otherCharges += amt
                }
            }

            // Net is sum of all non-payout operations
            grouped[key].netPayout += amt
        }
    })

    // 4. Convert to Array and Sort
    return Object.values(grouped).sort((a, b) => b.startDate.localeCompare(a.startDate))
}
