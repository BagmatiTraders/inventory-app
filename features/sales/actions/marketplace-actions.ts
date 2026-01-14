'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface MarketplaceOrder {
    id: string
    sales_id: string
    order_date: string
    customer_name: string
    phone_number: string
    address?: string
    delivery_branch_id?: string
    courier_id?: string // Added courier_id
    branch_charge: number
    delivery_charge: number
    total_amount: number
    order_status: 'Pending' | 'Shipped' | 'Delivered' | 'Fail Delivered' | 'Cancel'
    user_type: string
    remarks?: string
    created_at: string
    created_by?: string
    updated_at?: string
    updated_by?: string
    shipped_at?: string
    shipped_by?: string
    delivered_at?: string
    delivered_by?: string
    failed_delivered_at?: string
    failed_delivered_by?: string
    cancelled_at?: string
    cancelled_by?: string
    // Relations
    courier?: {           // Added courier relation
        id: string
        courier_name: string
    }
}

export interface MarketplaceOrderItem {
    id: string
    order_id: string
    product_id?: string
    product_name: string
    quantity: number
    amount: number
}

export interface CreateMarketplaceOrderData {
    order_date?: string
    customer_name: string
    phone_number: string
    address?: string
    delivery_branch_id?: string
    courier_id?: string // Added courier_id
    branch_charge?: number
    delivery_charge: number
    order_status?: string
    remarks?: string
    items: Array<{
        product_id?: string
        product_name: string
        quantity: number
        amount: number
    }>
}

// ============================================================================
// SALES ID GENERATION
// ============================================================================

/**
 * Generate next Sales ID in format MMDD-10001
 * @param orderDate - Date for the order (defaults to today)
 * @returns Generated Sales ID
 */
export async function generateSalesId(orderDate?: string): Promise<string> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .rpc('generate_marketplace_sales_id', {
            for_date: orderDate || new Date().toISOString().split('T')[0]
        })

    if (error) {
        console.error('Error generating sales ID:', error)
        // Fallback to manual generation if function fails
        const date = new Date(orderDate || Date.now())
        const prefix = (date.getMonth() + 1).toString().padStart(2, '0') + date.getDate().toString().padStart(2, '0')
        const random = Math.floor(Math.random() * 90000) + 10001
        return `${prefix}-${random}`
    }

    return data
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Create a new marketplace order with items
 */
export async function createMarketplaceOrder(data: CreateMarketplaceOrderData) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Calculate total amount
    const itemsTotal = data.items.reduce((sum, item) => sum + (item.quantity * item.amount), 0)
    const totalAmount = itemsTotal + (data.delivery_charge || 0)

    // Generate Sales ID
    const salesId = await generateSalesId(data.order_date)

    // Create order
    const { data: order, error: orderError } = await supabase
        .from('marketplace_orders')
        .insert({
            sales_id: salesId,
            order_date: data.order_date || new Date().toISOString().split('T')[0],
            customer_name: data.customer_name,
            phone_number: data.phone_number,
            address: data.address,
            delivery_branch_id: data.delivery_branch_id,
            courier_id: data.courier_id, // Added courier_id
            branch_charge: data.branch_charge || 0,
            delivery_charge: data.delivery_charge || 0,
            total_amount: totalAmount,
            order_status: data.order_status || 'Pending',
            user_type: 'ALL',
            remarks: data.remarks,
            created_by: user.id
        })
        .select()
        .single()

    if (orderError) throw orderError

    // Create order items
    const itemsToInsert = data.items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        amount: item.amount
    }))

    const { error: itemsError } = await supabase
        .from('marketplace_order_items')
        .insert(itemsToInsert)

    if (itemsError) throw itemsError

    revalidatePath('/dashboard/sales/marketplace')
    revalidatePath('/dashboard/profile')

    return { success: true, order, message: 'Order created successfully' }
}

// ============================================================================
// READ
// ============================================================================

interface GetMarketplaceOrdersFilters {
    page?: number
    limit?: number
    search?: string
    status?: string
    startDate?: string
    endDate?: string
    showTodayAndPending?: boolean // Special filter for Sales Entry page
    fiscalYearId?: string
}

/**
 * Get marketplace orders with optional filtering
 */
export async function getMarketplaceOrders(filters: GetMarketplaceOrdersFilters = {}) {
    const supabase = await createClient()
    const {
        page = 1,
        limit = 50,
        search,
        status,
        startDate,
        endDate,
        showTodayAndPending = false,
        fiscalYearId
    } = filters

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
        .from('marketplace_orders')
        .select(`
            *,
            items:marketplace_order_items(*),
            branch:courier_locations!fk_marketplace_courier_branch(branch_name),
            courier:couriers(id, courier_name),
            created_user:user_profiles!marketplace_orders_created_by_fkey(full_name),
            updated_user:user_profiles!marketplace_orders_updated_by_fkey(full_name),
            shipped_user:user_profiles!marketplace_orders_shipped_by_fkey(full_name),
            delivered_user:user_profiles!marketplace_orders_delivered_by_fkey(full_name),
            failed_delivered_user:user_profiles!marketplace_orders_failed_delivered_by_fkey(full_name),
            returned_to_seller_user:user_profiles!marketplace_orders_returned_to_seller_by_fkey(full_name),
            customer_return_user:user_profiles!marketplace_orders_customer_return_by_fkey(full_name),
            return_delivered_user:user_profiles!marketplace_orders_return_delivered_by_fkey(full_name),
            cancelled_user:user_profiles!marketplace_orders_cancelled_by_fkey(full_name)
        `, { count: 'exact' })

    // Special filter for Sales Entry page
    if (showTodayAndPending) {
        const today = new Date().toISOString().split('T')[0]

        // Show Pending orders from ANY date
        // OR Shipped orders updated/shipped TODAY
        // Using raw PostgREST syntax for complex logic
        query = query.or(`order_status.eq.Pending,and(order_status.eq.Shipped,shipped_at.gte.${today}T00:00:00)`)
    }

    // Fiscal Year Filter
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
    }

    // Date range filter
    if (startDate) {
        query = query.gte('order_date', startDate)
    }
    if (endDate) {
        query = query.lte('order_date', endDate)
    }

    // Status filter
    if (status && status !== 'all') {
        query = query.eq('order_status', status)
    }

    // Search filter (customer name, phone, sales_id)
    if (search && search.trim()) {
        query = query.or(`customer_name.ilike.%${search.trim()}%,phone_number.ilike.%${search.trim()}%,sales_id.ilike.%${search.trim()}%`)
    }

    // Ordering and pagination
    query = query
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

    const { data: orders, count, error } = await query

    if (error) throw error

    return {
        orders: orders || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page
    }
}

/**
 * Get single marketplace order with details
 */
export async function getMarketplaceOrderById(id: string) {
    const supabase = await createClient()

    const { data: order, error } = await supabase
        .from('marketplace_orders')
        .select(`
            *,
            items:marketplace_order_items(*),
            branch:courier_locations!fk_marketplace_courier_branch(branch_name, delivery_charge),
            courier:couriers(id, courier_name),
            created_user:user_profiles!marketplace_orders_created_by_fkey(full_name),
            updated_user:user_profiles!marketplace_orders_updated_by_fkey(full_name),
            shipped_user:user_profiles!marketplace_orders_shipped_by_fkey(full_name),
            delivered_user:user_profiles!marketplace_orders_delivered_by_fkey(full_name),
            failed_delivered_user:user_profiles!marketplace_orders_failed_delivered_by_fkey(full_name),
            returned_to_seller_user:user_profiles!marketplace_orders_returned_to_seller_by_fkey(full_name),
            customer_return_user:user_profiles!marketplace_orders_customer_return_by_fkey(full_name),
            return_delivered_user:user_profiles!marketplace_orders_return_delivered_by_fkey(full_name),
            cancelled_user:user_profiles!marketplace_orders_cancelled_by_fkey(full_name)
        `)
        .eq('id', id)
        .single()

    if (error) throw error

    return order
}

// ============================================================================
// UPDATE
// ============================================================================

interface UpdateMarketplaceOrderData {
    customer_name?: string
    phone_number?: string
    address?: string
    delivery_branch_id?: string
    // courier_id?: string  <-- Intentionally omitted to prevent edits
    branch_charge?: number
    delivery_charge?: number
    order_status?: string
    remarks?: string
    items?: Array<{
        product_id?: string
        product_name: string
        quantity: number
        amount: number
    }>
}

/**
 * Update marketplace order (handles timestamp tracking)
 */
export async function updateMarketplaceOrder(id: string, data: UpdateMarketplaceOrderData) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get current order to check status changes
    const { data: currentOrder } = await supabase
        .from('marketplace_orders')
        .select('order_status')
        .eq('id', id)
        .single()

    if (!currentOrder) throw new Error('Order not found')

    // Prepare update data
    // Remove items from the data object effectively
    const { items, ...orderUpdateData } = data

    const updateData: any = {
        ...orderUpdateData,
        updated_by: user.id
    }

    // Handle status-specific timestamp updates
    if (data.order_status && data.order_status !== currentOrder.order_status) {
        const now = new Date().toISOString()

        if (data.order_status === 'Shipped') {
            updateData.shipped_at = now
            updateData.shipped_by = user.id
        } else if (data.order_status === 'Delivered') {
            updateData.delivered_at = now
            updateData.delivered_by = user.id
        } else if (data.order_status === 'Returning to Seller') {
            updateData.returned_to_seller_at = now
            updateData.returned_to_seller_by = user.id
        } else if (data.order_status === 'Fail Delivered') {
            updateData.failed_delivered_at = now
            updateData.failed_delivered_by = user.id
        } else if (data.order_status === 'Customer Return') {
            updateData.customer_return_at = now
            updateData.customer_return_by = user.id
        } else if (data.order_status === 'Return Delivered') {
            updateData.return_delivered_at = now
            updateData.return_delivered_by = user.id
        } else if (data.order_status === 'Cancel') {
            updateData.cancelled_at = now
            updateData.cancelled_by = user.id
        }
    }

    // Calculate new total if items changed
    if (items) {
        const itemsTotal = items.reduce((sum, item) => sum + (item.quantity * item.amount), 0)
        updateData.total_amount = itemsTotal + (data.delivery_charge || 0)

        // Delete existing items and insert new ones
        await supabase
            .from('marketplace_order_items')
            .delete()
            .eq('order_id', id)

        const itemsToInsert = items.map(item => ({
            order_id: id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            amount: item.amount
        }))

        await supabase
            .from('marketplace_order_items')
            .insert(itemsToInsert)
    }

    // Update order
    const { data: updatedOrder, error } = await supabase
        .from('marketplace_orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error

    revalidatePath('/dashboard/sales/marketplace')

    return { success: true, order: updatedOrder, message: 'Order updated successfully' }
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Delete marketplace order (cascade deletes items)
 */
export async function deleteMarketplaceOrder(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('marketplace_orders')
        .delete()
        .eq('id', id)

    if (error) throw error

    revalidatePath('/dashboard/sales/marketplace')

    return { success: true, message: 'Order deleted successfully' }
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Export marketplace orders to CSV format
 */
export async function exportMarketplaceOrders(filters: GetMarketplaceOrdersFilters = {}) {
    const { orders } = await getMarketplaceOrders({ ...filters, limit: 10000 })

    return orders.map(order => ({
        'Sales ID': order.sales_id,
        'Date': order.order_date,
        'Customer Name': order.customer_name,
        'Phone': order.phone_number,
        'Product Name': order.items?.map((item: any) => item.product_name).join(', ') || '',
        'Address': order.address || '',
        'Branch': order.branch?.branch_name || '',
        'Courier': order.courier?.courier_name || '', // Added courier to export
        'Branch Charge': order.branch_charge,
        'Delivery Charge': order.delivery_charge,
        'Total Amount': order.total_amount,
        'Status': order.order_status,
        'Remarks': order.remarks || '',
        'Created At': order.created_at
    }))
}

// ============================================================================
// REPORTING
// ============================================================================

/**
 * Get Marketplace sales summary by fiscal year
 */
export async function getMarketplaceSalesByFiscalYear(fiscalYearId: string) {
    try {
        const supabase = await createClient()

        const { data: fiscalYear, error: fyError } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date, name')
            .eq('id', fiscalYearId)
            .single()

        if (fyError || !fiscalYear) throw new Error('Fiscal year not found')

        const { data, error } = await supabase
            .from('marketplace_orders')
            .select('id, items:marketplace_order_items(quantity, amount)')
            .gte('order_date', fiscalYear.start_date)
            .lte('order_date', fiscalYear.end_date)
            .neq('order_status', 'Cancel') // Exclude cancelled orders

        if (error) {
            console.error('Orders query error:', error)
            return {
                fiscalYear: fiscalYear.name,
                totalOrders: 0,
                totalQuantity: 0,
                totalAmount: 0
            }
        }

        const orders = data || []
        const totalOrders = orders.length
        const totalQuantity = orders.reduce((sum, order) =>
            sum + (order.items?.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0) || 0), 0)
        const totalAmount = orders.reduce((sum, order) =>
            sum + (order.items?.reduce((itemSum: number, item: any) => itemSum + ((item.quantity || 0) * (item.amount || 0)), 0) || 0), 0)

        return {
            fiscalYear: fiscalYear.name,
            totalOrders,
            totalQuantity,
            totalAmount
        }
    } catch (error: any) {
        console.error('getMarketplaceSalesByFiscalYear error:', error)
        return {
            fiscalYear: 'Error',
            totalOrders: 0,
            totalQuantity: 0,
            totalAmount: 0
        }
    }
}

/**
 * Get Marketplace monthly sales breakdown by fiscal year
 */
export async function getMarketplaceMonthlySalesByFiscalYear(fiscalYearId: string) {
    try {
        const supabase = await createClient()

        const { data: fiscalYear, error: fyError } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', fiscalYearId)
            .single()

        if (fyError || !fiscalYear) return []

        const { data, error } = await supabase
            .from('marketplace_orders')
            .select(`
                order_date,
                items:marketplace_order_items(quantity, amount)
            `)
            .gte('order_date', fiscalYear.start_date)
            .lte('order_date', fiscalYear.end_date)
            .neq('order_status', 'Cancel')

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
        console.error('getMarketplaceMonthlySalesByFiscalYear error:', error)
        return []
    }
}

/**
 * Get Marketplace daily sales breakdown by fiscal year (Day by Day)
 */
export async function getMarketplaceDailySalesByFiscalYear(fiscalYearId: string) {
    try {
        const supabase = await createClient()

        const { data: fiscalYear, error: fyError } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', fiscalYearId)
            .single()

        if (fyError || !fiscalYear) return []

        const { data, error } = await supabase
            .from('marketplace_orders')
            .select(`
                order_date,
                items:marketplace_order_items(quantity, amount)
            `)
            .gte('order_date', fiscalYear.start_date)
            .lte('order_date', fiscalYear.end_date)
            .neq('order_status', 'Cancel')
            .order('order_date', { ascending: false })

        if (error) {
            console.error('Daily sales error:', error)
            return []
        }

        // Group by date
        const dailyData: { [key: string]: { count: number, quantity: number, total: number } } = {}

        data?.forEach(order => {
            const date = order.order_date
            if (!dailyData[date]) {
                dailyData[date] = { count: 0, quantity: 0, total: 0 }
            }
            dailyData[date].count++

            const orderQty = order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0
            const orderTotal = order.items?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.amount || 0)), 0) || 0

            dailyData[date].quantity += orderQty
            dailyData[date].total += orderTotal
        })

        return Object.entries(dailyData)
            .map(([date, data]) => ({
                date,
                orderCount: data.count,
                quantity: data.quantity,
                totalAmount: data.total
            }))
            .sort((a, b) => b.date.localeCompare(a.date)) // Descending by date
    } catch (error: any) {
        console.error('getMarketplaceDailySalesByFiscalYear error:', error)
        return []
    }
}

/**
 * Find a single marketplace order by key
 */
export async function findMarketplaceOrder(key: 'order_number' | 'phone_number', value: string) {
    const supabase = await createClient()

    // Note: marketplace_orders uses 'sales_id' as the human-readable ID, not 'order_number'. 
    // The user requested "Order Number" but in Marketplace context that is likely 'sales_id'.
    // I will map 'order_number' to 'sales_id' for query.

    const searchField = key === 'order_number' ? 'sales_id' : 'phone_number'

    const { data, error } = await supabase
        .from('marketplace_orders')
        .select(`
            *,
            items:marketplace_order_items(*),
            created_user:user_profiles!marketplace_orders_created_by_fkey(full_name),
            updated_user:user_profiles!marketplace_orders_updated_by_fkey(full_name),
            shipped_user:user_profiles!marketplace_orders_shipped_by_fkey(full_name),
            delivered_user:user_profiles!marketplace_orders_delivered_by_fkey(full_name),
            failed_delivered_user:user_profiles!marketplace_orders_failed_delivered_by_fkey(full_name),
            returned_to_seller_user:user_profiles!marketplace_orders_returned_to_seller_by_fkey(full_name),
            customer_return_user:user_profiles!marketplace_orders_customer_return_by_fkey(full_name),
            return_delivered_user:user_profiles!marketplace_orders_return_delivered_by_fkey(full_name),
            cancelled_user:user_profiles!marketplace_orders_cancelled_by_fkey(full_name)
        `)
        .eq(searchField, value.trim())
        .limit(1) // Just take one if multiple match (e.g. phone number)
        .single()

    if (error) {
        // Returns null if not found
        return null
    }

    return data
}

/**
 * Bulk update marketplace order status
 */
export async function updateMarketplaceOrderStatus(ids: string[], status: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const now = new Date().toISOString()
    const updateData: any = {
        order_status: status,
        updated_by: user.id,
        updated_at: now
    }

    // Handle timestamps
    if (status === 'Shipped') {
        updateData.shipped_at = now
        updateData.shipped_by = user.id
    } else if (status === 'Delivered') {
        updateData.delivered_at = now
        updateData.delivered_by = user.id
    } else if (status === 'Returning to Seller') {
        updateData.returned_to_seller_at = now
        updateData.returned_to_seller_by = user.id
    } else if (status === 'Fail Delivered') {
        updateData.failed_delivered_at = now
        updateData.failed_delivered_by = user.id
    } else if (status === 'Customer Return') {
        updateData.customer_return_at = now
        updateData.customer_return_by = user.id
    } else if (status === 'Return Delivered') {
        updateData.return_delivered_at = now
        updateData.return_delivered_by = user.id
    } else if (status === 'Cancel') {
        updateData.cancelled_at = now
        updateData.cancelled_by = user.id
    }

    const { error } = await supabase
        .from('marketplace_orders')
        .update(updateData)
        .in('id', ids)

    if (error) throw error

    revalidatePath('/dashboard/sales/marketplace')
    return { success: true }
}
// ============================================================================
// IMPORT
// ============================================================================

/**
 * Bulk import marketplace orders from CSV data
 */
export async function bulkImportMarketplaceOrders(rows: any[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // 1. Fetch Couriers for matching
    const { data: couriers } = await supabase
        .from('couriers')
        .select('id, courier_name, is_active')

    // Find active courier for default
    const activeCourier = couriers?.find(c => c.is_active)

    // Create a map for name lookup (case-insensitive)
    const courierMap = new Map()
    couriers?.forEach(c => {
        courierMap.set(c.courier_name.toLowerCase(), c.id)
    })

    const results = {
        success: 0,
        failures: [] as any[]
    }

    // Process rows sequentially to generate proper Sales IDs
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]

        try {
            // Determine Courier ID
            let courierId = activeCourier?.id // Default to active
            const rowCourierName = row['Courier'] || row['courier'] // Check both cases

            if (rowCourierName && rowCourierName.trim()) {
                const foundId = courierMap.get(rowCourierName.trim().toLowerCase())
                if (foundId) {
                    courierId = foundId
                }
            }

            // Generate Sales ID
            // If date is provided utilize it, otherwise use today
            // Expecting date format YYYY-MM-DD
            const orderDate = row['Date'] || row['Order Date'] || new Date().toISOString().split('T')[0]
            const salesId = await generateSalesId(orderDate)

            // Parse Amounts
            const quantity = parseInt(row['Quantity'] || '1') || 1
            const amount = parseFloat(row['Amount'] || row['Price'] || '0')
            const deliveryCharge = parseFloat(row['Delivery Charge'] || '0')
            const branchCharge = parseFloat(row['Branch Charge'] || '0')

            const totalAmount = (quantity * amount) + deliveryCharge

            // Create Order
            const { data: order, error: orderError } = await supabase
                .from('marketplace_orders')
                .insert({
                    sales_id: salesId,
                    order_date: orderDate,
                    customer_name: row['Customer Name'] || row['Customer'],
                    phone_number: row['Phone'] || row['Phone Number'] || '',
                    address: row['Address'] || '',
                    courier_id: courierId,
                    branch_charge: branchCharge,
                    delivery_charge: deliveryCharge,
                    total_amount: totalAmount,
                    order_status: row['Status'] || 'Pending',
                    user_type: 'ALL',
                    remarks: row['Remarks'] || 'Imported via CSV',
                    created_by: user.id
                })
                .select()
                .single()

            if (orderError) throw orderError

            // Create Order Item
            // Note: Import usually implies single item per row for simple CSVs. 
            // If multi-item support is needed, CSV structure would be complex.
            // Assuming 1 row = 1 order with 1 item for now as per common flat CSV structures.
            await supabase
                .from('marketplace_order_items')
                .insert({
                    order_id: order.id,
                    product_name: row['Product Name'] || row['Product'] || 'Unknown Product',
                    quantity: quantity,
                    amount: amount
                })

            results.success++

        } catch (error: any) {
            console.error(`Row ${i + 1} Error:`, error)
            results.failures.push({
                row: i + 1,
                reason: error.message || 'Unknown error',
                data: row
            })
        }
    }

    revalidatePath('/dashboard/sales/marketplace')

    return results
}
