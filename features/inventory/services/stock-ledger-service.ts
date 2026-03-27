'use server'

import { createClient } from '@/lib/supabase/server'

export interface StockLedgerItem {
    id: string
    product_name: string
    product_type?: string
    store_stock: number
    auto_adjust: number
    damage_stock: number
    purchase: number
    sales: number
    sales_return: number
    total_stock: number
}

interface LedgerResponse {
    data: StockLedgerItem[]
    totalCount: number
    totalPages: number
    currentPage: number
}

export async function getStockLedger(page = 1, limit = 100, search = ''): Promise<LedgerResponse> {
    const supabase = await createClient()

    // 1. Base Query with Count
    let query = supabase
        .from('stock_ledger_view')
        .select('*', { count: 'exact' })

    // 2. Filter
    if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`
        query = query.ilike('product_name', searchTerm)
    }

    // 3. Optimized Server-Side Sort
    // Order: Positive (desc) -> Negative (desc) -> Zero (last)
    // We achieve this using Postgres CASE logic via raw order string
    query = query.order('total_stock', { 
        ascending: false,
        // Secondary sort to ensure consistent results
        foreignTable: undefined 
    })
    .order('product_name', { ascending: true })

    // 4. Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query.range(from, to)

    if (error) {
        console.error('Error fetching stock_ledger_view:', error)
        throw new Error(error.message)
    }

    if (!data || data.length === 0) {
        return { data: [], totalCount: 0, totalPages: 0, currentPage: page }
    }

    // Map data
    const ledger: StockLedgerItem[] = data.map((item: any) => ({
        id: item.id,
        product_name: item.product_name,
        product_type: item.product_type,
        store_stock: Number(item.store_stock),
        auto_adjust: Number(item.auto_adjust),
        damage_stock: Number(item.damage_stock),
        purchase: Number(item.purchase),
        sales: Number(item.sales),
        sales_return: Number(item.sales_return),
        total_stock: Number(item.total_stock)
    }))

    const totalCount = count || 0
    return {
        data: ledger,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page
    }
}

// Detail View
export interface LedgerDetailItem {
    type: string
    description: string
    date?: string
    qty: number
    effect: 'positive' | 'negative' | 'neutral'
}


export interface StockLedgerDetail {
    id: string
    product_name: string
    product_id: number | null
    seller_sku1: string | null
    seller_sku2: string | null
    seller_sku3: string | null
    seller_sku4: string | null
    opening_stock: number
    manual_adjustment: number
    auto_adjust: number
    damage_stock: number
    purchase: number
    daraz_shipped: number
    daraz_delivered: number
    daraz_returning: number
    daraz_customer_return: number
    daraz_returned_delivered: number
    marketplace_shipped: number
    marketplace_delivered: number
    marketplace_fail_delivered: number
    store_sales: number
    total_stock: number
}

export async function getProductStockDetails(productId: string): Promise<StockLedgerDetail | null> {
    const supabase = await createClient()

    // 1. Fetch Product Details
    const { data: product, error } = await supabase
        .from('products')
        .select('id, product_name, product_id, product_type, seller_sku1, seller_sku2, seller_sku3, seller_sku4')
        .eq('id', productId)
        .single()

    if (error || !product) {
        return null
    }

    // 2. Fetch Direct Data (Parallel)
    const [
        openingStats,
        manualStats,
        damageStats,
        purchaseStats,
        darazItems,
        marketplaceItems,
        storeItems,
        // Auto Adjust: Combo Sales where THIS product is a component
        darazComboSales,
        marketplaceComboSales,
        storeComboSales
    ] = await Promise.all([
        // Direct Adjustments
        supabase.from('opening_stocks').select('quantity').eq('product_id', productId),
        supabase.from('manual_adjustments').select('quantity').eq('product_id', productId),
        supabase.from('damaged_stocks').select('quantity').eq('product_id', productId).eq('status', 'Damaged'),
        supabase.from('purchases').select('quantity').eq('product_id', productId),

        // Sales Data
        supabase.from('daraz_order_items')
            .select('quantity, item_status, order:daraz_orders!inner(order_status)')
            .eq('product_id', productId),
        supabase.from('marketplace_order_items')
            .select('quantity, item_status, order:marketplace_orders!inner(order_status)')
            .eq('product_id', productId),
        supabase.from('store_sales_items')
            .select('qty')
            .eq('product_id', productId),

        // Auto Adjust Queries: Find sales of PARENT combos where this product is a child
        supabase.from('daraz_order_items')
            .select(`
                quantity,
                order:daraz_orders!inner(order_status),
                product:products!inner(
                    product_combos!product_combos_parent_product_id_fkey(
                        child_product_id,
                        quantity
                    )
                )
            `)
            .eq('product.product_combos.child_product_id', productId),

        supabase.from('marketplace_order_items')
            .select(`
                quantity,
                order:marketplace_orders!inner(order_status),
                product:products!inner(
                    product_combos!product_combos_parent_product_id_fkey(
                        child_product_id,
                        quantity
                    )
                )
            `)
            .eq('product.product_combos.child_product_id', productId),

        supabase.from('store_sales_items')
            .select(`
                qty,
                product:products!inner(
                    product_combos!product_combos_parent_product_id_fkey(
                        child_product_id,
                        quantity
                    )
                )
            `)
            .eq('product.product_combos.child_product_id', productId)
    ])

    // 3. Aggregate Basic Metrics
    const openingStock = openingStats.data?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
    const manualAdjustment = manualStats.data?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
    const damageStock = damageStats.data?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
    const purchase = purchaseStats.data?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
    const storeSales = storeItems.data?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0

    // 4. Aggregate Sales by Status
    let darazShipped = 0
    let darazDelivered = 0
    let darazReturning = 0
    let darazCustomerReturn = 0
    let darazReturnedDelivered = 0

    darazItems.data?.forEach((item: any) => {
        const qty = item.quantity || 0
        const sRaw = item.item_status || item.order?.order_status
        const status = sRaw ? sRaw.toString().trim().toLowerCase() : ''

        // Count in detailed buckets for UI
        if (status === 'shipped') {
            darazShipped += qty
        }
        else if (status === 'delivered') {
            darazDelivered += qty
        }
        else if (['returning to seller', 'returning_to_seller'].includes(status)) {
            darazReturning += qty
        }
        else if (['customer return', 'customer_return'].includes(status)) {
            darazCustomerReturn += qty
        }
        else if (['returned delivered', 'returned_delivered', 'customer return delivered', 'customer_return_delivered', 'return delivered', 'returned', 'fail delivered', 'delivery failed'].includes(status)) {
            darazReturnedDelivered += qty // Bucket "Returned Delivered" for display totals
        }
    })

    let marketplaceShipped = 0
    let marketplaceDelivered = 0
    let marketplaceFailDelivered = 0

    marketplaceItems.data?.forEach((item: any) => {
        const qty = item.quantity || 0
        const sRaw = item.order?.order_status
        const status = sRaw ? sRaw.toString().trim().toLowerCase() : ''

        if (status === 'shipped') marketplaceShipped += qty
        else if (status === 'delivered') marketplaceDelivered += qty
        else if (['fail delivered', 'delivery failed', 'returned to seller'].includes(status)) marketplaceFailDelivered += qty
    })

    // 5. Calculate Auto Adjust
    let autoAdjust = 0

    const processAutoAdjust = (items: any[], qtyKey: string, hasOrder: boolean) => {
        items?.forEach((item: any) => {
            const parentSoldQty = item[qtyKey] || 0
            const sRaw = item.order?.order_status
            const status = sRaw ? sRaw.toString().trim().toLowerCase() : ''

            // The query returns product_combos array. Find the entry for THIS child product.
            const comboEntry = item.product?.product_combos?.find((c: any) => c.child_product_id === productId)
            const quantityInCombo = comboEntry?.quantity || 0
            const totalStockChange = parentSoldQty * quantityInCombo

            if (!hasOrder) {
                // Store sales: reduce stock
                autoAdjust -= totalStockChange
            } else if (['shipped', 'delivered', 'returning to seller', 'returning_to_seller'].includes(status)) {
                // Sales: reduce stock
                autoAdjust -= totalStockChange
            } else if (['fail delivered', 'delivery failed', 'returned delivered', 'returned_delivered', 'customer return', 'customer_return', 'customer return delivered', 'customer_return_delivered', 'return delivered', 'returned'].includes(status)) {
                // Returns: increase stock
                autoAdjust += totalStockChange
            }
        })
    }

    processAutoAdjust(darazComboSales.data || [], 'quantity', true)
    processAutoAdjust(marketplaceComboSales.data || [], 'quantity', true)
    processAutoAdjust(storeComboSales.data || [], 'qty', false)

    // 6. Calculate Total Stock
    // Rule: Combo/Variation products always show 0
    const isComboOrVariation = product.product_type === 'combo' || product.product_type === 'variation'

    // Sales Sum (Green items) for formula: Sales
    // Must include Shipped, Delivered, ALL Returning (Transit), AND Returned items (to offset the Return Add-back)
    const totalSalesForFormula = datSum(darazShipped, darazDelivered, darazReturning, darazCustomerReturn, darazReturnedDelivered) +
        datSum(marketplaceShipped, marketplaceDelivered, marketplaceFailDelivered) + storeSales

    // Sales Return Sum (Red items) for formula: Sales Return
    const totalReturnsForFormula = datSum(darazReturnedDelivered) + marketplaceFailDelivered

    const storeStock = openingStock + manualAdjustment

    // Formula from main ledger: 
    // total_stock = store_stock + purchase + sales_return + auto_adjust - damage_stock - sales
    const calculatedTotal = storeStock + purchase + totalReturnsForFormula + autoAdjust - damageStock - totalSalesForFormula
    const totalStock = isComboOrVariation ? 0 : calculatedTotal

    return {
        id: product.id,
        product_name: product.product_name,
        product_id: product.product_id,
        seller_sku1: product.seller_sku1,
        seller_sku2: product.seller_sku2,
        seller_sku3: product.seller_sku3,
        seller_sku4: product.seller_sku4,
        opening_stock: openingStock,
        manual_adjustment: manualAdjustment,
        auto_adjust: autoAdjust,
        damage_stock: damageStock,
        purchase: purchase,
        daraz_shipped: darazShipped,
        daraz_delivered: darazDelivered,
        daraz_returning: darazReturning,
        daraz_customer_return: darazCustomerReturn,
        daraz_returned_delivered: darazReturnedDelivered,
        marketplace_shipped: marketplaceShipped,
        marketplace_delivered: marketplaceDelivered,
        marketplace_fail_delivered: marketplaceFailDelivered,
        store_sales: storeSales,
        total_stock: totalStock
    }
}

// Helper to sum numbers safely
function datSum(...args: number[]) {
    return args.reduce((a, b) => a + (b || 0), 0)
}
