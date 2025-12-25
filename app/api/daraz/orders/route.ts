
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
        const timestamp = new Date().getTime()

        // 2. Prepare Order Params
        // Default to last 7 days for now to keep it light
        const createdAfter = new Date()
        createdAfter.setDate(createdAfter.getDate() - 7)

        const params: Record<string, any> = {
            app_key: appKey,
            access_token: tokenData.access_token,
            timestamp: timestamp,
            sign_method: 'sha256',
            created_after: createdAfter.toISOString(),
            sort_direction: 'DESC',
            limit: 20, // Start small
            offset: 0
        }

        const apiPath = '/orders/get'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log('Fetching Daraz orders...', { params })

        const response = await axios.get(`${apiUrl}${apiPath}`, { params })

        // Check for Daraz API error code (0 = success)
        if (response.data.code !== "0" && response.data.code !== 0) {
            console.error('Daraz API Error:', response.data)
            return NextResponse.json({
                error: 'Daraz API returned error',
                details: response.data.message || response.data.msg || 'Unknown error'
            }, { status: 500 })
        }

        const orders = response.data.data?.orders || []

        // 3. Enrich with Items (Fetch for ALL 20 orders - limit is safe)
        const enrichedOrders = await Promise.all(orders.map(async (order: any) => {
            try {
                const itemTimestamp = new Date().getTime()
                const itemParams: Record<string, any> = {
                    app_key: appKey,
                    access_token: tokenData.access_token,
                    timestamp: itemTimestamp,
                    sign_method: 'sha256',
                    order_id: order.order_id
                }
                itemParams.sign = signRequest('/order/items/get', itemParams, appSecret)

                const itemRes = await axios.get(`${apiUrl}/order/items/get`, { params: itemParams })
                return {
                    ...order,
                    store_id: storeId, // Inject store_id for frontend
                    items_detail: itemRes.data.data || []
                }
            } catch (err) {
                console.error(`Error fetching items for order ${order.order_id}`, err)
                return { ...order, store_id: storeId, items_detail: [] } // Fail gracefully
            }
        }))

        // No need to slice/combine anymore since we try map all
        const finalOrders = enrichedOrders

        // 4. Upsert to Database (Persistence) & Auto-Sync Logic
        if (finalOrders.length > 0) {
            // A. Fetch Products for SKU matching
            const { data: products } = await supabase
                .from('products')
                .select('id, seller_sku1, seller_sku2, seller_sku3, seller_sku4, product_name, seller_account')

            // Fetch Sync Settings (Cutoff Date) - with safety check
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
                // Ignore error, proceed with null cutoff
            }

            // Map for quick lookup: SKU -> Product
            const skuMap = new Map<string, any>()
            products?.forEach(p => {
                if (p.seller_sku1) skuMap.set(p.seller_sku1.toLowerCase(), p)
                if (p.seller_sku2) skuMap.set(p.seller_sku2.toLowerCase(), p)
                if (p.seller_sku3) skuMap.set(p.seller_sku3.toLowerCase(), p)
                if (p.seller_sku4) skuMap.set(p.seller_sku4.toLowerCase(), p)
            })

            // B. Batch fetch ALL existing orders to avoid N queries in the loop
            const allOrderIds = finalOrders.map(o => String(o.order_id)).filter(Boolean)
            const allOrderNumbers = finalOrders.map(o => String(o.order_number)).filter(Boolean)

            const [existingByIdResults, existingByNumberResults] = await Promise.all([
                supabase
                    .from('daraz_orders')
                    .select('id, invoice_number, order_status, order_number, order_id')
                    .in('order_id', allOrderIds),
                supabase
                    .from('daraz_orders')
                    .select('id, invoice_number, order_status, order_number, order_id')
                    .in('order_number', allOrderNumbers)
            ])

            // Create lookup maps for O(1) access
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
                const status = (o.statuses?.[0] || o.status || 'pending').toLowerCase()
                const orderId = String(o.order_id)
                const orderDate = new Date(o.created_at)

                // Logic: "Pending - Pending, Packed, Ready to ship" -> Sales "Pending"
                let salesStatus = 'Pending'
                if (['packed'].includes(status)) salesStatus = 'Packed'
                if (['ready_to_ship'].includes(status)) salesStatus = 'Ready to Ship'
                if (['shipped'].includes(status)) salesStatus = 'Shipped'
                if (['delivered', 'completed'].includes(status)) salesStatus = 'Delivered'
                if (['failed', 'returned'].includes(status)) salesStatus = status === 'returned' ? 'Customer Return' : 'Failed Delivered'
                if (['canceled'].includes(status)) salesStatus = 'Cancel'

                // Rule: "Did not add Canceled and Unpaid"
                // But we must check if we need to UPDATE an existing one to 'Cancel' or DELETE/IGNORE 'Unpaid'.
                // If it's canceled, we WANT it in sales with status 'Cancel'.
                // If 'unpaid', we generally ignore it unless it was previously synced? (Unpaid usually implies pre-verification).
                const shouldBeInSales = !['unpaid'].includes(status)

                // Rule: Cutoff Date
                // If order is OLDER than cutoff, do not add to sales entry (keep as raw daraz order only)
                const isBeforeCutoff = cutoffDate && orderDate < cutoffDate

                const effectiveShouldSync = shouldBeInSales && !isBeforeCutoff

                // 1. Check if order exists using pre-fetched Maps (O(1) lookup, no DB call)
                let existingOrderObj = existingByIdMap.get(orderId) || existingByNumberMap.get(String(o.order_number)) || null

                if (existingOrderObj && !existingByIdMap.has(orderId)) {
                    console.log(`[DarazSync] Matched manual order ${existingOrderObj.order_number} to Daraz ID ${orderId}`)
                }

                if (!effectiveShouldSync) {
                    // Logic: If status is Unpaid OR Before Cutoff, handle accordingly.
                    // If order exists in DB but now violates rules (Before Cutoff), 
                    // we must Soft Delete it to remove from Sales Entry view.
                    if (existingOrderObj && isBeforeCutoff) {
                        console.log(`[DarazSync] Removing order ${orderId} (BeforeCutoff: ${isBeforeCutoff})`)
                        await supabase
                            .from('daraz_orders')
                            .update({
                                deleted: true,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', existingOrderObj.id)
                    }
                    continue; // Skip further processing
                }

                // Debug log
                if (existingOrderObj && existingOrderObj.order_status !== salesStatus) {
                    console.log(`[DarazSync] Status Update for ${orderId}: ${existingOrderObj.order_status} -> ${salesStatus}`)
                }

                // 2. Prepare Daraz Order Data
                const shipping = typeof o.address_shipping === 'string' ? JSON.parse(o.address_shipping || '{}') : o.address_shipping || {}
                const billing = typeof o.address_billing === 'string' ? JSON.parse(o.address_billing || '{}') : o.address_billing || {}
                const shippingPhone = shipping.phone || shipping.Phone || null

                // Tracking
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

                // Generate Invoice if new
                if (!invoiceNumber && effectiveShouldSync) {
                    const { data: invData, error: invErr } = await supabase.rpc('generate_daraz_invoice_number')
                    if (!invErr) invoiceNumber = invData
                }

                // 3. Upsert Order Header with Sync Logic
                let savedOrder
                let upsertError

                // Common Payload
                const commonPayload: any = {
                    order_status: salesStatus,
                    statuses: o.statuses || (o.status ? [o.status] : []),
                    daraz_updated_at: o.updated_at,
                    synced_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    deleted: false,
                    import_source: 'api_sync', // Signal for trigger

                    // Explicit timestamp updates (mapped from Daraz updated_at as proxy if strictly needed)
                    // Just pass nulls for _by columns to let the trigger handle them (or we set them to null explicitly)
                    // Note: If we set them to NULL here, and trigger sees 'api_sync', it should respect them.
                    shipped_by: null,
                    delivered_by: null,
                    failed_delivered_by: null,
                    customer_returned_by: null,

                    // Enable "Edited by Daraz Sync"
                    // User requested: "if status is Packed then edited {timestamp} by daraz sync"
                    // We treat any status change update as an 'Edit'
                    edit_by: null,
                    edited_at: o.updated_at ? new Date(o.updated_at).toISOString() : new Date().toISOString()
                }

                // If status is specific, we might want to backfill the timestamp from Daraz if available
                // Daraz `updated_at` is the best we have for the event time usually.
                const eventTime = o.updated_at ? new Date(o.updated_at).toISOString() : new Date().toISOString()

                if (salesStatus === 'Shipped') commonPayload.shipped_at = eventTime
                if (salesStatus === 'Delivered') commonPayload.delivered_at = eventTime
                if (salesStatus === 'Failed Delivered') commonPayload.failed_delivered_at = eventTime
                if (salesStatus === 'Customer Return') commonPayload.customer_returned_at = eventTime


                // If matched by ID or Order Number, Update it
                if (existingOrderObj) {
                    // Preserve original import_source for manual/CSV orders
                    const updatePayload = {
                        ...commonPayload,
                        tracking_code: trackingCode,
                        tracking_number: trackingCode,
                        // If linking manual order, ensure order_id is set
                        order_id: String(o.order_id),
                        store_id: storeId // Ensure store ID is linked
                    }

                    // Don't overwrite import_source for manual/CSV orders
                    if (existingOrderObj.import_source === 'manual' || existingOrderObj.import_source === 'csv') {
                        delete (updatePayload as any).import_source
                    }

                    const { data, error } = await supabase
                        .from('daraz_orders')
                        .update(updatePayload)
                        .eq('id', existingOrderObj.id)
                        .select()
                        .single()

                    savedOrder = data
                    upsertError = error
                } else {
                    // New order - Full Upsert
                    const { data, error } = await supabase
                        .from('daraz_orders')
                        .upsert({
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
                            items_detail: o.items_detail,
                            daraz_created_at: o.created_at,
                            order_date: o.created_at,
                            order_source: 'sync' // From Daraz API sync
                        }, { onConflict: 'order_id' })
                        .select()
                        .single()

                    savedOrder = data
                    upsertError = error
                }

                if (upsertError) {
                    console.error(`Failed to sync order ${orderId}:`, upsertError)
                    continue
                }

                if (!savedOrder) continue

                // STOP here if we are not booking to sales entry
                if (!effectiveShouldSync) continue;

                // 4. Sync Items (Populate daraz_order_items for Sales Entry)
                const allItems = o.items_detail || []

                // Filter out unpaid and canceled items
                const itemsToSync = allItems.filter((item: any) => {
                    const itemStatus = (item.status || '').toLowerCase()
                    // Only include items that are paid/confirmed (not unpaid or canceled)
                    return !['unpaid', 'canceled', 'cancelled'].includes(itemStatus)
                })

                console.log(`[DarazSync] Order ${orderId}: ${allItems.length} total items, ${itemsToSync.length} after filtering (excluded unpaid/canceled)`)

                // Full Replace items
                await supabase.from('daraz_order_items').delete().eq('order_id', savedOrder.id)

                const orderItemsPayload = []
                let sequence = 1

                for (const item of itemsToSync) {
                    const shopSku = item.shop_sku || item.ShopSku || ''
                    const sku = item.sku || item.Sku || ''
                    const itemStatus = item.status || 'pending'
                    const matchedProduct = skuMap.get(sku.toLowerCase()) || skuMap.get(shopSku.toLowerCase())

                    orderItemsPayload.push({
                        order_id: savedOrder.id,
                        seller_sku: sku || shopSku,
                        product_id: matchedProduct?.id || null,
                        product_name: matchedProduct?.product_name || item.name || 'Unknown Product',
                        seller_account: matchedProduct?.seller_account || 'Unknown',
                        quantity: 1,
                        amount: item.item_price || item.price || 0,
                        status: itemStatus, // Store individual item status
                        item_sequence: sequence++
                    })
                }

                if (orderItemsPayload.length > 0) {
                    // Aggregate proper logic if needed, but for now strict 1:1 or basic aggregation
                    const aggregatedItems = new Map<string, any>()
                    orderItemsPayload.forEach(p => {
                        const key = p.seller_sku + '_' + p.amount // Aggregate by SKU AND Price
                        if (aggregatedItems.has(key)) {
                            const existing = aggregatedItems.get(key)
                            existing.quantity += 1
                        } else {
                            aggregatedItems.set(key, p)
                        }
                    })

                    await supabase.from('daraz_order_items').insert(Array.from(aggregatedItems.values()))
                }

                // Update the object in finalOrders 
                (o as any).invoice_number = invoiceNumber;
                (o as any).is_synced_to_sales = true

            }
        }

        return NextResponse.json({ orders: finalOrders, count: response.data.data?.count || finalOrders.length })

    } catch (error: any) {
        console.error('Order Fetch Error:', error.response?.data || error.message)
        return NextResponse.json({
            error: 'Failed to fetch orders from Daraz',
            details: error.response?.data || error.message
        }, { status: 500 })
    }
}
