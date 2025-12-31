import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// Signature verification using HMAC-SHA256
function verifySignature(appKey: string, body: string, appSecret: string, receivedSignature: string): boolean {
    const base = appKey + body
    const hmac = crypto.createHmac('sha256', appSecret)
    hmac.update(base)
    const expectedSignature = hmac.digest('hex').toLowerCase()

    return expectedSignature === receivedSignature.toLowerCase()
}

// Map Daraz webhook status to our database status
function mapWebhookStatus(status: string): string {
    const statusMap: Record<string, string> = {
        'PACKED': 'Packed',
        'READY_TO_SHIP': 'Ready to Ship',
        'SHIPPED': 'Shipped',
        'DELIVERED': 'Delivered',
        'COMPLETED': 'Delivered',
        'CANCELED': 'Cancel',
        'CANCELLED': 'Cancel',
        'FAILED_DELIVERY': 'Failed Delivered',
        'FAILED_DELIVERED': 'Failed Delivered',
        'DELIVERY_FAILED': 'Delivery Failed',
        'RETURNING_TO_SELLER': 'Returning To Seller',
        'CUSTOMER_RETURN': 'Customer Return',
        'RETURNED': 'Customer Return',
        'CUSTOMER_RETURN_DELIVERED': 'Customer Return Delivered',
        'RETURNED_DELIVERED': 'Customer Return Delivered',
    }

    return statusMap[status.toUpperCase()] || status
}

export async function POST(request: NextRequest) {
    const startTime = Date.now()

    try {
        // Get raw body as text for signature verification
        const rawBody = await request.text()
        const authorization = request.headers.get('authorization')

        if (!authorization) {
            console.error('[Webhook] Missing authorization header')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Parse JSON
        let payload: any
        try {
            payload = JSON.parse(rawBody)
        } catch (e) {
            console.error('[Webhook] Invalid JSON:', e)
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        // Get credentials
        const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
        const appSecret = process.env.DARAZ_APP_SECRET

        if (!appKey || !appSecret) {
            console.error('[Webhook] Missing Daraz credentials')
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // Verify signature
        const isValid = verifySignature(appKey, rawBody, appSecret, authorization)

        if (!isValid) {
            console.error('[Webhook] Invalid signature')
            console.error('[Webhook] Expected base:', appKey + rawBody.substring(0, 100) + '...')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        console.log('[Webhook] Signature verified successfully')

        // Handle different message types
        const { message_type, data, seller_id, timestamp, site } = payload

        // Message type 14 = Order fulfillment status update
        if (message_type === 14 && data) {
            const { trade_order_id, status, status_update_time } = data

            if (!trade_order_id || !status) {
                console.error('[Webhook] Missing required fields:', data)
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
            }

            console.log(`[Webhook] Order ${trade_order_id} status: ${status}`)

            // Map status
            const mappedStatus = mapWebhookStatus(status)

            // Update database
            const supabase = await createClient()

            // Find order by order_id (trade_order_id)
            const { data: existingOrder, error: findError } = await supabase
                .from('daraz_orders')
                .select('id, statuses, order_status')
                .eq('order_id', trade_order_id)
                .single()

            if (findError || !existingOrder) {
                console.log(`[Webhook] Order ${trade_order_id} not found in database, skipping update`)
                // Still return 200 to prevent retries
                return NextResponse.json({
                    success: true,
                    message: 'Order not in database, acknowledged'
                })
            }

            // Update statuses array and order_status
            const updatedStatuses = Array.from(new Set([...(existingOrder.statuses || []), status]))

            const { error: updateError } = await supabase
                .from('daraz_orders')
                .update({
                    order_status: mappedStatus,
                    statuses: updatedStatuses,
                    daraz_updated_at: new Date(status_update_time * 1000).toISOString(),
                    synced_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existingOrder.id)

            if (updateError) {
                console.error('[Webhook] Database update error:', updateError)
                // Still return 200 to prevent retries for DB issues
                return NextResponse.json({
                    success: true,
                    message: 'Acknowledged but update failed',
                    error: updateError.message
                })
            }

            const elapsed = Date.now() - startTime
            console.log(`[Webhook] Order ${trade_order_id} updated successfully in ${elapsed}ms`)

            return NextResponse.json({
                success: true,
                message: 'Order status updated',
                elapsed_ms: elapsed
            })
        }

        // Other message types - acknowledge but don't process
        console.log(`[Webhook] Received message_type: ${message_type} (not handled)`)
        return NextResponse.json({
            success: true,
            message: 'Message acknowledged'
        })

    } catch (error: any) {
        console.error('[Webhook] Error:', error)
        const elapsed = Date.now() - startTime

        // Return 200 even on error to prevent retries for our internal issues
        return NextResponse.json({
            success: true,
            message: 'Acknowledged with error',
            error: error.message,
            elapsed_ms: elapsed
        })
    }
}
