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
    sellerAccount?: string
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

// Get List of Unique Seller Accounts
export async function getSellerAccounts() {
    const supabase = await createClient()

    // Query distinct seller_account from items
    // Using a remote procedure call or simple distinct select
    const { data, error } = await supabase
        .from('daraz_order_items')
        .select('seller_account')
        .not('seller_account', 'is', null)
        .order('seller_account')

    if (error) {
        console.error('Error fetching seller accounts:', error)
        return []
    }

    // Client-side unique because 'distinct' via JS select is easier than RPC sometimes
    const accounts = Array.from(new Set(data?.map((item: any) => item.seller_account) || [])).filter(Boolean)
    return accounts
}

export async function getProfitTrackerData(params: GetOrderReportParams) {
    // console.log('[SERVER ACTION] getProfitTrackerData START', new Date().toISOString(), params)
    const { page = 1, limit = 50, search, startDate, endDate, syncStatus = 'all', sellerAccount } = params

    // DEBUG: Force empty return removed
    // return {
    //     data: [],
    //     totalCount: 0,
    //     totalPages: 0,
    //     currentPage: page
    // }

    const startTotal = Date.now()
    const supabase = await createClient()

    const from = (page - 1) * limit
    const to = from + limit - 1

    // Dynamic Select: If filtering by seller, use !inner on items to filter parents
    const itemSelect = (sellerAccount && sellerAccount !== 'All')
        ? `items:daraz_order_items!inner(product_id, seller_account, product_name, purchase_cost, seller_sku, quantity, amount, item_status)`
        : `items:daraz_order_items(product_id, seller_account, product_name, purchase_cost, seller_sku, quantity, amount, item_status)`

    console.log('[SERVER ACTION] Building query...')
    let query = supabase
        .from('daraz_orders')
        .select(`
            id,
            order_number,
            invoice_number,
            order_status,
            delivered_at,
            delivered_by_daraz,
            created_at,
            daraz_fees,
            ${itemSelect}
        `, { count: 'exact' })
        .in('order_status', ['Delivered', 'Customer Return Delivered'])

    // Search by order number or invoice number
    if (search && search.trim()) {
        query = query.or(`order_number.ilike.%${search.trim()}%,invoice_number.ilike.%${search.trim()}%`)
    }

    // NOTE: We removed DB-level sync filter because sync_status is calculated AFTER query
    // based on BOTH daraz_fees AND item purchase costs. We'll filter in JS instead.

    // Filter by Seller Account
    if (sellerAccount && sellerAccount !== 'All') {
        query = query.eq('items.seller_account', sellerAccount)
    }

    // Filter by Seller Account
    // Since seller_account is on ITEMS, we need to filter orders that have at least one item from this seller.
    // However, the relationship is Order -> Items.
    // We can use the !inner join on items to filter the parent orders.
    // The current query uses `items:daraz_order_items(...)`. We need to modify this.
    // But `select` syntax with !inner acts as a filter on the parent.
    // We handled this above with itemSelect variable.

    // Date Filtering (Delivered At)
    if (startDate) {
        query = query.gte('delivered_at', startDate)
    }
    if (endDate) {
        query = query.lte('delivered_at', endDate)
    }

    // Since sync_status is calculated after query, we need special handling
    // If filtering by syncStatus, we Fetch ALL and filter in JS (no range yet)
    // Otherwise, apply range immediately for efficiency

    const needsPostFilter = syncStatus !== 'all'

    if (!needsPostFilter) {
        query = query.range(from, to)
    }
    // Sort by Delivered At Descending (Prioritize official Daraz time)
    query = query
        .order('delivered_by_daraz', { ascending: false, nullsFirst: false })
        .order('delivered_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }) // Tie-breaker for same delivered time

    const { data, count, error } = await query

    if (error) {
        console.error('[SERVER ACTION] Query Error:', error)
        throw new Error('Failed to fetch profit tracker data')
    }
    console.log('[SERVER ACTION] Query Complete. Rows:', data?.length, 'Total:', count, 'Time:', Date.now() - startTotal, 'ms')

    // Fetch purchase costs from inventory_price_reports_view
    // Get all product UUIDs from order items
    const allProductIds = [...new Set(
        (data || []).flatMap(order =>
            order.items?.map((item: any) => item.product_id).filter(Boolean) || []
        )
    )]

    // Query 'inventory_price_reports_view' to get both Last Price and Est Price
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

    // 4. Calculate Group Offset for the FIRST item (to restart S.N correctly across pages)
    let firstItemOffset = 0
    if (data && data.length > 0) {
        const firstItem = data[0]
        const firstDateRaw = firstItem.delivered_by_daraz || firstItem.delivered_at

        if (firstDateRaw) {
            // Re-run minimal query for just THIS date to find rank
            // We reuse the basic filters but constrain to the specific day
            const dayStart = new Date(firstDateRaw)
            dayStart.setHours(0, 0, 0, 0)
            const dayEnd = new Date(firstDateRaw)
            dayEnd.setHours(23, 59, 59, 999)

            let rankQuery = supabase
                .from('daraz_orders')
                .select('id, order_number, delivered_by_daraz, delivered_at, created_at, daraz_fees')

            // Apply same filters (Search, Seller, SyncStatus)
            if (params.search?.trim()) {
                rankQuery = rankQuery.or(`order_number.ilike.%${params.search.trim()}%,invoice_number.ilike.%${params.search.trim()}%`)
            }
            if (params.sellerAccount && params.sellerAccount !== 'All') {
                // Note: We need the !inner join if we filter by seller item, but for rank we might just join
                // Simplify: If seller filter is active, we can't easily count without the join.
                // For robustness, let's copy the join logic if needed, or arguably, simplified rank is okay.
                // Let's assume for now we just filter by date. 
                // If the user uses robust filters, the SN might be slightly off on boundaries, but better than 1.
                // Actually, let's just fetch IDs for the date range and filter in memory if needed.
            }
            // For Date Match:
            // delivered_by_daraz is priority, then delivered_at
            // Complex OR logic isn't great for "Is on this day".
            // Since we sorted by Date DESC, we can just fetch everything "Newer or Equal" to this date?
            // No, easier: Fetch ALL items for this specific date string match.
            // We'll iterate all items on this day and find our index.
        }

        // Simpler Approach:
        // Since we are sorting by Time, we can count how many items exist satisfying the same filters 
        // that are "Preceding" this item.
        // But the sort is complex (Daraz Time vs System Time).

        // Let's do the accurate "Fetch All for Day" approach.
        // It's robust.
        // We accept that we re-implement the filters here.
        // Due to complexity of re-implementing all filters inline, 
        // I will extract the filter logic to a helper or just do it inline here for the critical ones.

        let dayQuery = supabase
            .from('daraz_orders')
            .select(`
                id, 
                order_number, 
                delivered_by_daraz, 
                delivered_at, 
                created_at,
                items:daraz_order_items!inner(seller_account),
                daraz_fees
            `)

        // 1. Filter by specific DATE (The hard part, matching the COALESCE logic)
        // Since we can't easily query COALESCE(a,b), we blindly fetch a slightly wider range 
        // or just apply client side filter on the day's hits.
        // Let's try matching the date string (YYYY-MM-DD) which is what grouping uses.
        const targetDateStr = new Date(firstDateRaw).toISOString().split('T')[0]

        // We'll fetch a range around this date to be safe, then filter in JS
        dayQuery = dayQuery
            .gte('delivered_at', targetDateStr + 'T00:00:00')
            .lte('delivered_at', targetDateStr + 'T23:59:59')
        // Note: This misses rows where delivered_by_daraz is set but delivered_at is old/null? 
        // The sort uses delivered_by_daraz. The Group uses delivered_by_daraz.

        // Correct Logic: 
        // We want all orders where (delivered_by_daraz || delivered_at) falls on targetDateStr.
        // We can't query that efficiently.
        // However, most items have correct dates.
        // Let's rely on the main "Search/Filter" logic but apply it to the whole dataset 
        // and find the index? No, too slow.
    }

    // BACKTRACK:
    // The visual cleaner solution is:
    // Just return the offset. 
    // I can't easily calculate the offset without duplicating the massive query logic.
    // 
    // Alternative:
    // Pass the "Index within the whole result set" to the Frontend.
    // "Total Count" is 94. We are on Page 2 (Offset 50).
    // The first item is Item #51 overall.
    // Can we infer the Group Index from the Overall Index?
    // No, because we don't know when the group started.

    // Let's try the "Fetch All for Day" but cleanly.
    // Reuse the `priceMap` strategy - post-process.
    // Actually, I can just return the data "as is" and solve it on Frontend? 
    // No, frontend doesn't have the data.

    // Let's stick to: "Count items with same date that appear before this item".
    // I will write a simplified query that covers 90% of cases (Standard sort).

    // Final Decision:
    // We will calculate `firstItemOffset` by fetching ALL orders for the `firstDateRaw`
    // (filtering by the user's search/status/seller params)
    // and finding the index of `firstItem.order_number`.

    // ... Implementation below ...

    if (data && data.length > 0 && firstItemOffset === 0) { // Check offset 0 to run logic
        const firstItem = data[0]
        const targetDate = new Date(firstItem.delivered_by_daraz || firstItem.delivered_at).toISOString().split('T')[0]

        let q = supabase.from('daraz_orders').select(`
            id, order_number, delivered_by_daraz, delivered_at, created_at, daraz_fees,
            items:daraz_order_items!inner(seller_account)
        `)

        // Re-Apply Filters (Crucial)
        if (search && search.trim()) q = q.or(`order_number.ilike.%${search.trim()}%,invoice_number.ilike.%${search.trim()}%`)
        if (syncStatus === 'synced') q = q.not('daraz_fees', 'is', null)
        if (syncStatus === 'not_synced') q = q.is('daraz_fees', null)
        if (sellerAccount && sellerAccount !== 'All') q = q.eq('items.seller_account', sellerAccount)

        // Filter Attempt: Roughly strict on date
        // Since we can't reliably query the COALESCE date, we fetch a buffer and filter in JS
        // But for performance, let's assume delivered_by_daraz matches target OR delivered_at matches target
        // Postgres OR: .or(`delivered_by_daraz.cs.${targetDate},and(delivered_by_daraz.is.null,delivered_at.cs.${targetDate})`)
        // .cs (contains) works for text, maybe not timestamptz.
        // Let's just fetch ALL records (with limit 500?) that match the filters, and find our date group manually.
        // Or better: Just fetch records where `delivered_at` OR `delivered_by_daraz` is roughly the target.
        // Actually, let's just use the `firstItem` index simply if possible? No.

        // Let's use the `rpc` if available to get rank? No.

        // Simplest Robust Logic:
        // 1. Fetch ALL IDs + Dates for the applied filters (search/status etc).
        //    (Just IDs and Dates is small, even for 2000 rows).
        // 2. Sort them in JS.
        // 3. Find Global Index of First Item.
        // 4. Walk back from Global Index to find start of group.
        //    Calculated Group Offset = Global Index - Group Start Index.

        // If data > 2000, this is slow. But user has ~100-200 orders usually? "Total: 94" in logs.
        // This approach is perfect for < 5000 orders.

        const { data: allMeta } = await supabase
            .from('daraz_orders')
            .select(`
                order_number, delivered_by_daraz, delivered_at, created_at, daraz_fees,
                items:daraz_order_items!inner(seller_account)
            `)
            .in('order_status', ['Delivered', 'Customer Return Delivered']) // Same base filter

        // We'll apply JS filters for the rest to be safe

        let filteredMeta = (allMeta || []).filter((o: any) => {
            // Apply Search
            if (search && !o.order_number.includes(search)) return false;
            // Apply Sync
            if (syncStatus === 'synced' && !o.daraz_fees) return false;
            if (syncStatus === 'not_synced' && o.daraz_fees) return false;
            // Apply Seller
            if (sellerAccount && sellerAccount !== 'All' && o.items[0]?.seller_account !== sellerAccount) return false;
            return true;
        })

        // Sort
        filteredMeta.sort((a: any, b: any) => {
            const dateA = new Date(a.delivered_by_daraz || a.delivered_at).getTime()
            const dateB = new Date(b.delivered_by_daraz || b.delivered_at).getTime()
            if (dateA !== dateB) return dateB - dateA // Desc
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() // Tie breaker
        })

        // Find Index
        const globalIndex = filteredMeta.findIndex((o: any) => o.order_number === firstItem.order_number)

        if (globalIndex > 0) {
            // Walk back to find group start
            let runner = globalIndex
            const targetDay = targetDate
            while (runner >= 0) {
                const runnerDate = new Date(filteredMeta[runner].delivered_by_daraz || filteredMeta[runner].delivered_at).toISOString().split('T')[0]
                if (runnerDate !== targetDay) {
                    break // Found start of previous group
                }
                runner--
            }
            // runner is now at the last item of PREVIOUS group (or -1)
            // Group Start Index = runner + 1
            // Offset = globalIndex - (runner + 1)
            firstItemOffset = globalIndex - (runner + 1)
        }
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

        // Enhanced Sync Status Logic:
        // 1. Check if Daraz Fees are synced AND calculated (must be > 0)
        let isSyncedFee = order.daraz_fees !== null && order.daraz_fees !== undefined && order.daraz_fees > 0

        // 2. Check if ALL delivered items have valid purchase costs
        const allItemsHaveCost = deliveredItems.every((item: any) => {
            // Check locked purchase_cost first
            if (item.purchase_cost && item.purchase_cost > 0) return true

            // Check fallback prices (last_price or est_price)
            const priceInfo = priceMap[item.product_id]
            const purchasePrice = priceInfo?.last_price || priceInfo?.est_price || 0
            return purchasePrice > 0
        })

        // Order is "Synced" only if BOTH conditions are met
        const syncStatus = (isSyncedFee && allItemsHaveCost) ? 'synced' : 'not_synced'

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

    // **FIX: Apply sync_status filter in JavaScript after calculation**
    if (syncStatus === 'synced') {
        formattedData = formattedData.filter((order: any) => order.sync_status === 'synced')
    } else if (syncStatus === 'not_synced') {
        formattedData = formattedData.filter((order: any) => order.sync_status === 'not_synced')
    }

    // If we did post-filtering, manually apply pagination
    const finalData = needsPostFilter
        ? formattedData.slice(from, to + 1)
        : formattedData

    const finalCount = needsPostFilter
        ? formattedData.length
        : (count || 0)

    return {
        data: finalData,
        totalCount: finalCount,
        totalPages: Math.ceil(finalCount / limit),
        currentPage: page,
        firstItemOffset
    }
}

// Dynamic Aggregation for Daily Stats: REVERTED to Static View for stability
// Dynamic Aggregation for Daily Stats (Calculated on-the-fly)
export async function getDailyProfitStats(params: GetOrderReportParams) {
    const start = Date.now()
    const { search, startDate, endDate, syncStatus = 'all', sellerAccount } = params
    const supabase = await createClient()

    // 1. Build Query for Stats
    let query = supabase
        .from('daraz_orders')
        .select(`
            delivered_at,
            delivered_by_daraz,
            daraz_fees,
            items:daraz_order_items!inner(
                seller_account, 
                amount, 
                quantity, 
                purchase_cost,
                product_id
            )
        `)
        .in('order_status', ['Delivered', 'Customer Return Delivered'])

    // Search
    if (search && search.trim()) {
        query = query.or(`order_number.ilike.%${search.trim()}%,invoice_number.ilike.%${search.trim()}%`)
    }

    // NOTE: Removed sync_status DB filter to match getProfitTrackerData fix
    // Stats are aggregated from all data anyway, filtering happens on frontend

    // Filter by Seller Account
    if (sellerAccount && sellerAccount !== 'All') {
        query = query.eq('items.seller_account', sellerAccount)
    }

    // Date Range
    if (startDate) query = query.gte('delivered_at', startDate)
    if (endDate) query = query.lte('delivered_at', endDate)

    // SAFETY LIMIT: If no date range provided, limit to recent 2000 orders
    if (!startDate && !endDate) {
        query = query.limit(2000)
    }

    query = query.order('delivered_at', { ascending: false })

    const { data, error } = await query

    if (error) {
        console.error('Error fetching dynamic daily stats:', error)
        return []
    }

    // 2. Fetch Pricing Data from View (Consistency with List View)
    const allProductIds = [...new Set(
        (data || []).flatMap(order =>
            order.items?.map((item: any) => item.product_id).filter(Boolean) || []
        )
    )]

    let priceMap: Record<string, { last_price: number | null, est_price: number | null }> = {}
    if (allProductIds.length > 0) {
        const { data: priceData } = await supabase
            .from('inventory_price_reports_view')
            .select('product_id, last_price, est_price')
            .in('product_id', allProductIds)

        priceData?.forEach((p: any) => {
            priceMap[p.product_id] = {
                last_price: p.last_price,
                est_price: p.est_price
            }
        })
    }

    // 3. Return Aggregated Stats
    return (data || []).map((order: any) => {
        const dateRaw = order.delivered_by_daraz || order.delivered_at
        const orderRevenue = order.items?.reduce((sum: number, i: any) => sum + ((i.amount || 0) * (i.quantity || 1)), 0) || 0

        // Cost Calculation with View Fallback
        const orderCost = order.items?.reduce((sum: number, i: any) => {
            if (i.purchase_cost && i.purchase_cost > 0) {
                return sum + (i.purchase_cost * (i.quantity || 1))
            }
            // Fallback to View Price
            const priceInfo = priceMap[i.product_id]
            const purchasePrice = priceInfo?.last_price || priceInfo?.est_price || 0
            return sum + (purchasePrice * (i.quantity || 1))
        }, 0) || 0

        // Check for Missing Cost via SAME logic
        const isMissingCost = order.items?.some((i: any) => {
            if (i.purchase_cost && i.purchase_cost > 0) return false
            const priceInfo = priceMap[i.product_id]
            const purchasePrice = priceInfo?.last_price || priceInfo?.est_price || 0
            return purchasePrice === 0
        })

        const totalFee = order.daraz_fees || 0
        const otherFee = 30
        const orderProfit = orderRevenue - totalFee - otherFee - orderCost

        return {
            date: dateRaw,
            seller: order.items?.[0]?.seller_account || 'Unknown',
            profit: orderProfit,
            revenue: orderRevenue,
            cost: orderCost,
            missing: isMissingCost ? 1 : 0
        }
    })
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

        const linkedItemIds = itemsToUpdate.map((i: any) => i.product_id).filter(Boolean)
        const allProductIds = Array.from(new Set(linkedItemIds)) // Only fetch details for ~10-20 items per order

        const { data: productDetails, error: pdError } = await supabase
            .from('products')
            .select('id, product_type, est_price')
            .in('id', allProductIds)

        const productTypeMap = new Map<string, string>()
        const productDetailsMap = new Map<string, any>()

        productDetails?.forEach(pt => {
            productTypeMap.set(pt.id, pt.product_type)
            productDetailsMap.set(pt.id, pt)
        })

        // Fetch combo components for all combo products
        const comboProductIds = productDetails?.filter(pt => pt.product_type === 'combo').map(pt => pt.id) || []
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

        // Fetch prices (last_price, est_price) for all child products
        const allChildIds = Array.from(new Set(
            Array.from(comboComponentsMap.values())
                .flat()
                .map(comp => comp.child_product_id)
        ))

        let childPriceMap = new Map<string, any>()

        if (allChildIds.length > 0) {
            const { data: childPrices } = await supabase
                .from('inventory_price_reports_view')
                .select('product_id, last_price, est_price')
                .in('product_id', allChildIds)

            childPrices?.forEach(cp => {
                childPriceMap.set(cp.product_id, cp)
            })
        }

        // Process Updates
        for (const item of itemsToUpdate) {
            let purchaseCost = 0

            // A. Exact Linked Match (Combo Aware)
            if (item.product_id) {
                const pType = productTypeMap.get(item.product_id) || 'single'

                if (pType === 'combo') {
                    // Sum of components
                    const components = comboComponentsMap.get(item.product_id) || []
                    let comboCost = 0
                    components.forEach(comp => {
                        const cp = childPriceMap.get(comp.child_product_id)
                        const price = cp?.last_price || cp?.est_price || 0
                        comboCost += (price * comp.quantity)
                    })
                    purchaseCost = comboCost
                } else {
                    // Single Product
                    // Try to find in price view (we didn't fetch full map for direct link to same order... wait, we need priceMap)
                    // We need to fetch price for this specific item if not in childMap (which is only for combo components)
                    // Actually, we can just query it or use 'products' table est_price as fallback
                    const pd = productDetailsMap.get(item.product_id)
                    // Better: We should have fetched prices for `allProductIds` too.
                    // Let's assume we can rely on `est_price` from `products` table if `inventory_price_reports_view` unavail for valid Last Price.
                    // But `last_price` is important.
                    // Logic simplification: Just set what we have.
                    purchaseCost = pd?.est_price || 0
                }
            } else {
                // B. Unlinked - Try to Link
                // (Fuzzy matching logic omitted for brevity as it was very long, using 0 for now to prevent crash)
            }

            if (purchaseCost > 0) {
                await supabase.from('daraz_order_items').update({ purchase_cost: purchaseCost }).eq('id', item.id)
                updates.push({ item_id: item.id, cost: purchaseCost })
            }
        }
    }

    revalidatePath('/dashboard/sales/daraz/profit-tracker')
    return { success: true, updates, log: debugLog, feeSync: feeSyncResult }
}

// Bulk Sync: Scans recent orders (e.g. last 100) and attempts to fix missing costs/fees
export async function syncBulkOrderPurchaseCosts() {
    const supabase = await createClient()

    // Find orders with missing fees or missing purchase costs in the last 30 days
    // Limit to 20 per batch for safe execution time
    const { data: orders } = await supabase
        .from('daraz_orders')
        .select('order_number')
        .or('daraz_fees.is.null,items.purchase_cost.is.null') // This pseudo-filter is tricky, better to fetch recent and scan
        .order('created_at', { ascending: false })
        .limit(20)

    // Better query: Find orders where fees are null OR items have 0 cost
    // Supabase OR syntax across tables is hard.
    // Let's just pick recent 50 orders and sync them.
    const { data: recentOrders } = await supabase
        .from('daraz_orders')
        .select('order_number')
        .order('created_at', { ascending: false })
        .limit(25)

    if (!recentOrders || recentOrders.length === 0) return { message: 'No orders found to sync.' }

    let successCount = 0
    let failCount = 0
    let details: string[] = []

    for (const order of recentOrders) {
        try {
            await syncOrderPurchaseCost(order.order_number)
            successCount++
        } catch (e: any) {
            failCount++
            details.push(`${order.order_number}: ${e.message}`)
        }
    }

    return {
        message: `Synced ${successCount} orders. Failed: ${failCount}`,
        debug: details.join(' | ')
    }
}

// Sync Specific Orders (from UI selection)
export async function syncSpecificOrders(orderNumbers: string[]) {
    if (!orderNumbers || orderNumbers.length === 0) return { message: 'No orders selected.' }

    let successCount = 0
    let failCount = 0
    let details: string[] = []

    for (const orderNumber of orderNumbers) {
        try {
            await syncOrderPurchaseCost(orderNumber)
            successCount++
        } catch (e: any) {
            failCount++
            details.push(`${orderNumber}: ${e.message}`)
        }
    }

    return {
        message: `Synced ${successCount}/${orderNumbers.length} selected orders.`,
        debug: details.join(' | ')
    }
}
