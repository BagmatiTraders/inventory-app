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

// --- New Detailed Statement Action ---

export async function getStatementDetails(storeId: string, startDate: string, endDate: string) {
    const supabase = await createClient()

    // 1. Fetch Delivered Orders in this period
    const { data: orders, error: orderError } = await supabase
        .from('daraz_orders')
        .select(`
            order_number,
            delivered_at,
            items:daraz_order_items(amount, quantity)
        `)
        .eq('store_id', storeId)
        .eq('order_status', 'Delivered')
        .gte('delivered_at', startDate)
        .lte('delivered_at', endDate)

    if (orderError) {
        console.error('Error fetching statement orders:', orderError)
        throw new Error('Failed to fetch statement orders')
    }

    // 2. Calculate "Product Price Paid by Buyer" (Revenue) from Orders
    let productPricePaidByBuyer = 0
    const orderNumbers: string[] = []

    orders?.forEach((order: any) => {
        orderNumbers.push(order.order_number)
        const orderRevenue = order.items?.reduce((sum: number, item: any) => {
            return sum + ((item.amount || 0) * (item.quantity || 1))
        }, 0) || 0
        productPricePaidByBuyer += orderRevenue
    })

    // 3. Fetch Finance Transactions and breakdown
    let fees = {
        coFundedVoucherMax: 0,
        shippingFeePaidByBuyer: 0,

        // Transaction Fees
        paymentFee: 0,
        darazCoinsDiscount: 0,
        freeShippingMaxFee: 0,
        commissionFee: 0,
        shippingFee: 0,
        shippingFeeDiscount: 0,

        // Returned Orders
        coFundedVoucherMaxReversal: 0,
        productPriceRefunded: 0,

        // Withholding
        gstWithholding: 0,

        // Logistics
        handlingFeeReturn: 0,
        handlingFee: 0,

        // Refunds/Reversals
        paymentFeeRefunded: 0,
        darazCoinsReversal: 0,
        freeShippingNaxReversal: 0,
        commissionFeeRefunded: 0
    }

    if (orderNumbers.length > 0) {
        const { data: transactions, error: financeError } = await supabase
            .from('daraz_finance_transactions')
            .select('fee_name, amount, transaction_type')
            .in('order_no', orderNumbers)

        if (financeError) {
            console.error('Error fetching statement finance:', financeError)
        } else {
            transactions?.forEach((t: any) => {
                const name = (t.fee_name || '').toLowerCase()
                const type = (t.transaction_type || '').toLowerCase()
                const amt = Number(t.amount || 0)

                // Broaden matching helpers
                const isVoucher = name.includes('voucher') || name.includes('promotional')
                const isCoFunded = name.includes('co-funded') || name.includes('cofunded') || name.includes('co_funded')
                const isReversal = name.includes('reversal') || name.includes('refund') || type === 'refund'

                // --- Delivered Orders Section ---
                // "Co-funded Voucher Max" - USER REQUESTED: Fixed at 2% of Product Price.
                // We will calculate this AFTER the loop using `productPricePaidByBuyer`.
                // So here we only capture specific OTHER fees or overrides if needed.
                // Actually, let's IGNORE the DB 'co-funded voucher max' amounts for the charge side
                // to follow the user's rule strictly.
                if (isVoucher && isCoFunded && !isReversal) {
                    // NO-OP: User wants calculated value.
                }
                else if ((name.includes('shipping fee') && name.includes('buyer') && !isReversal)) {
                    fees.shippingFeePaidByBuyer += amt
                }

                // --- Transaction Fees Section ---
                else if (name.includes('payment fee') && !isReversal) {
                    fees.paymentFee += amt
                }
                else if (name.includes('coins') && !isReversal) {
                    fees.darazCoinsDiscount += amt
                }
                else if (name.includes('free shipping') && name.includes('max') && !isReversal) {
                    fees.freeShippingMaxFee += amt
                }
                else if (name.includes('commission') && !isReversal) {
                    fees.commissionFee += amt
                }
                else if ((name === 'shipping fee (charged by daraz)' || name === 'shipping fee') && !isReversal) {
                    fees.shippingFee += amt
                }
                else if (name.includes('shipping fee discount') && !isReversal) {
                    fees.shippingFeeDiscount += amt
                }

                // --- Returned Orders ---
                else if (isVoucher && isCoFunded && isReversal) {
                    fees.coFundedVoucherMaxReversal += amt
                }
                else if (type === 'refund' && (name.includes('product price') || name.includes('item price'))) {
                    fees.productPriceRefunded += amt
                }

                // --- Withholding ---
                else if (name.includes('withholding')) {
                    fees.gstWithholding += amt
                }

                // --- Logistics ---
                else if (name.includes('handling fee') && name.includes('return')) {
                    fees.handlingFeeReturn += amt
                }
                else if (name.includes('handling fee') && !name.includes('return')) {
                    fees.handlingFee += amt
                }

                // --- Reversals / Refunds of Fees ---
                else if (name.includes('payment fee') && isReversal) {
                    fees.paymentFeeRefunded += amt
                }
                else if (name.includes('coins') && isReversal) {
                    fees.darazCoinsReversal += amt
                }
                else if (name.includes('free shipping') && name.includes('max') && isReversal) {
                    fees.freeShippingNaxReversal += amt
                }
                else if (name.includes('commission') && isReversal) {
                    fees.commissionFeeRefunded += amt
                }
            })
        }
    }

    // Apply User Rule: Co-funded Voucher Max = Product Price Paid by Buyer * 2%
    // Fee is negative deduction.
    fees.coFundedVoucherMax = -(productPricePaidByBuyer * 0.02)

    return {
        productPricePaidByBuyer,
        ...fees
    }
}
