'use server'

import { createClient } from '@/lib/supabase/server'
import { StockLedgerItem } from './stock-ledger-service'

export interface StockValuationItem {
    id: string
    product_name: string
    total_stock: number
    stock_value: number | 'Missing'
    total_valuation: number | 'Error'
    stock_value_source: 'average' | 'est' | 'missing' // For debugging/UI hints if needed
}

export interface ValuationSummary {
    missingCount: number
    totalValuation: number
}

export interface ValuationResponse {
    data: StockValuationItem[]
    totalCount: number
    totalPages: number
    currentPage: number
    summary: ValuationSummary
}

// Reuse helper
function datSum(...args: number[]) {
    return args.reduce((a, b) => a + (b || 0), 0)
}

export async function getStockValuation(page = 1, limit = 50, search = ''): Promise<ValuationResponse> {
    const supabase = await createClient()

    // 1. Fetch ALL Products (chunked) - Similar to stock ledger
    const CHUNK_SIZE = 1000
    let allProducts: { id: string; product_name: string; product_type: string; est_price: number }[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
        let q = supabase
            .from('products')
            .select('id, product_name, product_type, est_price')
            .eq('is_deleted', false)
            .order('id', { ascending: true })
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
        if (offset > 20000) hasMore = false
    }

    // Deduplicate
    const uniqueMap = new Map()
    allProducts.forEach(p => uniqueMap.set(p.id, p))
    const products = Array.from(uniqueMap.values())

    if (products.length === 0) {
        return {
            data: [],
            totalCount: 0,
            totalPages: 0,
            currentPage: page,
            summary: { missingCount: 0, totalValuation: 0 }
        }
    }

    const productIds = products.map(p => p.id)

    // 2. Fetch Related Data (Chunks)
    // Reduce chunk size to 50 to avoid URL length limits (GET requests)
    const RELATED_CHUNK_SIZE = 50
    const allOpeningStocks: any[] = []
    const allManualAdjustments: any[] = []
    const allDamagedStocks: any[] = []
    const allPurchases: any[] = []
    const allDarazOrderItems: any[] = []
    const allMarketplaceOrderItems: any[] = []
    const allStoreSalesItems: any[] = []

    // NEW: Also fetch Average Price from view
    const allPriceReports: any[] = []

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
            priceReports // Fetch prices
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
            supabase.from('inventory_price_reports_view')
                .select('product_id, average_price')
                .in('product_id', chunkIds)
        ])

        allOpeningStocks.push(...(openingStocks.data || []))
        allManualAdjustments.push(...(manualAdjustments.data || []))
        allDamagedStocks.push(...(damagedStocks.data || []))
        allPurchases.push(...(purchases.data || []))
        allDarazOrderItems.push(...(darazOrderItems.data || []))
        allMarketplaceOrderItems.push(...(marketplaceOrderItems.data || []))
        allStoreSalesItems.push(...(storeSalesItems.data || []))
        allPriceReports.push(...(priceReports.data || []))
    }

    // 2.1 Fetch Combo Sales
    const [
        darazComboSales,
        marketplaceComboSales,
        storeComboSales
    ] = await Promise.all([
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

    const allDarazComboSales = darazComboSales.data || []
    const allMarketplaceComboSales = marketplaceComboSales.data || []
    const allStoreComboSales = storeComboSales.data || []

    // 3. Process Combo Auto Adjust
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

    processComboSales(allDarazComboSales, 'quantity', true)
    processComboSales(allMarketplaceComboSales, 'quantity', true)
    processComboSales(allStoreComboSales, 'qty', false)

    // 4. Group Data
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

    // Price Map (Average Price)
    const priceMap = new Map<string, number>()
    allPriceReports.forEach(p => {
        if (p.average_price) priceMap.set(p.product_id, p.average_price)
    })

    // 5. Calculate Metrics per Product
    let globalMissingCount = 0
    let globalTotalValuation = 0

    const valuationItems: StockValuationItem[] = []

    products.forEach(product => {
        const pid = product.id

        // Skip calculations for combo/variation as they don't hold stock usually, 
        // OR user said "only show stock product ... if stock is 0 ignore"
        // Ledger rules: Combo/Variation total_stock = 0.
        // So they will be filtered out by "stock != 0" rule effectively.
        const isComboOrVariation = product.product_type === 'combo' || product.product_type === 'variation'

        const opening = openingMap.get(pid)?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0
        const manual = manualMap.get(pid)?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0
        const storeStock = opening + manual
        const autoAdjust = autoAdjustMap.get(pid) || 0
        const damageStock = damageMap.get(pid)?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0
        const purchase = purchaseMap.get(pid)?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0

        let sales = 0
        let salesReturn = 0

        // Daraz Sales
        const darazItems = darazMap.get(pid) || []
        darazItems.forEach((item: any) => {
            const sRaw = item.item_status || item.order?.order_status
            const status = sRaw ? sRaw.toString().trim().toLowerCase() : ''
            const qty = item.quantity || 0
            const salesStatuses = [
                'shipped', 'delivered', 'returning to seller', 'returning_to_seller',
                'customer return', 'customer_return', 'returned',
                'returned delivered', 'returned_delivered', 'customer return delivered',
                'customer_return_delivered', 'return delivered', 'fail delivered', 'delivery failed'
            ]
            if (salesStatuses.includes(status)) sales += qty

            const returnStatuses = [
                'returned delivered', 'returned_delivered', 'customer return delivered',
                'customer_return_delivered', 'return delivered', 'returned',
                'fail delivered', 'delivery failed'
            ]
            if (returnStatuses.includes(status)) salesReturn += qty
        })

        // Marketplace Sales
        const marketplaceItems = marketplaceMap.get(pid) || []
        marketplaceItems.forEach((item: any) => {
            const sRaw = item.order?.order_status
            const status = sRaw ? sRaw.toString().trim().toLowerCase() : ''
            const qty = item.quantity || 0
            if (['shipped', 'delivered', 'fail delivered', 'delivery failed', 'returned to seller'].includes(status)) sales += qty
            if (['fail delivered', 'delivery failed', 'returned to seller'].includes(status)) salesReturn += qty
        })

        // Store Sales
        storeMap.get(pid)?.forEach((item: any) => sales += (item.qty || 0))

        const totalStock = isComboOrVariation ? 0 : (storeStock + purchase + salesReturn + autoAdjust + damageStock - sales)

        // FILTER: Ignore if Stock is 0
        if (totalStock === 0) return

        // Price Logic: Average > Est > Missing
        const avgPrice = priceMap.get(pid)
        const estPrice = product.est_price

        let stockValue: number | 'Missing' = 'Missing'
        let source: 'average' | 'est' | 'missing' = 'missing'

        if (avgPrice && avgPrice > 0) {
            stockValue = avgPrice
            source = 'average'
        } else if (estPrice && estPrice > 0) {
            stockValue = estPrice
            source = 'est'
        }

        // Valuation Logic
        let totalValuation: number | 'Error' = 'Error'

        if (stockValue !== 'Missing') {
            // "if Total Stock is in negative then show 'Error'"
            if (totalStock < 0) {
                totalValuation = 'Error'
            } else {
                totalValuation = (stockValue as number) * totalStock
                globalTotalValuation += totalValuation
            }
        } else {
            // Missing price -> count as missing
            globalMissingCount++
        }

        valuationItems.push({
            id: pid,
            product_name: product.product_name,
            total_stock: totalStock,
            stock_value: stockValue,
            total_valuation: totalValuation,
            stock_value_source: source
        })
    })

    // 6. Sort
    // User Request: "in stock valuation table , in column total stock show top quantity stock in top of page"
    valuationItems.sort((a, b) => b.total_stock - a.total_stock)

    // 7. Paginate
    const totalCount = valuationItems.length
    const totalPages = Math.ceil(totalCount / limit)
    const paginatedData = valuationItems.slice((page - 1) * limit, page * limit)

    return {
        data: paginatedData,
        totalCount,
        totalPages,
        currentPage: page,
        summary: {
            missingCount: globalMissingCount,
            totalValuation: globalTotalValuation
        }
    }
}
