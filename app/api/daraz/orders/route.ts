
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import axios from 'axios'
import { syncOrderPurchaseCost } from '@/features/sales/actions/report-actions'

function signRequest(apiName: string, params: Record<string, any>, appSecret: string) {
    const keys = Object.keys(params).sort()
    let str = apiName
    keys.forEach(key => {
        str += key + params[key]
    })
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()
}

// Helper: Determine highest priority status from a list
function getProminentStatus(statuses: string[]): string {
    if (!statuses || statuses.length === 0) return 'Pending'

    const s = statuses.map(x => x.toLowerCase())

    // Priority 0: Unpaid (Highest priority if we want to show it distinctly)
    if (s.includes('unpaid')) return 'Unpaid'

    // Priority 1: Failures & Returns (Action Required)
    if (s.includes('returned') || s.includes('customer_return_delivered')) return 'Customer Return Delivered'
    if (s.includes('shipped_back_success') || s.includes('returned_delivered')) return 'Returned Delivered'
    if (s.includes('customer_return')) return 'Customer Return'
    // Failed Delivery basically means it's coming back, so we map it to Returning to Seller if user wants no specific "Delivery Failed" status
    if (s.includes('returning_to_seller') || s.includes('returning to seller') || s.includes('shipped_back') ||
        s.includes('failed_delivery') || s.includes('failed_delivered') || s.includes('delivery_failed') ||
        s.includes('delivery failed') || s.includes('failed')) return 'Returning to Seller'

    // Priority 3: Success Flow (Most Advanced State) - Check these FIRST to capture active movement
    if (s.includes('delivered') || s.includes('completed')) return 'Delivered'
    if (s.includes('shipped')) return 'Shipped'
    if (s.includes('ready_to_ship') || s.includes('ready to ship')) return 'Ready to Ship'
    if (s.includes('packed')) return 'Packed'

    // Priority 4: Pending (If any item is pending, the order is still active, even if some items are cancelled)
    if (s.includes('pending')) return 'Pending'

    // Priority 2: Cancellation (Only if NO success/pending/failure status exists)
    if (s.includes('canceled') || s.includes('cancelled')) return 'Cancel'

    return 'Pending'
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const storeId = searchParams.get('storeId')

    if (!storeId) {
        return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
    const appSecret = process.env.DARAZ_APP_SECRET
    const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

    if (!appKey || !appSecret) {
        return NextResponse.json({ error: 'Daraz API configuration missing' }, { status: 500 })
    }

    const supabase = await createClient()

    // 1. Get Token
    const { data: tokenData, error: dbError } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', storeId)
        .single()

    if (dbError || !tokenData) {
        return NextResponse.json({ error: 'No active connection found for this store. Please connect first.' }, { status: 401 })
    }

    // Check if we just want to load local data
    const source = searchParams.get('source')
    if (source === 'db') {
        const { data: localOrders, error: localError } = await supabase
            .from('daraz_orders')
            .select('*')
            .eq('store_id', storeId)
            .order('daraz_created_at', { ascending: false })

        if (localError) {
            return NextResponse.json({ error: 'Failed to fetch local orders', details: localError }, { status: 500 })
        }
        return NextResponse.json({ orders: localOrders || [], count: localOrders?.length || 0 })
    }

    try {
        const statusParam = searchParams.get('status')

        // 2. Prepare Base Params
        // Default to last 7 days for now to keep it light
        const createdAfter = new Date()
        createdAfter.setDate(createdAfter.getDate() - 7)

        let allOrders: any[] = []
        const API_LIMIT = 50 // Max limit per request
        let offset = 0
        let hasMore = true

        // User Request: Limit "Sync All" to ~150 orders for speed. Keep "Sync Pending" deeper.
        const MAX_SYNC_LIMIT = (statusParam === 'pending') ? 1000 : 150

        console.log(`Starting sync for store ${storeId}. Status: ${statusParam || 'ALL'} (Limit: ${MAX_SYNC_LIMIT})`)

        // Pagination Loop
        while (hasMore) {
            const params: Record<string, any> = {
                app_key: appKey,
                access_token: tokenData.access_token,
                timestamp: new Date().getTime(),
                sign_method: 'sha256',
                created_after: createdAfter.toISOString(),
                sort_direction: 'DESC',
                limit: API_LIMIT,
                offset: offset
            }

            if (statusParam && statusParam !== 'all') {
                params.status = statusParam
            }

            const apiPath = '/orders/get'
            params.sign = signRequest(apiPath, params, appSecret)

            console.log(`Fetching Daraz orders (Offset: ${offset}, Limit: ${API_LIMIT})...`)

            const response = await axios.get(`${apiUrl}${apiPath}`, { params })

            // Check for Daraz API error code (0 = success)
            if (response.data.code !== "0" && response.data.code !== 0) {
                console.error('Daraz API Error:', response.data)
                throw new Error(response.data.message || response.data.msg || 'Daraz API Error')
            }

            const batchOrders = response.data.data?.orders || []

            if (batchOrders.length > 0) {
                allOrders = [...allOrders, ...batchOrders]
            }

            // Check pagination
            if (batchOrders.length < API_LIMIT) {
                hasMore = false
            } else {
                offset += API_LIMIT

                // Enforce Sync Limit
                if (offset >= MAX_SYNC_LIMIT) {
                    console.log(`Reached sync limit of ${MAX_SYNC_LIMIT} orders. Stopping.`)
                    hasMore = false
                }

                // Safety break (absolute max)
                if (offset > 1000) {
                    hasMore = false
                }

                // Small delay between pages
                await new Promise(r => setTimeout(r, 200))
            }
        }

        console.log(`Total orders fetched: ${allOrders.length}`)
        const orders = allOrders

        // 3. Enrich with Items (Sequential Fetch to avoid Rate Limiting)
        // Rate limits are often tight (e.g. 5 req/sec). Promise.all bursts too hard.
        const enrichedOrders = []

        // Use allOrders fetched from loop
        for (const order of allOrders) {
            try {
                // Formatting helper for logs
                const oid = order.order_id

                // ... item fetch logic (keep as is structure, just ensure loop variable is correct)
                const itemTimestamp = new Date().getTime()
                const itemParams: Record<string, any> = {
                    app_key: appKey,
                    access_token: tokenData.access_token,
                    timestamp: itemTimestamp,
                    sign_method: 'sha256',
                    order_id: oid
                }
                itemParams.sign = signRequest('/order/items/get', itemParams, appSecret)

                // Small delay to be nice to the API (50ms)
                await new Promise(resolve => setTimeout(resolve, 50))

                const itemRes = await axios.get(`${apiUrl}/order/items/get`, { params: itemParams })

                const items = itemRes.data.data || []

                enrichedOrders.push({
                    ...order,
                    store_id: storeId,
                    items_detail: items
                })
            } catch (err) {
                console.error(`Error fetching items for order ${order.order_id}`, err)
                // Fail gracefully but keep order
                enrichedOrders.push({ ...order, store_id: storeId, items_detail: [] })
            }
        }

        // No need to slice/combine anymore since we try map all
        const finalOrders = enrichedOrders

        // 4. Upsert to Database (Persistence) & Auto-Sync Logic
        if (finalOrders.length > 0) {
            // A. Fetch Products for SKU matching
            const { data: products } = await supabase
                .from('products')
                .select('id, seller_sku1, seller_sku2, seller_sku3, seller_sku4, product_name, seller_account')
                .limit(10000)

            // Fetch Sync Settings (Cutoff Date)
            let cutoffDate: Date | null = null
            try {
                const { data: settings, error: settingsError } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'daraz_sync_rules')
                    .single()

                if (!settingsError && settings?.value?.cutoff_date) {
                    cutoffDate = new Date(settings.value.cutoff_date)
                }
            } catch (err) {
                console.warn('Sync settings table missing or error, proceeding without cutoff:', err)
            }

            // Map for quick lookup
            const skuMap = new Map<string, any>()
            const nameMap = new Map<string, any>()

            products?.forEach(p => {
                if (p.seller_sku1) skuMap.set(p.seller_sku1.toLowerCase(), p)
                if (p.seller_sku2) skuMap.set(p.seller_sku2.toLowerCase(), p)
                if (p.seller_sku3) skuMap.set(p.seller_sku3.toLowerCase(), p)
                if (p.seller_sku4) skuMap.set(p.seller_sku4.toLowerCase(), p)
                if (p.product_name) nameMap.set(p.product_name.toLowerCase().trim(), p)
            })

            // B. Batch fetch ALL existing orders to avoid N queries in the loop
            const allOrderIds = finalOrders.map(o => String(o.order_id)).filter(Boolean)
            const allOrderNumbers = finalOrders.map(o => String(o.order_number)).filter(Boolean)

            // Split into chunks if too large (Supabase 'in' limit ~65k params, but safe side 1000)
            // For now assuming < 1000 orders in sync

            const [existingByIdResults, existingByNumberResults] = await Promise.all([
                supabase
                    .from('daraz_orders')
                    .select('id, invoice_number, order_status, order_number, order_id, import_source')
                    .in('order_id', allOrderIds),
                supabase
                    .from('daraz_orders')
                    .select('id, invoice_number, order_status, order_number, order_id, import_source')
                    .in('order_number', allOrderNumbers)
            ])

            // Create lookup maps
            const existingByIdMap = new Map<string, any>()
            const existingByNumberMap = new Map<string, any>()

            existingByIdResults.data?.forEach(order => {
                if (order.order_id) existingByIdMap.set(String(order.order_id), order)
            })

            existingByNumberResults.data?.forEach(order => {
                if (order.order_number) existingByNumberMap.set(String(order.order_number), order)
            })

            // C. Process each order
            for (const o of finalOrders) {
                const itemStatuses = o.items_detail?.map((i: any) => i.status).filter(Boolean) || []
                const orderStatuses = o.statuses || (o.status ? [o.status] : [])
                const allStatuses = Array.from(new Set([...orderStatuses, ...itemStatuses]))
                const salesStatus = getProminentStatus(allStatuses)
                const status = orderStatuses[0]?.toLowerCase() || 'pending'
                const orderId = String(o.order_id)
                const orderDate = new Date(o.created_at)

                // Logic: Exclude Unpaid/Cancel from Sales
                const shouldBeInSales = !['unpaid', 'cancel', 'canceled', 'cancelled'].includes(status)
                const isBeforeCutoff = cutoffDate && orderDate < cutoffDate
                const effectiveShouldSync = shouldBeInSales && !isBeforeCutoff

                let existingOrderObj = existingByIdMap.get(orderId) || existingByNumberMap.get(String(o.order_number)) || null

                if (!effectiveShouldSync) {
                    if (existingOrderObj && isBeforeCutoff) { // Only soft delete if cutoff violation, user might want cancel updates?
                        // If we want to hide cancelled orders that were previously synced:
                        // User said: "except unpaid or cancel". So if it BECOMES cancel, we hide it?
                        // Soft delete is the safest way to "hide" from sales lists which filter deleted=false.
                        if (['cancel', 'canceled', 'cancelled'].includes(status)) {
                            console.log(`[DarazSync] Soft deleting cancelled order ${orderId}`)
                            await supabase.from('daraz_orders').update({ deleted: true, order_status: salesStatus }).eq('id', existingOrderObj.id)
                        }
                    }
                    continue;
                }

                // Prepare Data
                const shipping = typeof o.address_shipping === 'string' ? JSON.parse(o.address_shipping || '{}') : o.address_shipping || {}
                const billing = typeof o.address_billing === 'string' ? JSON.parse(o.address_billing || '{}') : o.address_billing || {}
                const shippingPhone = shipping.phone || shipping.Phone || null

                let trackingCode: string | null = null
                if (!['pending', 'unpaid', 'canceled'].includes(status)) {
                    const codes = new Set<string>()
                    if (o.tracking_code) codes.add(o.tracking_code)
                    if (o.items_detail && Array.isArray(o.items_detail)) {
                        o.items_detail.forEach((i: any) => {
                            const code = i.tracking_code || i.trackingCode || i.tracking_number || i.package_id
                            if (code) codes.add(String(code))
                        })
                    }
                    trackingCode = codes.size > 0 ? Array.from(codes).join(', ') : null
                }

                let invoiceNumber = existingOrderObj?.invoice_number
                if (!invoiceNumber && effectiveShouldSync) {
                    const { data: invData, error: invErr } = await supabase.rpc('generate_daraz_invoice_number')
                    if (!invErr) invoiceNumber = invData
                }

                // Common Payload
                const commonPayload: any = {
                    order_status: salesStatus,
                    statuses: allStatuses,
                    daraz_updated_at: o.updated_at,
                    synced_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    deleted: false,
                    import_source: 'api_sync',
                    shipped_by: null, delivered_by: null, failed_delivered_by: null, customer_returned_by: null, edit_by: null,
                    edited_at: o.updated_at ? new Date(o.updated_at).toISOString() : new Date().toISOString()
                }

                // Timestamps mapping
                const eventTime = o.updated_at ? new Date(o.updated_at).toISOString() : new Date().toISOString()
                if (salesStatus === 'Shipped') commonPayload.shipped_at = eventTime
                if (salesStatus === 'Delivered') commonPayload.delivered_at = eventTime
                if (salesStatus === 'Failed Delivered') commonPayload.failed_delivered_at = eventTime
                if (salesStatus === 'Delivery Failed') commonPayload.delivery_failed_at = eventTime
                if (salesStatus === 'Customer Return') commonPayload.customer_return_at = eventTime
                if (salesStatus === 'Returning To Seller') commonPayload.returning_to_seller_at = eventTime
                if (salesStatus === 'Customer Return Delivered') commonPayload.customer_return_delivered_at = eventTime
                if (salesStatus === 'Cancel' || salesStatus === 'Cancelled') commonPayload.cancelled_at = eventTime

                let savedOrder
                if (existingOrderObj) {
                    console.log(`[DarazSync] Updating existing order ${orderId}`)
                    const updatePayload = {
                        ...commonPayload,
                        tracking_code: trackingCode,
                        tracking_number: trackingCode,
                        invoice_number: invoiceNumber,
                        order_id: String(o.order_id),
                        store_id: storeId
                    }
                    if (existingOrderObj.import_source === 'manual' || existingOrderObj.import_source === 'csv') {
                        delete (updatePayload as any).import_source
                    }
                    const { data, error } = await supabase.from('daraz_orders').update(updatePayload).eq('id', existingOrderObj.id).select().single()
                    if (error) console.error(`[DarazSync] Update failed for ${orderId}:`, error)
                    savedOrder = data
                } else {
                    console.log(`[DarazSync] Inserting new order ${orderId}`)
                    const { data, error } = await supabase.from('daraz_orders').upsert({
                        ...commonPayload,
                        order_id: String(o.order_id),
                        order_number: String(o.order_number),
                        store_id: storeId,
                        customer_first_name: o.customer_first_name,
                        customer_last_name: o.customer_last_name,
                        shipping_name: shipping.first_name || shipping.firstName || shipping.name || o.customer_first_name || 'N/A',
                        shipping_address: shipping.address1 || shipping.address2 || billing.address1 || '',
                        shipping_city: shipping.city || shipping.City,
                        shipping_postcode: shipping.post_code || shipping.postCode || shipping.PostCode,
                        shipping_phone: shippingPhone,
                        tracking_code: trackingCode,
                        tracking_number: trackingCode,
                        invoice_number: invoiceNumber,
                        customer_name: shipping.first_name || shipping.firstName || shipping.name || o.customer_name || o.customer_first_name || 'Guest',
                        price: o.price,
                        items_count: o.items_count,
                        daraz_created_at: o.created_at,
                        order_date: o.created_at,
                        order_source: 'sync'
                    }, { onConflict: 'order_id' }).select().single()
                    if (error) console.error(`[DarazSync] Insert failed for ${orderId}:`, error)
                    savedOrder = data
                }

                if (!savedOrder) {
                    console.log(`[DarazSync] No savedOrder for ${orderId}, skipping items`)
                    continue
                }

                // 4. Sync Items
                const allItems = o.items_detail || []
                const itemsToSync = allItems.filter((item: any) => !['unpaid', 'canceled', 'cancelled'].includes((item.status || '').toLowerCase()))

                if (itemsToSync.length > 0) {
                    await supabase.from('daraz_order_items').delete().eq('order_id', savedOrder.id)

                    const orderItemsPayload = []
                    let sequence = 1
                    for (const item of itemsToSync) {
                        const shopSku = item.shop_sku || item.ShopSku || ''
                        const sku = item.sku || item.Sku || ''
                        const itemStatus = item.status || 'pending'
                        const itemName = (item.name || '').toLowerCase().trim()

                        let matchedProduct = skuMap.get(sku.toLowerCase()) || skuMap.get(shopSku.toLowerCase())
                        if (!matchedProduct && itemName) matchedProduct = nameMap.get(itemName)

                        orderItemsPayload.push({
                            order_id: savedOrder.id,
                            seller_sku: sku || shopSku,
                            product_id: matchedProduct?.id || null,
                            product_name: matchedProduct?.product_name || item.name || 'Unknown Product',
                            seller_account: matchedProduct?.seller_account || 'Unknown',
                            quantity: 1,
                            amount: item.item_price || item.price || 0,
                            status: itemStatus,
                            item_sequence: sequence++
                        })
                    }

                    if (orderItemsPayload.length > 0) {
                        const aggregatedItems = new Map<string, any>()
                        orderItemsPayload.forEach(p => {
                            const key = p.seller_sku + '_' + p.amount
                            if (aggregatedItems.has(key)) {
                                aggregatedItems.get(key).quantity += 1
                            } else {
                                aggregatedItems.set(key, p)
                            }
                        })
                        await supabase.from('daraz_order_items').insert(Array.from(aggregatedItems.values()))
                    }
                }

                // Auto-sync Finance
                if (effectiveShouldSync && salesStatus === 'Delivered') {
                    try {
                        await syncOrderPurchaseCost(String(o.order_number))
                    } catch (e) {
                        console.error('Auto-sync finance failed', e)
                    }
                }
            }
        }

        // Return Statement Correction
        return NextResponse.json({ orders: finalOrders, count: allOrders.length })

    } catch (error: any) {
        console.error('Order Fetch Error:', error.response?.data || error.message)
        return NextResponse.json({
            error: 'Failed to fetch orders from Daraz',
            details: error.response?.data || error.message
        }, { status: 500 })
    }
}
