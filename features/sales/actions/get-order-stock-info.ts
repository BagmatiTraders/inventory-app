'use server'

import { createClient } from '@/lib/supabase/server'

export interface ProductStockInfo {
    product_id: string
    product_name: string
    total_stock: number
}

export interface OrderStockInfo {
    order_id: string
    products: ProductStockInfo[]
    in_stock_count: number
    total_count: number
}

/**
 * Get stock information for products in multiple orders
 * This reuses the stock calculation logic from stock-ledger-service
 */
export async function getOrdersStockInfo(orderIds: string[]): Promise<Record<string, OrderStockInfo>> {
    if (!orderIds || orderIds.length === 0) {
        return {}
    }

    const supabase = await createClient()

    // 1. Fetch all order items for the given orders
    const { data: orderItems, error: itemsError } = await supabase
        .from('daraz_order_items')
        .select(`
            order_id,
            product_id,
            quantity,
            product:products!inner(
                id,
                product_name,
                product_type
            )
        `)
        .in('order_id', orderIds)

    if (itemsError) {
        console.error('Error fetching order items:', itemsError)
        return {}
    }

    if (!orderItems || orderItems.length === 0) {
        return {}
    }

    // 2. Get unique product IDs
    const productIds = [...new Set(orderItems.map(item => item.product_id))]

    // 3. Calculate stock for each product (batch processing)
    const stockMap = await calculateProductStocks(productIds)

    // 4. Group by order and build response
    const result: Record<string, OrderStockInfo> = {}

    orderIds.forEach(orderId => {
        const items = orderItems.filter(item => item.order_id === orderId)

        const products: ProductStockInfo[] = items.map(item => {
            const product = item.product as any
            return {
                product_id: item.product_id,
                product_name: product?.product_name || 'Unknown Product',
                total_stock: stockMap.get(item.product_id) || 0
            }
        })

        const in_stock_count = products.filter(p => p.total_stock > 0).length

        result[orderId] = {
            order_id: orderId,
            products,
            in_stock_count,
            total_count: products.length
        }
    })

    return result
}

/**
 * Calculate total stock for multiple products
 * Uses the same logic as stock-ledger-service
 */
async function calculateProductStocks(productIds: string[]): Promise<Map<string, number>> {
    const supabase = await createClient()
    const stockMap = new Map<string, number>()

    if (productIds.length === 0) return stockMap

    // Fetch products info
    const { data: products } = await supabase
        .from('products')
        .select('id, product_type')
        .in('id', productIds)
        .eq('is_deleted', false)

    if (!products) return stockMap

    // Fetch all related data in parallel
    const [
        openingStocks,
        manualAdjustments,
        damagedStocks,
        purchases,
        darazOrderItems,
        marketplaceOrderItems,
        storeSalesItems,
        darazComboSales,
        marketplaceComboSales,
        storeComboSales
    ] = await Promise.all([
        supabase.from('opening_stocks').select('product_id, quantity').in('product_id', productIds),
        supabase.from('manual_adjustments').select('product_id, quantity').in('product_id', productIds),
        supabase.from('damaged_stocks').select('product_id, quantity').eq('status', 'Damaged').in('product_id', productIds),
        supabase.from('purchases').select('product_id, quantity').in('product_id', productIds),
        supabase.from('daraz_order_items')
            .select('product_id, quantity, item_status, order:daraz_orders!inner(order_status)')
            .in('product_id', productIds),
        supabase.from('marketplace_order_items')
            .select('product_id, quantity, item_status, order:marketplace_orders!inner(order_status)')
            .in('product_id', productIds),
        supabase.from('store_sales_items')
            .select('product_id, qty')
            .in('product_id', productIds),
        supabase.from('daraz_order_items')
            .select(`
                quantity,
                order:daraz_orders!inner(order_status),
                product:products!inner(
                    id,
                    product_combos!product_combos_parent_product_id_fkey(
                        child_product_id,
                        quantity
                    )
                )
            `)
            .eq('product.product_type', 'combo'),
        supabase.from('marketplace_order_items')
            .select(`
                quantity,
                order:marketplace_orders!inner(order_status),
                product:products!inner(
                    id,
                    product_combos!product_combos_parent_product_id_fkey(
                        child_product_id,
                        quantity
                    )
                )
            `)
            .eq('product.product_type', 'combo'),
        supabase.from('store_sales_items')
            .select(`
                qty,
                product:products!inner(
                    id,
                    product_combos!product_combos_parent_product_id_fkey(
                        child_product_id,
                        quantity
                    )
                )
            `)
            .eq('product.product_type', 'combo')
    ])

    // Calculate auto adjust for component products
    const autoAdjustMap = new Map<string, number>()

    const processComboSales = (items: any[], qtyKey: string, hasOrder: boolean) => {
        items?.forEach((item: any) => {
            const soldQty = item[qtyKey] || 0
            const status = item.order?.order_status
            const components = item.product?.product_combos || []

            let stockEffect: 'positive' | 'negative' | 'neutral' = 'neutral'
            if (!hasOrder) {
                stockEffect = 'negative'
            } else if (['Shipped', 'Delivered', 'Returning to Seller'].includes(status)) {
                stockEffect = 'negative'
            } else if (['Fail Delivered', 'Returned Delivered', 'Customer Return', 'Customer Return Delivered'].includes(status)) {
                stockEffect = 'positive'
            }

            components.forEach((comp: any) => {
                const childProductId = comp.child_product_id
                const componentQty = comp.quantity || 0
                const totalAdjustment = soldQty * componentQty

                if (stockEffect === 'negative') {
                    autoAdjustMap.set(childProductId, (autoAdjustMap.get(childProductId) || 0) - totalAdjustment)
                } else if (stockEffect === 'positive') {
                    autoAdjustMap.set(childProductId, (autoAdjustMap.get(childProductId) || 0) + totalAdjustment)
                }
            })
        })
    }

    processComboSales(darazComboSales.data || [], 'quantity', true)
    processComboSales(marketplaceComboSales.data || [], 'quantity', true)
    processComboSales(storeComboSales.data || [], 'qty', false)

    // Group data by product ID
    const groupByProduct = (items: any[]) => {
        const map = new Map<string, any[]>()
        items?.forEach(item => {
            const pid = item.product_id
            if (!map.has(pid)) map.set(pid, [])
            map.get(pid)?.push(item)
        })
        return map
    }

    const openingMap = groupByProduct(openingStocks.data || [])
    const manualMap = groupByProduct(manualAdjustments.data || [])
    const damageMap = groupByProduct(damagedStocks.data || [])
    const purchaseMap = groupByProduct(purchases.data || [])
    const darazMap = groupByProduct(darazOrderItems.data || [])
    const marketplaceMap = groupByProduct(marketplaceOrderItems.data || [])
    const storeMap = groupByProduct(storeSalesItems.data || [])

    // Calculate stock for each product
    products.forEach(product => {
        const pid = product.id

        // Store Stock = Opening + Manual
        const opening = openingMap.get(pid)?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0
        const manual = manualMap.get(pid)?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0
        const storeStock = opening + manual

        // Auto Adjust
        const autoAdjust = autoAdjustMap.get(pid) || 0

        // Damage Stock
        const damageStock = damageMap.get(pid)?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0

        // Purchase
        const purchase = purchaseMap.get(pid)?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0

        // Sales & Returns
        let sales = 0
        let salesReturn = 0

        // Daraz
        const darazItems = darazMap.get(pid) || []
        darazItems.forEach((item: any) => {
            const sRaw = item.item_status || item.order?.order_status
            const status = sRaw ? sRaw.toString().trim().toLowerCase() : ''
            const qty = item.quantity || 0

            const salesStatuses = [
                'shipped', 'delivered',
                'returning to seller', 'returning_to_seller',
                'customer return', 'customer_return',
                'returned',
                'returned delivered', 'returned_delivered',
                'customer return delivered', 'customer_return_delivered',
                'return delivered',
                'fail delivered', 'delivery failed'
            ]
            if (salesStatuses.includes(status)) {
                sales += qty
            }

            const returnStatuses = [
                'returned delivered', 'returned_delivered',
                'customer return delivered', 'customer_return_delivered',
                'return delivered',
                'returned',
                'fail delivered', 'delivery failed'
            ]
            if (returnStatuses.includes(status)) {
                salesReturn += qty
            }
        })

        // Marketplace
        const marketplaceItems = marketplaceMap.get(pid) || []
        marketplaceItems.forEach((item: any) => {
            const sRaw = item.order?.order_status
            const status = sRaw ? sRaw.toString().trim().toLowerCase() : ''
            const qty = item.quantity || 0

            if (['shipped', 'delivered', 'fail delivered', 'delivery failed', 'returned to seller'].includes(status)) {
                sales += qty
            }

            if (['fail delivered', 'delivery failed', 'returned to seller'].includes(status)) {
                salesReturn += qty
            }
        })

        // Store Sales
        const storeItems = storeMap.get(pid) || []
        storeItems.forEach((item: any) => {
            sales += (item.qty || 0)
        })

        // Total Stock (combo/variation products always show 0)
        const isComboOrVariation = product.product_type === 'combo' || product.product_type === 'variation'
        const totalStock = isComboOrVariation ? 0 : (storeStock + purchase + salesReturn + autoAdjust + damageStock - sales)

        stockMap.set(pid, totalStock)
    })

    return stockMap
}
