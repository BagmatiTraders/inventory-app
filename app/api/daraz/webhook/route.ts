import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { syncSingleDarazOrderAction } from '@/features/sales/actions/daraz-sync-order'

// Signature verification using HMAC-SHA256
function verifySignature(appKey: string, body: string, appSecret: string, receivedSignature: string): boolean {
    const base = appKey + body
    const hmac = crypto.createHmac('sha256', appSecret)
    hmac.update(base)
    const expectedSignature = hmac.digest('hex').toLowerCase()

    return expectedSignature === receivedSignature.toLowerCase()
}

export async function POST(request: NextRequest) {
    const startTime = Date.now()

    try {
        const rawBody = await request.text()
        const authorization = request.headers.get('authorization')

        // Handle empty body (Verification tests from Daraz can sometimes be empty or simple pings)
        if (!rawBody || rawBody.trim() === '') {
            console.log('[Webhook] Received empty body, acknowledging with 200.')
            return NextResponse.json({ success: true, message: 'Empty body acknowledged' })
        }

        if (!authorization) {
            console.error('[Webhook] Missing authorization header')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let payload: any
        try {
            payload = JSON.parse(rawBody)
        } catch (e) {
            console.error('[Webhook] Invalid JSON parsing error:', e)
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
        const appSecret = process.env.DARAZ_APP_SECRET

        if (!appKey || !appSecret) {
            console.error('[Webhook] Missing Daraz credentials')
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const isValid = verifySignature(appKey, rawBody, appSecret, authorization)
        if (!isValid) {
            console.error('[Webhook] Invalid signature')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        console.log('[Webhook] Signature verified successfully')

        // [RACE CONDITION FIX] Add a small random jitter delay (0-500ms)
        // This helps prevent parallel webhooks from hitting the DB at the exact same microsecond
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500))

        const { message_type, data, seller_id } = payload

        // Type 4: Trade Order (New/Updated Order)
        // Type 10: Reverse Order (Returns/Refunds) - needed for "Customer Return Delivered"
        // Type 14: Order Fulfillment Status Update
        if ((message_type === 4 || message_type === 10 || message_type === 14) && data) {
            const tradeOrderId = data.trade_order_id || data.order_id || data.reverse_order_id

            if (!tradeOrderId) {
                console.warn('[Webhook] Message received but missing trade_order_id:', data)
                return NextResponse.json({ success: true, message: 'Missing order ID' })
            }

            console.log(`[Webhook] Processing message_type: ${message_type} for Order: ${tradeOrderId} (Seller ID: ${seller_id})`)

            const supabase = await createAdminClient()

            // 1. Map seller_id to store_id
            const { data: store, error: storeError } = await supabase
                .from('online_stores')
                .select('id, seller_account')
                .eq('seller_id', String(seller_id))
                .maybeSingle()

            if (storeError) {
                console.error('[Webhook] Database error finding store:', storeError)
                return NextResponse.json({ success: true, message: 'Database error' })
            }

            if (!store) {
                console.error(`[Webhook] ❌ Store NOT FOUND for seller_id: "${seller_id}". Please check Store Settings.`)
                return NextResponse.json({ success: true, message: 'Store mapping missing' })
            }

            console.log(`[Webhook] Matched Store: ${store.seller_account} (${store.id})`)

            // 2. Trigger shared sync logic
            try {
                const result = await syncSingleDarazOrderAction(String(tradeOrderId), store.id)
                console.log(`[Webhook] ✅ Order ${tradeOrderId} auto-synced. Status: ${result.newStatus}`)

                return NextResponse.json({
                    success: true,
                    message: `Order ${tradeOrderId} auto-synced`,
                    status: result.newStatus,
                    elapsed_ms: Date.now() - startTime
                })
            } catch (syncError: any) {
                console.error(`[Webhook] ❌ Sync failed for order ${tradeOrderId}:`, syncError.message)
                return NextResponse.json({
                    success: true,
                    message: 'Sync failed but acknowledged',
                    error: syncError.message
                })
            }
        }

        console.log(`[Webhook] Received message_type: ${message_type} (no specific handler)`)
        return NextResponse.json({ success: true, message: 'Message acknowledged' })

    } catch (error: any) {
        console.error('[Webhook] Critical Error:', error)
        return NextResponse.json({
            success: true,
            message: 'Acknowledged with error',
            error: error.message
        })
    }
}
