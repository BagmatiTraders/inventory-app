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

function getProminentStatus(statuses: string[]): string {
    if (!statuses || statuses.length === 0) return 'Pending'
    const s = statuses.map(x => x.toLowerCase())

    // Priority 1: Failures & Returns
    if (s.includes('failed') || s.includes('failed_delivery') || s.includes('failed_delivered') || s.includes('failed delivery') || s.includes('failed delivered')) return 'Failed Delivered'
    if (s.includes('delivery_failed') || s.includes('delivery failed')) return 'Delivery Failed'
    if (s.includes('returned') || s.includes('customer_return')) return 'Customer Return'

    // Priority 2: Cancellation
    if (s.includes('canceled') || s.includes('cancelled')) return 'Cancel'

    // Priority 3: Success Flow
    if (s.includes('delivered') || s.includes('completed')) return 'Delivered'
    if (s.includes('shipped')) return 'Shipped'
    if (s.includes('ready_to_ship') || s.includes('ready to ship')) return 'Ready to Ship'
    if (s.includes('packed')) return 'Packed'

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

        // Update in database
        const { data: existingOrder } = await supabase
            .from('daraz_orders')
            .select('id')
            .eq('order_id', orderId)
            .single()

        if (existingOrder) {
            // Extract item statuses and combine with order status
            const itemStatuses = items.map((i: any) => i.status).filter(Boolean)
            const orderStatuses = order.statuses || (order.status ? [order.status] : [])
            const allStatuses = Array.from(new Set([...orderStatuses, ...itemStatuses]))

            // Calculate the prominent status
            const newStatus = getProminentStatus(allStatuses as string[])

            await supabase
                .from('daraz_orders')
                .update({
                    order_status: newStatus,
                    statuses: allStatuses,
                    items_detail: items,
                    daraz_updated_at: order.updated_at,
                    synced_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingOrder.id)

            console.log(`[DarazRefresh] Updated order ${orderId}: ${newStatus} from statuses:`, allStatuses)

            // --- SYNC ITEMS FOR REPORTS (Fix for Missing Costs) ---
            if (items.length > 0) {
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
                    await supabase.from('daraz_order_items').delete().eq('order_id', existingOrder.id)

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

                        if (matchedProduct) {
                            console.log(`[DarazRefresh] Matched item ${item.name.slice(0, 20)}... -> ID ${matchedProduct.id}`)
                        }

                        orderItemsPayload.push({
                            order_id: existingOrder.id,
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
                        // Aggregate Logic (Strict 1:1 or basic sum)
                        const aggregatedItems = new Map<string, any>()
                        orderItemsPayload.forEach(p => {
                            const key = p.seller_sku + '_' + p.amount
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
        } else {
            return NextResponse.json({ error: 'Order not found in database' }, { status: 404 })
        }

    } catch (error: any) {
        console.error('Order Refresh Error:', error.response?.data || error.message)
        return NextResponse.json({
            error: 'Failed to refresh order',
            details: error.response?.data || error.message
        }, { status: 500 })
    }
}
