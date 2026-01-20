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

    // 1. Fetch ALL Products (chunked to bypass 1000 limit) for Global Sorting
    const CHUNK_SIZE = 1000
    let allProducts: { id: string; product_name: string; product_type: string }[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
        // Build fresh query for each chunk
        let q = supabase
            .from('products')
            .select('id, product_name, product_type')
            .eq('is_deleted', false)
            .order('id', { ascending: true }) // Deterministic sort
            .range(offset, offset + CHUNK_SIZE - 1)

        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`
            let orQuery = `product_name.ilike.${searchTerm},seller_sku1.ilike.${searchTerm},seller_sku2.ilike.${searchTerm},seller_sku3.ilike.${searchTerm},seller_sku4.ilike.${searchTerm}`
            if (!isNaN(Number(search.trim()))) {
                orQuery += `,product_id.eq.${search.trim()}`
            }
            q = q.or(orQuery)
        }

        const { data: chunk, error } = await q

        if (error) throw new Error(error.message)

        if (!chunk || chunk.length === 0) {
            hasMore = false
        } else {
            allProducts = [...allProducts, ...chunk]
            offset += CHUNK_SIZE
            if (chunk.length < CHUNK_SIZE) hasMore = false
        }

        // Safety break
        if (offset > 20000) hasMore = false
    }

    // Deduplicate
    const uniqueMap = new Map()
    allProducts.forEach(p => uniqueMap.set(p.id, p))
    const products = Array.from(uniqueMap.values())

    if (products.length === 0) {
        return { data: [], totalCount: 0, totalPages: 0, currentPage: page }
    }

    const productIds = products.map(p => p.id)

    // 2. Fetch Related Data in Chunks (Supabase has limits on .in() clause size)
    const RELATED_CHUNK_SIZE = 500
    const allOpeningStocks: any[] = []
    const allManualAdjustments: any[] = []
    const allDamagedStocks: any[] = []
    const allPurchases: any[] = []
    const allDarazOrderItems: any[] = []
    const allMarketplaceOrderItems: any[] = []
    const allStoreSalesItems: any[] = []
    const allDarazComboSales: any[] = []
    const allMarketplaceComboSales: any[] = []
    const allStoreComboSales: any[] = []

    for (let i = 0; i < productIds.length; i += RELATED_CHUNK_SIZE) {
        const chunkIds = productIds.slice(i, i + RELATED_CHUNK_SIZE)

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
            supabase.from('opening_stocks').select('product_id, quantity').in('product_id', chunkIds),
            supabase.from('manual_adjustments').select('product_id, quantity').in('product_id', chunkIds),
            supabase.from('damaged_stocks').select('product_id, quantity').eq('status', 'Damaged').in('product_id', chunkIds),
            supabase.from('purchases').select('product_id, quantity').in('product_id', chunkIds),
            supabase.from('daraz_order_items')
                .select('product_id, quantity, item_status, order:daraz_orders!inner(order_status)')
                .in('product_id', chunkIds),
            supabase.from('marketplace_order_items')
                .select('product_id, quantity, item_status, order:marketplace_orders!inner(order_status)')
                .in('product_id', chunkIds),
            supabase.from('store_sales_items')
                .select('product_id, qty')
                .in('product_id', chunkIds),
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

        allOpeningStocks.push(...(openingStocks.data || []))
        allManualAdjustments.push(...(manualAdjustments.data || []))
        allDamagedStocks.push(...(damagedStocks.data || []))
        allPurchases.push(...(purchases.data || []))
        allDarazOrderItems.push(...(darazOrderItems.data || []))
        allMarketplaceOrderItems.push(...(marketplaceOrderItems.data || []))
        allStoreSalesItems.push(...(storeSalesItems.data || []))
        allDarazComboSales.push(...(darazComboSales.data || []))
        allMarketplaceComboSales.push(...(marketplaceComboSales.data || []))
        allStoreComboSales.push(...(storeComboSales.data || []))
    }

    // 3. Calculate Auto Adjust for Component Products
    // When combo products are sold, component products' stock is auto-adjusted
    const autoAdjustMap = new Map<string, number>()

    const processComboSales = (items: any[], qtyKey: string, hasOrder: boolean) => {
        items?.forEach((item: any) => {
            const soldQty = item[qtyKey] || 0
            const status = item.order?.order_status
            const components = item.product?.product_combos || []

            // Determine stock effect based on status
            let stockEffect: 'positive' | 'negative' | 'neutral' = 'neutral'
            if (!hasOrder) {
                // Store sales are always completed (negative)
                stockEffect = 'negative'
            } else if (['Shipped', 'Delivered', 'Returning to Seller'].includes(status)) {
                stockEffect = 'negative'
            } else if (['Fail Delivered', 'Returned Delivered', 'Customer Return', 'Customer Return Delivered'].includes(status)) {
                stockEffect = 'positive'
            }

            // Calculate adjustment for each component
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

    // Process all combo sales
    processComboSales(allDarazComboSales, 'quantity', true)
    processComboSales(allMarketplaceComboSales, 'quantity', true)
    processComboSales(allStoreComboSales, 'qty', false)

    // 4. Group Other Data by Product ID
    const groupByProduct = (items: any[]) => {
        const map = new Map<string, any[]>()
        items?.forEach(item => {
            const pid = item.product_id
            if (!map.has(pid)) map.set(pid, [])
            map.get(pid)?.push(item)
        })
        return map
    }

    const openingMap = groupByProduct(allOpeningStocks)
    const manualMap = groupByProduct(allManualAdjustments)
    const damageMap = groupByProduct(allDamagedStocks)
    const purchaseMap = groupByProduct(allPurchases)
    const darazMap = groupByProduct(allDarazOrderItems)
    const marketplaceMap = groupByProduct(allMarketplaceOrderItems)
    const storeMap = groupByProduct(allStoreSalesItems)

    // 5. Calculate Metrics for Each Product
    const ledger: StockLedgerItem[] = products.map(product => {
        const pid = product.id

        // Store Stock = Opening + Manual
        const opening = openingMap.get(pid)?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0
        const manual = manualMap.get(pid)?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0
        const storeStock = opening + manual

        // Auto Adjust (from combo product sales)
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

            // Sales: Count EVERYTHING that left the warehouse (Shipped/Delivered + Transit Returns + Completed Returns)
            // Normalized to lowercase to handle casing issues (e.g. 'Returned' vs 'returned')
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

            // Sales Return: Count ONLY items that have PHYSICALLY returned to inventory
            // User Request: Return Delivered, Customer Return Delivered, returned
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

            // Sales: Shipped/Delivered + Returns
            if (['shipped', 'delivered', 'fail delivered', 'delivery failed', 'returned to seller'].includes(status)) {
                sales += qty
            }

            // Sales Return: Completed Returns
            if (['fail delivered', 'delivery failed', 'returned to seller'].includes(status)) {
                salesReturn += qty
            }
        })

        // Store Sales
        const storeItems = storeMap.get(pid) || []
        storeItems.forEach((item: any) => {
            sales += (item.qty || 0)
        })

        // Total Stock
        // Special rule: Combo/Variation products always show 0
        const isComboOrVariation = product.product_type === 'combo' || product.product_type === 'variation'
        const totalStock = isComboOrVariation ? 0 : (storeStock + purchase + salesReturn + autoAdjust + damageStock - sales)

        return {
            id: pid,
            product_name: product.product_name,
            product_type: product.product_type,
            store_stock: storeStock,
            auto_adjust: autoAdjust,
            damage_stock: damageStock,
            purchase: purchase,
            sales: sales,
            sales_return: salesReturn,
            total_stock: totalStock
        }
    })

    // 6. Global Sort by Total Stock
    // Rule: Positive (highest to lowest) → Negative (least negative to most negative) → Zero last
    ledger.sort((a, b) => {
        const valA = a.total_stock
        const valB = b.total_stock

        // Both are zero - equal
        if (valA === 0 && valB === 0) return 0

        // A is zero, B is not - A goes after B
        if (valA === 0) return 1

        // B is zero, A is not - B goes after A
        if (valB === 0) return -1

        // Both positive: higher number first (descending)
        if (valA > 0 && valB > 0) return valB - valA

        // Both negative: less negative first (e.g., -2 before -28)
        if (valA < 0 && valB < 0) return valB - valA  // -2 - (-28) = 26 (positive), so -2 comes first

        // A is positive, B is negative: A comes first
        if (valA > 0 && valB < 0) return -1

        // A is negative, B is positive: B comes first
        if (valA < 0 && valB > 0) return 1

        return 0
    })

    // 7. Apply Pagination
    const totalCount = ledger.length
    const totalPages = Math.ceil(totalCount / limit)
    const paginatedData = ledger.slice((page - 1) * limit, page * limit)

    return {
        data: paginatedData,
        totalCount,
        totalPages,
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
    // totalStock = storeStock + purchase + salesReturn + autoAdjust + damageStock - sales
    const calculatedTotal = storeStock + purchase + totalReturnsForFormula + autoAdjust + damageStock - totalSalesForFormula
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
