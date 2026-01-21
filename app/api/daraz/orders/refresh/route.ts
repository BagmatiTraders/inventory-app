import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import axios from 'axios'

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

export async function POST(request: NextRequest) {
    const body = await request.json()
    const { orderId, storeId } = body

    if (!orderId || !storeId) {
        return NextResponse.json({ error: 'Order ID and Store ID are required' }, { status: 400 })
    }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
    const appSecret = process.env.DARAZ_APP_SECRET
    const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

    if (!appKey || !appSecret) {
        return NextResponse.json({ error: 'Daraz API configuration missing' }, { status: 500 })
    }

    const supabase = await createClient()

    // Get Token
    const { data: tokenData, error: dbError } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', storeId)
        .single()

    if (dbError || !tokenData) {
        return NextResponse.json({ error: 'No active connection found for this store.' }, { status: 401 })
    }

    try {
        const timestamp = new Date().getTime()

        // Fetch single order
        const params: Record<string, any> = {
            app_key: appKey,
            access_token: tokenData.access_token,
            timestamp: timestamp,
            sign_method: 'sha256',
            order_id: orderId
        }

        const apiPath = '/order/get'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log(`[DarazRefresh] Fetching order ${orderId}...`)

        const response = await axios.get(`${apiUrl}${apiPath}`, { params })

        if (response.data.code !== "0" && response.data.code !== 0) {
            console.error('Daraz API Error:', response.data)
            return NextResponse.json({
                error: 'Daraz API returned error',
                details: response.data.message || response.data.msg || 'Unknown error'
            }, { status: 500 })
        }

        const order = response.data.data

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        // Fetch items for this order
        const itemTimestamp = new Date().getTime()
        const itemParams: Record<string, any> = {
            app_key: appKey,
            access_token: tokenData.access_token,
            timestamp: itemTimestamp,
            sign_method: 'sha256',
            order_id: orderId
        }
        itemParams.sign = signRequest('/order/items/get', itemParams, appSecret)

        const itemRes = await axios.get(`${apiUrl}/order/items/get`, { params: itemParams })
        const items = itemRes.data.data || []

        console.log(`[DarazRefresh] Order ${orderId}: Fetched ${items.length} items`)

        // Check if exists
        const { data: existingOrder } = await supabase
            .from('daraz_orders')
            .select('*') // Select all to get invoice_number/status
            .eq('order_id', orderId)
            .single()

        let invoiceNumber = existingOrder?.invoice_number

        // Generate Invoice if new
        if (!invoiceNumber) {
            const { data: invData, error: invErr } = await supabase.rpc('generate_daraz_invoice_number')
            if (!invErr) invoiceNumber = invData
        }

        // Extract item statuses and combine with order status
        const itemStatuses = items.map((i: any) => i.status).filter(Boolean)
        const orderStatuses = order.statuses || (order.status ? [order.status] : [])
        const allStatuses = Array.from(new Set([...orderStatuses, ...itemStatuses]))

        // Calculate the prominent status
        const newStatus = getProminentStatus(allStatuses as string[])

        const hasExisting = !!existingOrder

        // Prepare Payload
        const shipping = typeof order.address_shipping === 'string' ? JSON.parse(order.address_shipping || '{}') : order.address_shipping || {}
        const billing = typeof order.address_billing === 'string' ? JSON.parse(order.address_billing || '{}') : order.address_billing || {}

        let trackingCode: string | null = null
        if (!['pending', 'unpaid', 'canceled'].includes(newStatus.toLowerCase())) {
            const codes = new Set<string>()
            if (order.tracking_code) codes.add(order.tracking_code)
            if (items && Array.isArray(items)) {
                items.forEach((i: any) => {
                    const code = i.tracking_code || i.trackingCode || i.tracking_number || i.package_id
                    if (code) codes.add(String(code))
                })
            }
            trackingCode = codes.size > 0 ? Array.from(codes).join(', ') : null
        }

        const upsertPayload: any = {
            order_id: String(orderId),
            order_number: String(order.order_number),
            store_id: storeId,
            order_status: newStatus,
            statuses: allStatuses,
            items_detail: items,
            daraz_updated_at: order.updated_at,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            invoice_number: invoiceNumber,
            deleted: false,

            // Basic fields for new orders
            customer_first_name: order.customer_first_name,
            customer_last_name: order.customer_last_name,
            shipping_name: shipping.first_name || shipping.firstName || shipping.name || order.customer_first_name || 'N/A',
            shipping_address: shipping.address1 || shipping.address2 || billing.address1 || '',
            shipping_city: shipping.city || shipping.City,
            shipping_postcode: shipping.post_code || shipping.postCode || shipping.PostCode,
            shipping_phone: shipping.phone || shipping.Phone || null,
            tracking_code: trackingCode,
            tracking_number: trackingCode,
            customer_name: shipping.first_name || shipping.firstName || shipping.name || order.customer_name || order.customer_first_name || 'Guest',
            price: order.price,
            items_count: order.items_count,
            // Only set create date if new, but safe to set always if we trust Daraz data
            daraz_created_at: order.created_at,
            order_date: order.created_at,
            order_source: 'sync'
        }

        // Capture official Daraz delivery timestamp
        if (newStatus === 'Delivered') {
            const eventTime = order.updated_at ? new Date(order.updated_at).toISOString() : new Date().toISOString()
            upsertPayload.delivered_by_daraz = eventTime
            // Also set delivered_at (Sync Time) so it shows in reports immediately
            upsertPayload.delivered_at = eventTime
        }

        // If updating, preserve certain fields?
        if (existingOrder) {
            // Keep original created_at or source if needed?
            // Usually fine to overwrite with current Daraz data
        } else {
            // New specific fields
        }

        const { data: savedOrder, error: saveError } = await supabase
            .from('daraz_orders')
            .upsert(upsertPayload, { onConflict: 'order_id' })
            .select()
            .single()

        if (saveError) {
            console.error('Failed to save refreshed order:', saveError)
            throw new Error('Failed to save order to database')
        }

        console.log(`[DarazRefresh] Updated/Inserted order ${orderId}: ${newStatus}`)

        // --- SYNC ITEMS FOR REPORTS ---
        if (items.length > 0 && savedOrder) {
            // 1. Fetch Products for SKU matching
            const { data: products } = await supabase
                .from('products')
                .select('id, seller_sku1, seller_sku2, seller_sku3, seller_sku4, product_name, seller_account')
                .limit(10000)

            // Map: SKU -> Product AND Name -> Product
            const skuMap = new Map<string, any>()
            const nameMap = new Map<string, any>()

            products?.forEach(p => {
                if (p.seller_sku1) skuMap.set(p.seller_sku1.toLowerCase(), p)
                if (p.seller_sku2) skuMap.set(p.seller_sku2.toLowerCase(), p)
                if (p.seller_sku3) skuMap.set(p.seller_sku3.toLowerCase(), p)
                if (p.seller_sku4) skuMap.set(p.seller_sku4.toLowerCase(), p)
                if (p.product_name) nameMap.set(p.product_name.toLowerCase().trim(), p)
            })

            // Filter items (Exclude Unpaid/Canceled if needed, but for manual refresh we generally trust the status)
            // But typically we don't show unpaid in reports.
            const itemsToSync = items.filter((item: any) => {
                const s = (item.status || '').toLowerCase()
                return !['unpaid', 'canceled', 'cancelled'].includes(s)
            })

            if (itemsToSync.length > 0) {
                await supabase.from('daraz_order_items').delete().eq('order_id', savedOrder.id)

                const orderItemsPayload = []
                let sequence = 1

                for (const item of itemsToSync) {
                    const shopSku = item.shop_sku || item.ShopSku || ''
                    const sku = item.sku || item.Sku || ''
                    const itemStatus = item.status || 'pending'
                    const itemName = (item.name || '').toLowerCase().trim()

                    // Try Match: SKU -> Name
                    let matchedProduct = skuMap.get(sku.toLowerCase()) || skuMap.get(shopSku.toLowerCase())
                    if (!matchedProduct && itemName) {
                        matchedProduct = nameMap.get(itemName)
                    }

                    // Debug log match
                    if (matchedProduct && !skuMap.get(sku.toLowerCase())) {
                        // console.log(`Matched item via name`)
                    }

                    orderItemsPayload.push({
                        order_id: savedOrder.id,
                        seller_sku: sku || shopSku,
                        product_id: matchedProduct?.id || null,
                        product_name: matchedProduct?.product_name || item.name || 'Unknown Product',
                        seller_account: matchedProduct?.seller_account || 'Unknown',
                        quantity: 1,
                        amount: item.item_price || item.price || 0,
                        status: itemStatus,
                        item_status: itemStatus,
                        item_sequence: sequence++
                    })
                }

                if (orderItemsPayload.length > 0) {
                    // Aggregate Logic (Strict 1:1 or basic sum)
                    const aggregatedItems = new Map<string, any>()
                    orderItemsPayload.forEach(p => {
                        // Include status in key to separate Partial Returns (e.g. 1 Delivered, 1 Returned)
                        const key = `${p.seller_sku}_${p.amount}_${p.status}`

                        if (aggregatedItems.has(key)) {
                            const existing = aggregatedItems.get(key)
                            existing.quantity += 1
                        } else {
                            aggregatedItems.set(key, p)
                        }
                    })
                    await supabase.from('daraz_order_items').insert(Array.from(aggregatedItems.values()))
                }
            }
        }
        // -----------------------------------------------------

        return NextResponse.json({
            success: true,
            message: 'Order refreshed successfully',
            newStatus: newStatus,
            statuses: allStatuses
        })

    } catch (error: any) {
        console.error('Order Refresh Error:', error.response?.data || error.message)
        return NextResponse.json({
            error: 'Failed to refresh order',
            details: error.response?.data || error.message
        }, { status: 500 })
    }
}
