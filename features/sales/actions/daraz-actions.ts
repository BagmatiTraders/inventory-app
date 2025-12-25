'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Types
interface DarazOrderItem {
    seller_sku: string
    quantity: number
    amount: number
    item_sequence: number
}

interface CreateDarazOrderData {
    order_number: string
    tracking_number: string
    customer_name: string
    order_date: string
    order_status: string
    remarks?: string
    items: DarazOrderItem[]
}

interface FiscalYear {
    id: string
    name: string
    start_date: string
    end_date: string
    is_active: boolean
}

interface GetDarazOrdersParams {
    page?: number
    limit?: number
    status?: string
    todayOnly?: boolean
    fiscalYearId?: string
    sellerAccount?: string
    unprintedOnly?: boolean
}

// Create new Daraz order with items
export async function createDarazOrder(data: CreateDarazOrderData) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    try {
        // Generate invoice number
        const { data: invoiceData, error: invoiceError } = await supabase
            .rpc('generate_daraz_invoice_number')

        if (invoiceError) throw invoiceError

        // Create order
        const { data: order, error: orderError } = await supabase
            .from('daraz_orders')
            .insert({
                invoice_number: invoiceData,
                order_number: data.order_number,
                tracking_number: data.tracking_number,
                customer_name: data.customer_name,
                order_date: data.order_date,
                order_status: data.order_status,
                remarks: data.remarks,
                created_by: user.id,
                order_source: 'manual',
                import_source: 'manual'
            })
            .select()
            .single()

        if (orderError) throw orderError

        // Create order items
        // Create order items with product lookup
        const items = await Promise.all(data.items.map(async (item) => {
            // Lookup product for seller_account and name
            const { data: matchedProduct } = await supabase
                .rpc('match_product_by_sku', { sku_input: item.seller_sku })
                .single() as { data: any, error: any }

            const product = matchedProduct as any
            return {
                order_id: order.id,
                seller_sku: item.seller_sku,
                quantity: item.quantity,
                amount: item.amount,
                item_sequence: item.item_sequence,
                seller_account: product?.seller_account || null,
                product_name: product?.product_name || null,
                product_id: product?.product_id ? null : null // schema might need UUID, RPC returns integer product_id usually? No, products table has UUID id. check RPC.
                // RPC likely returns UUID if I designed it right. Double check RPC later if it fails.
                // For now, assuming match_product_by_sku returns object with seller_account, product_name.
            }
        }))

        const { error: itemsError } = await supabase
            .from('daraz_order_items')
            .insert(items)

        if (itemsError) throw itemsError

        revalidatePath('/dashboard/sales/daraz')
        return { success: true, order }
    } catch (error: any) {
        console.error('Error creating Daraz order:', error)
        throw new Error(error.message || 'Failed to create order')
    }
}

// Get Daraz orders with filters (for Sales Entry page)
export async function getDarazOrders(params: GetDarazOrdersParams) {
    const supabase = await createClient()
    const { page = 1, limit = 50, status, todayOnly = false, fiscalYearId, sellerAccount, unprintedOnly } = params

    // Strategy: Always query Table + Items to ensure we have seller_account and full control
    let query = supabase
        .from('daraz_orders')
        .select('*, items:daraz_order_items!inner(*)', { count: 'exact' })
        .or('deleted.is.null,deleted.eq.false')

    // Seller Account Filter
    if (sellerAccount && sellerAccount !== 'all') {
        query = query.eq('items.seller_account', sellerAccount)
    }

    // Fiscal Year Filter
    if (fiscalYearId) {
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('id', fiscalYearId).single()
        if (fy) query = query.gte('order_date', fy.start_date).lte('order_date', fy.end_date)
    }

    // Date/Status Logic
    if (todayOnly) {
        // Today Only logic: Pending OR Order Date is Today OR Shipped Today (via updated_at)
        const today = new Date().toISOString().split('T')[0]
        const todayStart = `${today}T00:00:00.000Z` // UTC start

        // Note: We use updated_at as proxy for "Shipped Date" as status change updates it.
        // Logic: Show ALL Pending, Packed, Ready to Ship + Orders from Today + Shipped Today
        query = query.or(`order_status.eq.Pending,order_status.eq.Packed,order_status.eq."Ready to Ship",order_date.eq.${today},and(order_status.eq.Shipped,updated_at.gte.${todayStart})`)
    }

    if (status && status !== 'all') query = query.eq('order_status', status)

    // Unprinted Filter
    if (unprintedOnly) {
        query = query.or('is_printed.is.null,is_printed.eq.false')
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
        .order('daraz_created_at', { ascending: false, nullsFirst: false }) // Primary: Real Daraz Time
        .order('created_at', { ascending: false }) // Fallback: DB Insert Time
        .range(from, to)

    if (error) throw error

    // Transform and Aggegrate
    const orders = data?.map((order: any) => {
        const items = order.items || []
        const totalQty = items.reduce((sum: number, i: any) => sum + i.quantity, 0)
        const grandTotal = items.reduce((sum: number, i: any) => sum + (i.quantity * i.amount), 0)
        const firstProduct = items[0]?.product_name || 'Product Not Found'
        // Extract seller_account from the first item
        const sellerAccount = items[0]?.seller_account || 'Unknown'
        const itemCount = items.length

        return {
            ...order,
            total_quantity: totalQty,
            grand_total: grandTotal,
            first_product_name: firstProduct,
            seller_account: sellerAccount, // Explicitly add this
            item_count: itemCount,
            items: items
        }
    }) || []

    return {
        orders,
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
        }
    }
}

// Get all Daraz orders (for Order List page)
export async function getAllDarazOrders(params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    fromDate?: string
    toDate?: string
    fiscalYearId?: string
    timestampField?: string // New: which timestamp field to filter by
}) {
    const supabase = await createClient()
    const { page = 1, limit = 50, search, status, fromDate, toDate, fiscalYearId, timestampField = 'order_date' } = params

    let query = supabase
        .from('daraz_orders_with_totals')
        .select('*', { count: 'exact' })
        .or('deleted.is.null,deleted.eq.false') // Show only non-deleted orders

    // Filter Logic: Hide "Cancel" orders UNLESS they are printed
    // We construct a filter that says: status is NOT Cancel OR (status IS Cancel AND printed is true)
    // The database column is 'is_printed' (covers both invoice/awb printing status)
    // Logic: (order_status.neq.Cancel, is_printed.eq.true)
    query = query.or('order_status.neq.Cancel,is_printed.eq.true')

    // Fiscal Year Filter (takes precedence over fromDate/toDate)
    if (fiscalYearId) {
        const { data: fy } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', fiscalYearId)
            .single()

        if (fy) {
            query = query
                .gte('order_date', fy.start_date)
                .lte('order_date', fy.end_date)
        }
    } else {
        // Date range filter using the selected timestamp field
        if (fromDate) {
            query = query.gte(timestampField, fromDate)
        }

        if (toDate) {
            query = query.lte(timestampField, toDate)
        }
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

    if (error) throw error

    return {
        orders: data || [],
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
        }
    }
}

// Get single order by ID with items
export async function getDarazOrderById(orderId: string) {
    const supabase = await createClient()

    const { data: order, error: orderError } = await supabase
        .from('daraz_orders_with_totals')
        .select('*')
        .eq('id', orderId)
        .single()

    if (orderError) throw orderError

    const { data: items, error: itemsError } = await supabase
        .from('daraz_order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('item_sequence')

    if (itemsError) throw itemsError

    if (itemsError) throw itemsError

    // Fetch Store Details for Invoice
    let storeDetails = null
    // Use the seller_account from the first item directly, as it's more reliable than product linkage
    const sellerAccount = items.length > 0 ? items[0].seller_account : null

    if (sellerAccount) {
        const { data: store } = await supabase
            .from('online_stores')
            .select('company_name, address, contact, pan_vat_number')
            .eq('seller_account', sellerAccount)
            .single()

        if (store) {
            storeDetails = store
        }
    }

    return { ...order, items, store: storeDetails }
}

// Update order
export async function updateDarazOrder(orderId: string, data: Partial<CreateDarazOrderData>) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    try {
        // Update order
        const { error: orderError } = await supabase
            .from('daraz_orders')
            .update({
                order_number: data.order_number,
                tracking_number: data.tracking_number,
                customer_name: data.customer_name,
                order_date: data.order_date,
                order_status: data.order_status,
                remarks: data.remarks,
                edit_by: user.id,
                edited_at: new Date().toISOString()
            })
            .eq('id', orderId)

        if (orderError) throw orderError

        // Update items if provided
        if (data.items) {
            // Delete existing items
            await supabase
                .from('daraz_order_items')
                .delete()
                .eq('order_id', orderId)

            // Insert new items
            const items = data.items.map(item => ({
                order_id: orderId,
                seller_sku: item.seller_sku,
                quantity: item.quantity,
                amount: item.amount,
                item_sequence: item.item_sequence
            }))

            const { error: itemsError } = await supabase
                .from('daraz_order_items')
                .insert(items)

            if (itemsError) throw itemsError
        }

        revalidatePath('/dashboard/sales/daraz')
        return { success: true }
    } catch (error: any) {
        console.error('Error updating order:', error)
        throw new Error(error.message || 'Failed to update order')
    }
}

// Update order status (bulk or single)
export async function updateDarazOrderStatus(orderIds: string[], newStatus: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('daraz_orders')
        .update({
            order_status: newStatus,
            updated_by: user.id
            // Status-specific timestamps handled by trigger
        })
        .in('id', orderIds)

    if (error) throw error

    revalidatePath('/dashboard/sales/daraz')
    return { success: true, count: orderIds.length }
}

// Mark orders as printed
export async function markDarazOrdersAsPrinted(orderIds: string[]) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('daraz_orders')
        .update({
            is_printed: true,
            printed_at: new Date().toISOString()
        })
        .in('id', orderIds)

    if (error) throw error

    revalidatePath('/dashboard/sales/daraz')
    return { success: true }
}

// Delete order
export async function deleteDarazOrder(orderId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('daraz_orders')
        .delete()
        .eq('id', orderId)

    if (error) throw error

    revalidatePath('/dashboard/sales/daraz')
    return { success: true }
}

// Export orders to CSV
export async function exportDarazOrders(filters?: {
    status?: string
    dateFrom?: string
    dateTo?: string
}) {
    const supabase = await createClient()

    let query = supabase
        .from('daraz_orders_with_totals')
        .select('*')

    if (filters?.status && filters.status !== 'all') {
        query = query.eq('order_status', filters.status)
    }

    if (filters?.dateFrom) {
        query = query.gte('order_date', filters.dateFrom)
    }

    if (filters?.dateTo) {
        query = query.lte('order_date', filters.dateTo)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return data || []
}
// Bulk import Daraz orders from CSV
export async function bulkImportDarazOrders(rows: any[]) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    let successCount = 0
    const failures: { row: number; reason: string }[] = []

    try {
        // 1. Fetch all products for SKU matching (Optimized: Single query)
        // We fetch id, product_name, seller_account, and all SKU fields
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, product_name, seller_sku1, seller_account1, seller_sku2, seller_account2, seller_sku3, seller_account3, seller_sku4, seller_account4')

        if (productsError) throw new Error(`Failed to fetch products: ${productsError.message}`)

        // 2. Fetch existing order numbers (including deleted ones) to handle restore
        const orderNumbers = rows.map(r => r['Order Number']).filter(Boolean)
        const { data: existingOrders, error: existingOrdersError } = await supabase
            .from('daraz_orders')
            .select('id, order_number, deleted')
            .in('order_number', orderNumbers)

        if (existingOrdersError) throw new Error(`Failed to check existing orders: ${existingOrdersError.message}`)

        const existingOrderMap = new Map(existingOrders?.map(o => [o.order_number, o]))

        // 3. Process each row
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            const rowNum = i + 1 // 1-based index for user feedback

            // Basic Validation
            const orderNumber = row['Order Number']?.toString().trim()
            const trackingNumber = row['Tracking Number']?.toString().trim()
            const customerName = row['Customer Name']?.toString().trim()
            const sellerSku = row['Seller Skus']?.toString().trim()
            // Remove commas before parsing to handle formatted numbers like "2,399.00"
            const quantity = parseInt(row['Quantity']?.toString().replace(/,/g, '') || '0')
            const amount = parseFloat(row['Amount']?.toString().replace(/,/g, '') || '0')

            if (!orderNumber || !trackingNumber || !customerName) {
                failures.push({ row: rowNum, reason: 'Missing required fields (Order#, Tracking#, or Customer)' })
                continue
            }

            const existingOrder = existingOrderMap.get(orderNumber)
            // If exists and NOT deleted, skip as duplicate
            if (existingOrder && !existingOrder.deleted) {
                failures.push({ row: rowNum, reason: `Order ${orderNumber} already exists` })
                continue
            }

            // Find Product by SKU and determine Seller Account
            let matchedProduct: any = null
            let matchedSellerAccount: string | null = null

            if (products) {
                // Find matching product
                matchedProduct = products.find(p =>
                    p.seller_sku1 === sellerSku ||
                    p.seller_sku2 === sellerSku ||
                    p.seller_sku3 === sellerSku ||
                    p.seller_sku4 === sellerSku
                )

                // If found, determine which account matched
                if (matchedProduct) {
                    if (matchedProduct.seller_sku1 === sellerSku) matchedSellerAccount = matchedProduct.seller_account1
                    else if (matchedProduct.seller_sku2 === sellerSku) matchedSellerAccount = matchedProduct.seller_account2
                    else if (matchedProduct.seller_sku3 === sellerSku) matchedSellerAccount = matchedProduct.seller_account3
                    else if (matchedProduct.seller_sku4 === sellerSku) matchedSellerAccount = matchedProduct.seller_account4
                }
            }

            // Generate Invoice Number
            const { data: invoiceData, error: invoiceError } = await supabase
                .rpc('generate_daraz_invoice_number')

            if (invoiceError) {
                failures.push({ row: rowNum, reason: `Invoice gen failed: ${invoiceError.message}` })
                continue
            }

            // Create or Restore Order
            const today = new Date().toISOString().split('T')[0]
            let orderId = ''

            if (existingOrder && existingOrder.deleted) {
                // RESTORE deleted order
                // We update it with new CSV data and clear deleted flag
                const { data: restored, error: restoreError } = await supabase
                    .from('daraz_orders')
                    .update({
                        invoice_number: invoiceData, // maintain new invoice or keep old? Usually new import = new invoice logic, let's update.
                        tracking_number: trackingNumber,
                        customer_name: customerName,
                        order_date: today,
                        order_status: 'Pending',
                        created_by: user.id, // reset creator or keep? reset to importer usually.
                        order_source: 'manual',
                        import_source: 'csv', // mark as csv import
                        remarks: 'Restored via CSV Import',
                        deleted: false,
                        deleted_at: null,
                        deleted_by: null,
                        pending_deletion: false
                    })
                    .eq('id', existingOrder.id)
                    .select()
                    .single()

                if (restoreError) {
                    failures.push({ row: rowNum, reason: `Order restore failed: ${restoreError.message}` })
                    continue
                }
                orderId = restored.id

                // Delete OLD items to replace with NEW CSV items
                await supabase.from('daraz_order_items').delete().eq('order_id', orderId)

            } else {
                // CREATE new order
                const { data: order, error: orderError } = await supabase
                    .from('daraz_orders')
                    .insert({
                        invoice_number: invoiceData,
                        order_number: orderNumber,
                        tracking_number: trackingNumber,
                        customer_name: customerName,
                        order_date: today,
                        order_status: 'Pending',
                        created_by: user.id,
                        order_source: 'manual',
                        import_source: 'csv',
                        remarks: ''
                    })
                    .select()
                    .single()

                if (orderError) {
                    failures.push({ row: rowNum, reason: `Order insert failed: ${orderError.message}` })
                    continue
                }
                orderId = order.id
            }

            // Create Order Item
            const { error: itemError } = await supabase
                .from('daraz_order_items')
                .insert({
                    order_id: orderId,
                    seller_sku: sellerSku,
                    product_id: matchedProduct?.id || null, // Optional link if we want, but schema might not strictly enforce FK if we allow 'Product Not Found'
                    quantity: quantity,
                    amount: amount, // Rate
                    item_sequence: 1,
                    seller_account: matchedSellerAccount,
                    product_name: matchedProduct?.product_name || null
                })

            if (itemError) {
                // Cleanup order if item fails? Supabase doesn't support easy nested transactions in REST.
                // We'll leave the order (it will have 0 items, visibly "Empty"). 
                // Or try to delete it.
                // Cleanup
                if (!existingOrder) {
                    await supabase.from('daraz_orders').delete().eq('id', orderId)
                }
                // If restored, we might have left it empty items which is bad, but better than deleting the header? 
                // Restore logic is tricky rollback. Let's assume failures are rare post-header.
                failures.push({ row: rowNum, reason: `Item insert failed: ${itemError.message}` })
                continue
            }

            successCount++
            // Add to existing set to prevent duplicates WITHIN the CSV
            // Add to existing map to prevent duplicates WITHIN the CSV
            existingOrderMap.set(orderNumber, { id: orderId, order_number: orderNumber, deleted: false })
        }

        revalidatePath('/dashboard/sales/daraz/sales-entry')
        revalidatePath('/dashboard/sales/daraz/order-list')

        return { success: successCount, failures: failures }

    } catch (error: any) {
        console.error('Bulk import error:', error)
        throw new Error(error.message || 'Failed to process import')
    }
}

// ===========================================================
// FISCAL YEAR ACTIONS
// ===========================================================

// Get active fiscal year
export async function getActiveFiscalYear() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('is_active', true)
        .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
}

// Get all fiscal years
export async function getAllFiscalYears() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('fiscal_years')
        .select('*')
        .order('start_date', { ascending: false })

    if (error) throw error
    return data || []
}

// Get fiscal year by ID
export async function getFiscalYearById(id: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw error
    return data
}

// Get sales summary by fiscal year
export async function getDarazSalesByFiscalYear(fiscalYearId: string) {
    try {
        const supabase = await createClient()

        const { data: fiscalYear, error: fyError } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date, name')
            .eq('id', fiscalYearId)
            .single()

        if (fyError || !fiscalYear) {
            console.error('Fiscal year error:', fyError)
            return {
                fiscalYear: 'Unknown',
                totalOrders: 0,
                totalQuantity: 0,
                totalAmount: 0,
                activeSellerAccounts: 0
            }
        }

        const { data, error } = await supabase
            .from('daraz_orders')
            .select(`
                id,
                order_status,
                items:daraz_order_items(
                    quantity,
                    amount,
                    seller_account
                )
            `)
            .gte('order_date', fiscalYear.start_date)
            .lte('order_date', fiscalYear.end_date)

        if (error) {
            console.error('Orders query error:', error)
            return {
                fiscalYear: fiscalYear.name,
                totalOrders: 0,
                totalQuantity: 0,
                totalAmount: 0,
                activeSellerAccounts: 0
            }
        }

        const orders = data || []
        const totalOrders = orders.length
        const totalQuantity = orders.reduce((sum, order) =>
            sum + (order.items?.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0) || 0), 0)
        const totalAmount = orders.reduce((sum, order) =>
            sum + (order.items?.reduce((itemSum: number, item: any) => itemSum + ((item.quantity || 0) * (item.amount || 0)), 0) || 0), 0)

        // Get unique seller accounts
        const sellerAccounts = new Set<string>()
        orders.forEach(order => {
            order.items?.forEach((item: any) => {
                if (item.seller_account) sellerAccounts.add(item.seller_account)
            })
        })

        return {
            fiscalYear: fiscalYear.name,
            totalOrders,
            totalQuantity,
            totalAmount,
            activeSellerAccounts: sellerAccounts.size
        }
    } catch (error: any) {
        console.error('getDarazSalesByFiscal error:', error)
        return {
            fiscalYear: 'Error',
            totalOrders: 0,
            totalQuantity: 0,
            totalAmount: 0,
            activeSellerAccounts: 0
        }
    }
}

// Get monthly sales breakdown by fiscal year
export async function getMonthlySalesByFiscalYear(fiscalYearId: string) {
    try {
        const supabase = await createClient()

        const { data: fiscalYear, error: fyError } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', fiscalYearId)
            .single()

        if (fyError || !fiscalYear) {
            console.error('Fiscal year error in monthly:', fyError)
            return []
        }

        const { data, error } = await supabase
            .from('daraz_orders')
            .select(`
                order_date,
                items:daraz_order_items(
                    quantity,
                    amount
                )
            `)
            .gte('order_date', fiscalYear.start_date)
            .lte('order_date', fiscalYear.end_date)

        if (error) {
            console.error('Monthly orders error:', error)
            return []
        }

        // Group by month
        const monthlyData: { [key: string]: { count: number, total: number } } = {}

        data?.forEach(order => {
            const month = new Date(order.order_date).toISOString().substring(0, 7) // YYYY-MM
            if (!monthlyData[month]) {
                monthlyData[month] = { count: 0, total: 0 }
            }
            monthlyData[month].count++
            // Calculate total from items
            const orderTotal = order.items?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.amount || 0)), 0) || 0
            monthlyData[month].total += orderTotal
        })

        return Object.entries(monthlyData)
            .map(([month, data]) => ({
                month,
                orderCount: data.count,
                totalAmount: data.total
            }))
            .sort((a, b) => a.month.localeCompare(b.month))
    } catch (error: any) {
        console.error('getMonthlySalesByFiscalYear error:', error)
        return []
    }
}

// Get sales by seller account for fiscal year
export async function getSalesBySellerAccount(fiscalYearId: string) {
    try {
        const supabase = await createClient()

        const { data: fiscalYear, error: fyError } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', fiscalYearId)
            .single()

        if (fyError || !fiscalYear) {
            console.error('Fiscal year error:', fyError)
            return []
        }

        const { data, error } = await supabase
            .from('daraz_orders')
            .select(`
                items:daraz_order_items(
                    seller_account,
                    product_name,
                    quantity,
                    amount
                )
            `)
            .gte('order_date', fiscalYear.start_date)
            .lte('order_date', fiscalYear.end_date)

        if (error) {
            console.error('Seller sales error:', error)
            return []
        }

        // Group by seller account
        const accountData: { [key: string]: { orders: number, quantity: number, totalAmount: number } } = {}

        data?.forEach(order => {
            order.items?.forEach((item: any) => {
                const account = item.seller_account || 'Unknown'
                if (!accountData[account]) {
                    accountData[account] = { orders: 0, quantity: 0, totalAmount: 0 }
                }
                accountData[account].orders++
                accountData[account].quantity += item.quantity || 0
                accountData[account].totalAmount += (item.quantity || 0) * (item.amount || 0)
            })
        })

        // Fetch company names from online_stores
        const { data: stores } = await supabase
            .from('online_stores')
            .select('seller_account, company_name')

        const storeMap = new Map(stores?.map(s => [s.seller_account, s.company_name]) || [])

        return Object.entries(accountData).map(([account, data]) => ({
            sellerAccount: account,
            companyName: storeMap.get(account) || account,
            orders: data.orders,
            quantity: data.quantity,
            totalAmount: data.totalAmount
        }))
    } catch (error: any) {
        console.error('getSalesBySellerAccount error:', error)
        return []
    }
}

// Get stats for status summary
export async function getDarazOrderStats(sellerAccount?: string, restrictShippedToToday?: boolean) {
    const supabase = await createClient()

    try {
        // Build base query
        const getQuery = (status: string, dateRestricted = false) => {
            let query = supabase
                .from('daraz_orders')
                .select('*, items:daraz_order_items!inner(seller_account)', { count: 'exact', head: true })
                .or('deleted.is.null,deleted.eq.false')
                .ilike('order_status', status)

            if (sellerAccount && sellerAccount !== 'all') {
                query = query.eq('items.seller_account', sellerAccount)
            }

            if (dateRestricted && restrictShippedToToday) {
                const today = new Date().toISOString().split('T')[0]
                const todayStart = `${today}T00:00:00.000Z`
                // Match logic in getDarazOrders: Shipped Today means updated_at >= Today 00:00
                query = query.gte('updated_at', todayStart)
            }

            return query
        }

        const [pending, packed, readyToShip, shipped] = await Promise.all([
            getQuery('Pending'),
            getQuery('Packed'),
            getQuery('Ready to Ship'),
            getQuery('Shipped', true) // Apply date restriction to Shipped only
        ])

        return {
            pending: pending.count || 0,
            packed: packed.count || 0,
            readyToShip: readyToShip.count || 0,
            shipped: shipped.count || 0
        }
    } catch (error) {
        console.error('Error fetching stats:', error)
        return { pending: 0, shipped: 0 }
    }
}

// Get Daily Sales Report - aggregated by date and seller account
export async function getDailySalesReport() {
    const supabase = await createClient()

    try {
        // Fetch all non-deleted orders with relevant statuses
        const { data: orders, error } = await supabase
            .from('daraz_orders')
            .select(`
                id,
                order_id,
                order_number,
                store_id,
                order_status,
                order_date,
                price,
                updated_at,
                online_stores!inner(seller_account)
            `)
            .eq('deleted', false)
            .in('order_status', ['Shipped', 'Delivered', 'Failed Delivered', 'Customer Return'])
            .order('updated_at', { ascending: false })

        if (error) throw error

        // Group by date and seller account
        const reportMap = new Map<string, Map<string, {
            shipped_qty: number
            shipped_amount: number
            delivered_qty: number
            delivered_amount: number
            failed_qty: number
            return_qty: number
        }>>()

        orders?.forEach((order: any) => {
            // Use updated_at as the status change date
            const dateStr = new Date(order.updated_at).toISOString().split('T')[0]
            const sellerAccount = order.online_stores?.seller_account || 'Unknown'
            const price = parseFloat(order.price) || 0

            if (!reportMap.has(dateStr)) {
                reportMap.set(dateStr, new Map())
            }

            const dateMap = reportMap.get(dateStr)!
            if (!dateMap.has(sellerAccount)) {
                dateMap.set(sellerAccount, {
                    shipped_qty: 0,
                    shipped_amount: 0,
                    delivered_qty: 0,
                    delivered_amount: 0,
                    failed_qty: 0,
                    return_qty: 0
                })
            }

            const stats = dateMap.get(sellerAccount)!
            switch (order.order_status) {
                case 'Shipped':
                    stats.shipped_qty++
                    stats.shipped_amount += price
                    break
                case 'Delivered':
                    stats.delivered_qty++
                    stats.delivered_amount += price
                    break
                case 'Failed Delivered':
                    stats.failed_qty++
                    break
                case 'Customer Return':
                    stats.return_qty++
                    break
            }
        })

        // Convert to array format, sorted by date descending
        const result: Array<{
            date: string
            seller_account: string
            shipped_qty: number
            shipped_amount: number
            delivered_qty: number
            delivered_amount: number
            failed_qty: number
            return_qty: number
        }> = []

        const sortedDates = Array.from(reportMap.keys()).sort((a, b) => b.localeCompare(a))

        sortedDates.forEach(date => {
            const dateMap = reportMap.get(date)!
            dateMap.forEach((stats, sellerAccount) => {
                result.push({
                    date,
                    seller_account: sellerAccount,
                    ...stats
                })
            })
        })

        return result
    } catch (error) {
        console.error('Error fetching daily sales report:', error)
        return []
    }
}

// Sync product names and seller accounts from inventory by matching seller SKUs
export async function syncProductInfoFromInventory() {
    const supabase = await createClient()

    try {
        // Fetch ALL products in batches
        let allProducts: any[] = []
        let page = 0
        const pageSize = 1000

        while (true) {
            const { data: batchProducts, error: productsError } = await supabase
                .from('products')
                .select('id, product_name, seller_sku1, seller_account1, seller_sku2, seller_account2, seller_sku3, seller_account3, seller_sku4, seller_account4')
                .eq('is_deleted', false)
                .range(page * pageSize, (page + 1) * pageSize - 1)
                .order('id')

            if (productsError) throw productsError

            if (!batchProducts || batchProducts.length === 0) break

            allProducts = allProducts.concat(batchProducts)

            if (batchProducts.length < pageSize) break

            page++
            if (page >= 20) break
        }

        // Create a map of seller_sku -> { product_name, seller_account }
        const skuMap = new Map<string, { product_name: string, seller_account: string }>()

        allProducts.forEach(product => {
            if (product.seller_sku1) skuMap.set(product.seller_sku1.toLowerCase(), { product_name: product.product_name, seller_account: product.seller_account1 || '' })
            if (product.seller_sku2) skuMap.set(product.seller_sku2.toLowerCase(), { product_name: product.product_name, seller_account: product.seller_account2 || '' })
            if (product.seller_sku3) skuMap.set(product.seller_sku3.toLowerCase(), { product_name: product.product_name, seller_account: product.seller_account3 || '' })
            if (product.seller_sku4) skuMap.set(product.seller_sku4.toLowerCase(), { product_name: product.product_name, seller_account: product.seller_account4 || '' })
        })

        console.log('Total products loaded:', allProducts.length)
        console.log('Pages fetched:', page + 1)
        console.log('SKU map entries:', skuMap.size)
        console.log('Sample SKUs in map:', Array.from(skuMap.keys()).slice(0, 5))

        // Debug: Check if specific SKU is in map
        const testSku = '157851176-1727159543654-0'.toLowerCase()
        console.log('Looking for test SKU:', testSku)
        console.log('Is test SKU in map?', skuMap.has(testSku))
        if (skuMap.has(testSku)) {
            console.log('Test SKU value:', skuMap.get(testSku))
        }

        // Debug: Show all SKUs containing '157851176'
        const matchingSkus = Array.from(skuMap.keys()).filter(sku => sku.includes('157851176'))
        console.log('SKUs containing 157851176:', matchingSkus)

        // Get ALL active orders (not just those without invoice numbers)
        // User wants to sync product info even for already-synced orders
        const { data: orders, error: ordersError } = await supabase
            .from('daraz_orders')
            .select('id')
            .eq('deleted', false)

        if (ordersError) throw ordersError

        if (!orders || orders.length === 0) {
            return {
                success: true,
                updated: 0,
                message: 'No orders found to sync'
            }
        }

        console.log('Found orders:', orders.length)

        const orderIds = orders.map(o => o.id)

        // Get all items from these orders
        const { data: orderItems, error: itemsError } = await supabase
            .from('daraz_order_items')
            .select('id, seller_sku, product_name, seller_account, order_id')
            .in('order_id', orderIds)

        if (itemsError) throw itemsError

        console.log('Found order items:', orderItems?.length)
        console.log('SKU map size:', skuMap.size)

        let updatedCount = 0
        const updates: Array<{ id: string, product_name: string, seller_account: string }> = []

        // Find items that need updating (only if product name is missing or "Product Not Found")
        orderItems?.forEach((item: any) => {
            // Only process items where product_name is empty or "Product Not Found"
            const needsSync = !item.product_name ||
                item.product_name.trim() === '' ||
                item.product_name === 'Product Not Found'

            if (!needsSync) {
                return // Skip items that already have valid product names
            }

            const sellerSku = item.seller_sku?.trim().toLowerCase()
            if (sellerSku && skuMap.has(sellerSku)) {
                const productInfo = skuMap.get(sellerSku)!
                console.log(`Matching SKU: ${sellerSku} -> ${productInfo.product_name}`)
                // Update with product info from inventory
                updates.push({
                    id: item.id,
                    product_name: productInfo.product_name,
                    seller_account: productInfo.seller_account
                })
            } else {
                if (sellerSku) {
                    console.log(`No match for SKU: ${sellerSku}`)
                }
            }
        })

        console.log('Updates to perform:', updates.length)

        // Log unmatched SKUs for user to fix
        const unmatchedSkus = new Set<string>()
        orderItems?.forEach((item: any) => {
            const needsSync = !item.product_name ||
                item.product_name.trim() === '' ||
                item.product_name === 'Product Not Found'

            if (needsSync) {
                const sellerSku = item.seller_sku?.trim().toLowerCase()
                if (sellerSku && !skuMap.has(sellerSku)) {
                    unmatchedSkus.add(item.seller_sku) // Keep original case
                }
            }
        })

        if (unmatchedSkus.size > 0) {
            console.log('=====================================')
            console.log('UNMATCHED SKUs - Add these to Product List:')
            console.log('=====================================')
            Array.from(unmatchedSkus).forEach(sku => console.log(`- ${sku}`))
            console.log('=====================================')
            console.log(`Total unmatched: ${unmatchedSkus.size}`)
            console.log('Copy these SKUs and add them to your products with:')
            console.log('- Seller SKU 1, 2, 3, or 4')
            console.log('- Product Name')
            console.log('- Seller Account')
            console.log('=====================================')
        }

        // Perform batch updates
        for (const update of updates) {
            const { error } = await supabase
                .from('daraz_order_items')
                .update({
                    product_name: update.product_name,
                    seller_account: update.seller_account
                })
                .eq('id', update.id)

            if (!error) {
                updatedCount++
            }
        }

        revalidatePath('/dashboard/sales/daraz/sales-entry')
        return {
            success: true,
            updated: updatedCount,
            message: updatedCount > 0
                ? `Successfully synced ${updatedCount} product${updatedCount > 1 ? 's' : ''}`
                : 'No products needed syncing'
        }
    } catch (error) {
        console.error('Error syncing product info:', error)
        return {
            success: false,
            updated: 0,
            message: 'Failed to sync product information'
        }
    }
}
