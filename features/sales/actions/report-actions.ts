'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { fetchDarazFinanceTransactions } from './daraz-finance-service'

export interface OrderReportItem {
    order_primary_id: string
    order_number: string
    invoice_number: string | null
    order_status: string
    delivered_at: string | null
    delivered_by_daraz?: string | null
    created_at: string
    seller_account: string | null
    total_revenue: number | null
    total_purchase_cost: number | null
    estimated_profit: number | null
    items_summary: any[]
}

export interface GetOrderReportParams {
    page?: number
    limit?: number
    search?: string
    startDate?: string
    endDate?: string
    syncStatus?: 'all' | 'synced' | 'not_synced'
}




// --- Helper Functions ---

async function fetchProductPrices(supabase: any, productIds: number[]) {
    if (!productIds || productIds.length === 0) return {}

    // Optimization: Chunk if needed, but for now direct IN query
    const { data: priceData } = await supabase
        .from('inventory_price_reports_view')
        .select('product_code, last_price, est_price')
        .in('product_code', productIds)

    const priceMap: Record<number, { last_price: number | null, est_price: number | null }> = {}
    priceData?.forEach((p: any) => {
        priceMap[p.product_code] = {
            last_price: p.last_price,
            est_price: p.est_price
        }
    })
    return priceMap
}

function calculateItemCost(item: any, priceMap: Record<string, any>) {
    // Priority: locked purchase_cost > live inventory price
    if (item.purchase_cost && item.purchase_cost > 0) {
        return (item.purchase_cost * (item.quantity || 1))
    }

    const priceInfo = priceMap[item.product_id]
    const purchasePrice = priceInfo?.last_price || priceInfo?.est_price || 0

    return (purchasePrice * (item.quantity || 1))
}

function calculateOrderFinancials(order: any, priceMap: Record<string, any>) {
    const totalPurchaseCost = order.items?.reduce((sum: number, item: any) => {
        return sum + calculateItemCost(item, priceMap)
    }, 0) || 0

    const revenue = order.items?.reduce((sum: number, item: any) => sum + ((item.amount || 0) * (item.quantity || 1)), 0) || 0
    const totalFee = order.daraz_fees || 0
    const otherFee = 30
    const netProfit = revenue - totalFee - otherFee - totalPurchaseCost

    const sellerAccount = order.items?.[0]?.seller_account || 'Unknown'

    return {
        totalPurchaseCost,
        revenue,
        totalFee,
        netProfit,
        sellerAccount
    }
}

// Fetch detailed order info + inventory price info for the Details Page
export async function getDarazOrderDetailsForReport(orderNumber: string) {
    const supabase = await createClient()

    // 1. Fetch Order & Items
    console.log(`Debug: Fetching details for Order #${orderNumber} (Type: ${typeof orderNumber})`)
    const { data: order, error: orderError } = await supabase
        .from('daraz_orders')
        .select(`
            *,
            items:daraz_order_items(
                *,
                product:products(
                    id,
                    product_id,
                    product_name,
                    est_price
                )
            )
        `)
        .eq('order_number', orderNumber)
        .single()

    if (orderError || !order) {
        console.error('Order Fetch Error:', orderError)
        throw new Error('Order not found')
    }

    // 2. Fetch "Last Price" from inventory_price_reports_view for each item
    const productIds = order.items
        .map((item: any) => item.product_id)
        .filter((id: any) => id)

    // Also collect Names/SKUs for unlinked items to try and "soft link" them for display
    const unlinkedItems = order.items.filter((item: any) => !item.product_id)
    const unlinkedSkus = unlinkedItems.map((i: any) => i.seller_sku).filter(Boolean)
    const unlinkedNames = unlinkedItems.map((i: any) => i.product_name).filter(Boolean)

    let priceMap: Record<string, { last_price: number | null, est_price: number | null, product_code: any }> = {}
    let softLinkMap: Record<string, { last_price: number | null, est_price: number | null, product_code: any }> = {} // Key: "sku:..." or "name:..."
    let allProductsList: any[] = [] // For fuzzy matching

    if (productIds.length > 0) {
        const { data: prices } = await supabase
            .from('inventory_price_reports_view')
            .select('product_id, product_code, last_price, est_price')
            .in('product_id', productIds)

        if (prices) {
            prices.forEach((p: any) => {
                priceMap[p.product_id] = {
                    last_price: p.last_price,
                    est_price: p.est_price,
                    product_code: p.product_code
                }
            })
        }
    }

    // Fetch by SKU/Name if needed
    if (unlinkedSkus.length > 0 || unlinkedNames.length > 0) {
        // Fallback: Fetch ALL price data (lightweight view) if any unlinked items exist.
        // This guarantees we find matches without complex dynamic OR queries.
        const { data: allProducts } = await supabase
            .from('inventory_price_reports_view')
            .select('product_id, product_code, product_name, seller_sku1, seller_sku2, seller_sku3, seller_sku4, last_price, est_price')
            .limit(5000)

        allProductsList = allProducts || []

        allProducts?.forEach((p: any) => {
            const info = { last_price: p.last_price, est_price: p.est_price, product_code: p.product_code }

            if (p.seller_sku1) softLinkMap[`sku:${p.seller_sku1.toLowerCase().trim()}`] = info
            if (p.seller_sku2) softLinkMap[`sku:${p.seller_sku2.toLowerCase().trim()}`] = info
            if (p.seller_sku3) softLinkMap[`sku:${p.seller_sku3.toLowerCase().trim()}`] = info
            if (p.seller_sku4) softLinkMap[`sku:${p.seller_sku4.toLowerCase().trim()}`] = info

            if (p.product_name) softLinkMap[`name:${p.product_name.toLowerCase().trim()}`] = info
        })
    }

    // 3. Attach purchase price info to items
    const enrichedItems = order.items.map((item: any) => {
        // Determine matched product ID (Code) from direct link if available
        let matchedProductCode = item.product?.product_id || null

        // If locked purchase_cost exists (> 0), use it.
        if (item.purchase_cost && item.purchase_cost > 0) {
            return {
                ...item,
                matched_product_code: matchedProductCode || (item.product_id ? priceMap[item.product_id]?.product_code : null),
                purchase_price: item.purchase_cost,
                purchase_price_source: 'Locked (Saved)'
            }
        }

        let priceInfo = priceMap[item.product_id]
        let source = 'Linked'

        // If not linked or no price via ID, try soft link
        if (!priceInfo) {
            const itemSku = (item.seller_sku || '').toLowerCase().trim()
            const itemName = (item.product_name || '').toLowerCase().trim()
            const skuKey = `sku:${itemSku}`
            const nameKey = `name:${itemName}`

            // 1. Exact Map Match
            priceInfo = softLinkMap[skuKey]
            if (priceInfo) source = 'SKU Match'

            if (!priceInfo) {
                priceInfo = softLinkMap[nameKey]
                if (priceInfo) source = 'Name Match'
            }

            // 2. Fuzzy/Partial SKU Match (Fallback)
            if (!priceInfo && itemSku && allProductsList.length > 0) {
                const fuzzyMatch = allProductsList.find((p: any) => {
                    const skus = [p.seller_sku1, p.seller_sku2, p.seller_sku3, p.seller_sku4].filter((s: any) => s).map((s: any) => s.toLowerCase().trim())
                    // Check if Item SKU contains Product SKU (e.g. "SKU-Color" contains "SKU")
                    // OR if Product SKU contains Item SKU (less common)
                    return skus.some((s: any) => s && s.length > 3 && itemSku.includes(s))
                })

                if (fuzzyMatch) {
                    priceInfo = {
                        last_price: fuzzyMatch.last_price,
                        est_price: fuzzyMatch.est_price,
                        product_code: fuzzyMatch.product_code
                    }
                    source = 'Partial SKU Match'
                }
            }
        }

        // Priority: Last Price -> Est Price -> 0
        const purchasePrice = priceInfo?.last_price || priceInfo?.est_price || 0
        const purchasePriceSource = purchasePrice > 0
            ? (priceInfo?.last_price ? `Last Price (${source})` : `Est. Price (${source})`)
            : 'None'

        // If we found a soft/fuzzy match and didn't have a direct link code, use the found code
        if (!matchedProductCode && priceInfo?.product_code) {
            matchedProductCode = priceInfo.product_code
        }

        return {
            ...item,
            matched_product_code: matchedProductCode,
            purchase_price: purchasePrice,
            purchase_price_source: purchasePriceSource
        }
    })

    // Polyfill online_stores.seller_account if missing (using first item's seller_account)
    const sellerAccount = order.items?.[0]?.seller_account || 'Unknown'

    // Filter enriched items to only show delivered ones in the Profit Tracker Detail View
    const deliveredEnrichedItems = enrichedItems.filter((i: any) => {
        const iStatus = (i.item_status || '').toLowerCase()
        return iStatus === 'delivered' || (!iStatus && order.order_status === 'Delivered')
    })

    const enrichedOrder = {
        ...order,
        items: deliveredEnrichedItems,
        online_stores: { seller_account: sellerAccount }
    }

    return enrichedOrder
}

// --- Main Actions ---

export async function getProfitTrackerData(params: GetOrderReportParams) {
    const { page = 1, limit = 50, search, startDate, endDate, syncStatus = 'all' } = params
    const supabase = await createClient()

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
        .from('daraz_orders')
        .select(`
            id,
            order_number,
            invoice_number,
            order_status,
            order_status,
            delivered_at,
            delivered_by_daraz,
            created_at,
            daraz_fees,
            items:daraz_order_items(
                product_id,
                seller_account,
                product_name,
                purchase_cost,
                seller_sku,
                amount,
                quantity,
                amount,
                quantity,
                product_id,
                item_status
            )
        `, { count: 'exact' })
        .in('order_status', ['Delivered', 'Customer Return Delivered'])

    // Search by order number or invoice number
    if (search && search.trim()) {
        query = query.or(`order_number.ilike.%${search.trim()}%,invoice_number.ilike.%${search.trim()}%`)
    }

    // Apply DB Level Filtering for Pagination Accuracy
    if (syncStatus === 'synced') {
        query = query.not('daraz_fees', 'is', null)
    } else if (syncStatus === 'not_synced') {
        query = query.is('daraz_fees', null)
    }

    // Date Filtering (Delivered At)
    if (startDate) {
        query = query.gte('delivered_at', startDate)
    }
    if (endDate) {
        query = query.lte('delivered_at', endDate)
    }

    // Sort by Delivered At Descending
    query = query
        .order('delivered_at', { ascending: false, nullsFirst: false })
        .range(from, to)

    const { data, count, error } = await query

    if (error) {
        console.error('Error fetching profit tracker data:', error)
        throw new Error('Failed to fetch profit tracker data')
    }

    // Fetch purchase costs from inventory_price_reports_view
    // Get all product UUIDs from order items
    const allProductIds = [...new Set(
        (data || []).flatMap(order =>
            order.items?.map((item: any) => item.product_id).filter(Boolean) || []
        )
    )]

    // Query inventory_price_reports_view to get mapping of UUID -> product_code and prices
    let priceMap: Record<string, { product_code: number, last_price: number | null, est_price: number | null }> = {}
    if (allProductIds.length > 0) {
        const { data: priceData } = await supabase
            .from('inventory_price_reports_view')
            .select('product_id, product_code, last_price, est_price')
            .in('product_id', allProductIds)

        priceData?.forEach((p: any) => {
            priceMap[p.product_id] = {
                product_code: p.product_code,
                last_price: p.last_price,
                est_price: p.est_price
            }
        })
    }

    // Transform data for UI
    // Filter for Delivered Items ONLY
    let formattedData = (data || []).map((order: any) => {
        // Filter for Delivered Items ONLY
        const deliveredItems = order.items?.filter((i: any) => {
            const iStatus = (i.item_status || '').toLowerCase()
            return iStatus === 'delivered' || (!iStatus && order.order_status === 'Delivered')
        }) || []

        // Recalculate Financials based on valid Items only
        const orderForCalc = { ...order, items: deliveredItems }
        const financials = calculateOrderFinancials(orderForCalc, priceMap)

        // Sync Status Logic
        let isSyncedFee = order.daraz_fees !== null && order.daraz_fees !== undefined
        const syncStatus = isSyncedFee ? 'synced' : 'not_synced'

        // If no delivered items, we return null (will filter out later)
        if (deliveredItems.length === 0) return null

        return {
            order_primary_id: order.id,
            order_number: order.order_number,
            invoice_number: order.invoice_number,
            order_status: order.order_status,
            delivered_at: order.delivered_at,
            delivered_by_daraz: order.delivered_by_daraz,
            created_at: order.created_at,
            seller_account: financials.sellerAccount,
            products: deliveredItems.map((i: any) => {
                let purchasePrice = 0
                if (i.purchase_cost && i.purchase_cost > 0) {
                    purchasePrice = i.purchase_cost
                } else {
                    const priceInfo = priceMap[i.product_id]
                    purchasePrice = priceInfo?.last_price || priceInfo?.est_price || 0
                }
                const priceInfo = priceMap[i.product_id]
                return {
                    product_name: i.product_name,
                    seller_sku: i.seller_sku,
                    product_id: priceInfo?.product_code || i.product_id,
                    purchase_price: purchasePrice,
                    quantity: i.quantity || 1
                }
            }) || [],
            total_revenue: financials.revenue,
            total_purchase_cost: financials.totalPurchaseCost,
            total_fee: financials.totalFee,
            profit: financials.netProfit,
            profit_percentage: financials.revenue > 0 ? ((financials.netProfit / financials.revenue) * 100) : 0,
            sync_status: syncStatus
        }
    }).filter(Boolean)

    return {
        data: formattedData,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page
    }
}

// Fetch Global Daily Stats (Ignoring Pagination) for Group Headers
export async function getDailyProfitStats(params: GetOrderReportParams) {
    const { search, startDate, endDate, syncStatus = 'all' } = params
    const supabase = await createClient()


    // 1. Fetch ALL matching orders (Minimal fields for calculation)
    let query = supabase
        .from('daraz_orders')
        .select(`
            order_number,
            delivered_at,
            delivered_by_daraz,
            daraz_fees,
            items:daraz_order_items(
                seller_account,
                purchase_cost,
                amount,
                quantity,
                product_id,
                item_status
            )
        `)
        .in('order_status', ['Delivered', 'Customer Return Delivered'])

    // Apply same filters as main table
    if (search && search.trim()) {
        query = query.or(`order_number.ilike.%${search.trim()}%,invoice_number.ilike.%${search.trim()}%`)
    }

    if (syncStatus === 'synced') {
        query = query.not('daraz_fees', 'is', null)
    } else if (syncStatus === 'not_synced') {
        query = query.is('daraz_fees', null)
    }

    if (startDate) query = query.gte('delivered_at', startDate)
    if (endDate) query = query.lte('delivered_at', endDate)

    let allOrders: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true



    while (hasMore) {
        const from = page * pageSize
        const to = from + pageSize - 1

        const { data, error } = await query.range(from, to)

        if (error) {
            console.error('Error fetching global stats chunk:', error)
            break
        }

        if (data) {
            allOrders = [...allOrders, ...data]

            if (data.length < pageSize) {
                hasMore = false
            } else {
                page++
            }
        } else {
            hasMore = false
        }

        // Safety break to prevent infinite loops if DB is huge (max 20k for now)
        if (allOrders.length > 20000) {
            break
        }
    }




    const data = allOrders



    // 2. Fetch Prices for calculation if needed (Heavy, but necessary for accuracy)
    // To optimize, we might rely on what we can get. 
    // Ideally, cost should be synced. If purchase_cost is missing on item, we trying to fetch is expensive for ALL orders.
    // Compromise: For "Global Stats", if purchase_cost is missing on item, try to fetch from View in Batch.

    // Collect Product IDs for price lookup
    const allProductIds = [...new Set(
        (data || []).flatMap((order: any) =>
            order.items?.map((item: any) => item.product_id).filter(Boolean) || []
        )
    )]

    let priceMap: Record<string, { last_price: number | null, est_price: number | null }> = {}

    // Optimization: Chunk product ID fetching if too many (Supabase might limit IN clause)
    if (allProductIds.length > 0) {
        // Fetch in chunks of 1000 if needed, for now assume < 5000 unique products active in filter
        const { data: priceData } = await supabase
            .from('inventory_price_reports_view')
            .select('product_id, last_price, est_price')
            .in('product_id', allProductIds)

        priceData?.forEach((p: any) => {
            priceMap[p.product_id] = { last_price: p.last_price, est_price: p.est_price }
        })
    }

    // 3. Process & Return Raw List
    // We return a list of stats so the Frontend can aggregate by its User Local Timezone
    // to matches the UI grouping perfectly.
    const statsList: any[] = []

    data?.forEach((order: any) => {
        // Priority: delivered_by_daraz > delivered_at
        const dateRaw = order.delivered_by_daraz || order.delivered_at
        if (!dateRaw) return

        // Filter for Delivered Items
        const deliveredItems = order.items?.filter((i: any) => {
            const iStatus = (i.item_status || '').toLowerCase()
            return iStatus === 'delivered' || (!iStatus && order.order_status === 'Delivered')
        }) || []

        if (deliveredItems.length === 0) return

        // Calculate Order Profit using ONLY delivered items
        const totalPurchaseCost = deliveredItems.reduce((sum: number, item: any) => {
            if (item.purchase_cost && item.purchase_cost > 0) {
                return sum + (item.purchase_cost * (item.quantity || 1))
            }
            const productCode = item.product_id
            const priceInfo = priceMap[productCode]
            const purchasePrice = priceInfo?.last_price || priceInfo?.est_price || 0
            return sum + (purchasePrice * (item.quantity || 1))
        }, 0) || 0

        const revenue = deliveredItems.reduce((sum: number, item: any) => sum + ((item.amount || 0) * (item.quantity || 1)), 0) || 0
        const totalFee = order.daraz_fees || 0
        const otherFee = 30
        const netProfit = revenue - totalFee - otherFee - totalPurchaseCost

        const seller = deliveredItems[0]?.seller_account || 'Unknown'

        statsList.push({
            date: dateRaw, // ISO String
            seller,
            profit: netProfit,
            missing: totalPurchaseCost <= 0 ? 1 : 0
        })
    })

    return statsList
}

// Sync/Lock Purchase Cost for an Order
export async function syncOrderPurchaseCost(orderNumber: string) {
    const supabase = await createClient()

    // 1. Fetch Order Items & Meta for Finance Sync
    const { data: order, error } = await supabase
        .from('daraz_orders')
        .select(`
            id,
            store_id,
            order_date,
            order_id,
            items:daraz_order_items(id, product_id, purchase_cost, seller_sku, product_name)
        `)
        .eq('order_number', orderNumber)
        .single()

    if (error || !order) {
        throw new Error(`Order ${orderNumber} not found in DB`)
    }

    const updates = []
    let debugLog: string[] = []
    let feeSyncResult = 'Skipped'

    // 1b. Sync Finance Fees (Matching order-sync page logic EXACTLY)
    // Only if store_id exists (needed for API)
    if (order.store_id) {
        try {
            // Calculate revenue (Product Price)
            const { data: orderData } = await supabase
                .from('daraz_orders')
                .select('items:daraz_order_items(amount, quantity)')
                .eq('order_number', orderNumber)
                .single()

            const revenue = orderData?.items?.reduce((sum: number, item: any) =>
                sum + ((item.amount || 0) * (item.quantity || 1)), 0) || 0

            // Fetch Finance API transactions
            // Use order.order_id which is the actual Daraz Trade Order ID
            const targetId = order.order_id || orderNumber
            const transactions = await fetchDarazFinanceTransactions(targetId, order.store_id, order.order_date)

            // Helper to get fee total from transactions by keywords
            // CRITICAL: Sum ALL amounts (positive and negative) to handle reversals/refunds
            // Fees are negative in API. We want Cost (Positive). So we negate the sum.
            const getFinanceTotal = (keywords: string[]) => {
                if (!transactions || !transactions.length) return 0
                return transactions
                    .filter((t: any) => {
                        const name = (t.fee_name || '').toLowerCase()
                        const type = (t.transaction_type || t.fee_type || '').toLowerCase()
                        return keywords.some(k => name.includes(k) || type.includes(k))
                    })
                    .reduce((sum: number, t: any) => sum - parseFloat(t.amount || 0), 0)
            }

            const hasFinance = transactions && transactions.length > 0

            // 1. Free Shipping Max Fee (search for SPECIFIC fee name, not generic 'shipping')
            const val_free_ship = hasFinance
                ? getFinanceTotal(['free shipping', 'free_shipping'])
                : (revenue * 0.0339)

            // 2. Co-funded Voucher Max (search for SPECIFIC fee name)
            const val_voucher = hasFinance
                ? getFinanceTotal(['co-funded', 'cofunded', 'co_funded'])
                : (revenue * 0.02)

            // 3. Other fees from Finance API (always from API)
            const val_commission = getFinanceTotal(['commission'])
            const val_payment = getFinanceTotal(['payment fee'])
            const val_handling = getFinanceTotal(['handling fee'])
            const val_coin = getFinanceTotal(['coin'])
            const val_tax = getFinanceTotal(['tax', 'vat', 'wht'])

            // Total Fee = Shipping + Voucher + Commission + Payment + Handling + Coins + Tax
            const totalFee = val_free_ship + val_voucher + val_commission + val_payment + val_handling + val_coin + val_tax

            console.log(`[SYNC DEBUG] Order ${orderNumber} (ID: ${targetId}): Found ${transactions?.length || 0} txns. Total Fee: ${totalFee}`)

            // Save to database
            const { error: updateError } = await supabase
                .from('daraz_orders')
                .update({ daraz_fees: totalFee })
                .eq('order_number', orderNumber)

            if (updateError) {
                console.error(`[SYNC ERROR] Failed to update ${orderNumber}:`, updateError)
                feeSyncResult = 'Update Failed'
            } else {
                feeSyncResult = `Updated (Fee: ${totalFee.toFixed(2)})`
            }

        } catch (feeErr: any) {
            debugLog.push(`Fee Sync Error: ${feeErr.message}`)
            feeSyncResult = 'Error'
        }
    } else {
        feeSyncResult = 'Skipped (No Store ID)'
    }

    // 2. Identify items that need updates (Unlocked or 0 or Unlinked)
    // We strictly check for items missing purchase_cost OR items that are not linked (product_id is null)
    let itemsToUpdate = order.items.filter((item: any) => !item.purchase_cost || item.purchase_cost === 0 || !item.product_id)

    // debugLog.push(`Candidates: ${itemsToUpdate.length}`)

    // 3. Resolve Prices and Re-Link if necessary
    if (itemsToUpdate.length > 0) {
        // Fetch ALL products for robust matching
        // MAX LIMIT: 1000 is default, increase to 10000 to cover all 2000+ products
        const { data: products } = await supabase
            .from('inventory_price_reports_view')
            .select('product_id, product_name, seller_sku1, seller_sku2, seller_sku3, seller_sku4, last_price, est_price')
            .limit(10000)

        // Fetch product types to identify combo products
        const productIds = products?.map(p => p.product_id).filter(Boolean) || []
        const { data: productTypes } = await supabase
            .from('products')
            .select('id, product_type')
            .in('id', productIds)

        const productTypeMap = new Map<string, string>()
        productTypes?.forEach(pt => {
            productTypeMap.set(pt.id, pt.product_type)
        })

        // Fetch combo components for all combo products
        const comboProductIds = productTypes?.filter(pt => pt.product_type === 'combo').map(pt => pt.id) || []
        const { data: comboComponents } = await supabase
            .from('product_combos')
            .select('parent_product_id, child_product_id, quantity')
            .in('parent_product_id', comboProductIds)

        // Build combo components map
        const comboComponentsMap = new Map<string, Array<{ child_product_id: string, quantity: number }>>()
        comboComponents?.forEach(cc => {
            if (!comboComponentsMap.has(cc.parent_product_id)) {
                comboComponentsMap.set(cc.parent_product_id, [])
            }
            comboComponentsMap.get(cc.parent_product_id)!.push({
                child_product_id: cc.child_product_id,
                quantity: cc.quantity
            })
        })

        // Fetch est_prices for all child products
        const allChildIds = Array.from(new Set(
            Array.from(comboComponentsMap.values())
                .flat()
                .map(comp => comp.child_product_id)
        ))

        const childPriceMap = new Map<string, number>()
        if (allChildIds.length > 0) {
            const { data: childPrices } = await supabase
                .from('products')
                .select('id, est_price, last_price')
                .in('id', allChildIds)

            childPrices?.forEach(cp => {
                childPriceMap.set(cp.id, cp.last_price || cp.est_price || 0)
            })
        }

        // Build Maps
        const skuMap = new Map<string, any>()
        const nameMap = new Map<string, any>()

        products?.forEach(p => {
            let effectivePrice = 0

            // Check if this is a combo product
            if (productTypeMap.get(p.product_id) === 'combo' && comboComponentsMap.has(p.product_id)) {
                // Calculate combo price from components
                const components = comboComponentsMap.get(p.product_id)!
                effectivePrice = components.reduce((sum, comp) => {
                    const childPrice = childPriceMap.get(comp.child_product_id) || 0
                    return sum + (comp.quantity * childPrice)
                }, 0)
                console.log(`💰 [COMBO COST] ${p.product_name} (${p.product_id}): ${components.length} components = Rs. ${effectivePrice}`)
            } else {
                // For single products, use last_price or est_price
                effectivePrice = p.last_price || p.est_price || 0
                if (productTypeMap.get(p.product_id) === 'combo') {
                    console.log(`⚠️  [COMBO WARNING] ${p.product_name} is combo but has no components!`)
                }
            }

            const pData = { ...p, effective_price: effectivePrice }

            if (p.seller_sku1) skuMap.set(p.seller_sku1.toLowerCase().trim(), pData)
            if (p.seller_sku2) skuMap.set(p.seller_sku2.toLowerCase().trim(), pData)
            if (p.seller_sku3) skuMap.set(p.seller_sku3.toLowerCase().trim(), pData)
            if (p.seller_sku4) skuMap.set(p.seller_sku4.toLowerCase().trim(), pData)

            if (p.product_name) nameMap.set(p.product_name.toLowerCase().trim(), pData)
        })

        for (const item of itemsToUpdate) {
            let finalPrice = 0
            const currentPid = item.product_id

            // Identify best match
            const itemSku = (item.seller_sku || '').toLowerCase().trim()
            const itemName = (item.product_name || '').toLowerCase().trim()

            // 1. Try SKU Match
            let matchedProduct = skuMap.get(itemSku)
            let matchSource = 'SKU'

            // 2. Try Name Match (Fallback - Exact)
            if (!matchedProduct && itemName) {
                matchedProduct = nameMap.get(itemName)
                matchSource = 'Name (Exact)'
            }

            // 3. If linked currently but finding a better match? 
            if (matchedProduct) {
                if (matchedProduct.product_id !== currentPid || !currentPid) {
                    debugLog.push(`Item ${item.product_name.slice(0, 10)}...: Linked to ID ${matchedProduct.product_id} (${matchSource})`)
                    updates.push(
                        supabase.from('daraz_order_items').update({ product_id: matchedProduct.product_id }).eq('id', item.id)
                    )
                }
                finalPrice = matchedProduct.effective_price
            } else {
                debugLog.push(`Item ${item.product_name.slice(0, 10)}...: No match found.`)
            }

            // 4. Update Purchase Cost
            if (finalPrice > 0) {
                updates.push(
                    supabase.from('daraz_order_items').update({ purchase_cost: finalPrice }).eq('id', item.id)
                )
            } else if (currentPid && !matchedProduct) {
                // If already linked but we didn't search/match above, check if it has price in our loaded products
                const existingProduct = products?.find((p: any) => p.product_id === currentPid)
                if (existingProduct) {
                    // Priority: Last -> Est
                    const price = existingProduct.last_price || existingProduct.est_price || 0
                    if (price > 0) {
                        updates.push(
                            supabase.from('daraz_order_items').update({ purchase_cost: price }).eq('id', item.id)
                        )
                    }
                }
            }
        }
    }

    if (updates.length > 0) {
        await Promise.all(updates)
        revalidatePath(`/dashboard/sales/daraz/profit-tracker/${orderNumber}`)
        revalidatePath('/dashboard/sales/daraz/profit-tracker')
        return { success: true, updatedCount: updates.length, debug: `Fixed ${updates.length} items. Fees: ${feeSyncResult}` }
    }

    return {
        success: true,
        updatedCount: 0,
        debug: `No item updates. Fees: ${feeSyncResult}`
    }
}

// Bulk Sync for Orders with missing costs OR missing fees
export async function syncBulkOrderPurchaseCosts() {
    const supabase = await createClient()

    // 1. Missing Costs
    const { data: missingCostItems } = await supabase
        .from('daraz_order_items')
        .select('order_id, daraz_orders!inner(order_number, order_status)')
        .eq('purchase_cost', 0)
        .eq('daraz_orders.order_status', 'Delivered')
        .limit(100)

    const missingCostOrders = missingCostItems?.map((i: any) => i.daraz_orders.order_number) || []

    // 2. Get Delivered orders missing fees (fees is null or 0)
    const { data: missingFeeOrders } = await supabase
        .from('daraz_orders')
        .select('order_number')
        .eq('order_status', 'Delivered')
        .or('daraz_fees.is.null,daraz_fees.eq.0')
        .limit(100)

    const missingFeeOrderNumbers = missingFeeOrders?.map((o: any) => o.order_number) || []

    // Merge Unique Order Numbers
    const uniqueOrderNumbers = Array.from(new Set([...missingCostOrders, ...missingFeeOrderNumbers])).slice(0, 20)

    if (uniqueOrderNumbers.length === 0) return { count: 0, message: 'No orders needing sync found.' }

    // Step 2: Run Sync for each (PARALLEL for speed)
    let successCount = 0

    await Promise.all(uniqueOrderNumbers.map(async (orderNo) => {
        try {
            await syncOrderPurchaseCost(orderNo)
            successCount++
        } catch (e) {
            console.error(`Bulk sync failed for ${orderNo}`, e)
        }
    }))

    revalidatePath('/dashboard/sales/daraz/profit-tracker')
    return { count: successCount, message: `Synced/Fixed ${successCount} orders.` }
}

// Sync Specific List of Orders (from UI)
export async function syncSpecificOrders(orderNumbers: string[]) {
    if (!orderNumbers || orderNumbers.length === 0) return { count: 0, message: 'No orders provided.' }

    // Limit to 50 to avoid timeouts
    const targets = orderNumbers.slice(0, 50)
    let successCount = 0

    await Promise.all(targets.map(async (orderNo) => {
        try {
            await syncOrderPurchaseCost(orderNo)
            successCount++
        } catch (e) {
            console.error(`Specific sync failed for ${orderNo}`, e)
        }
    }))

    revalidatePath('/dashboard/sales/daraz/profit-tracker')
    return { count: successCount, message: `Synced ${successCount} orders.` }
}
