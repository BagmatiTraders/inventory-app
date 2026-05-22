import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Validation middleware
async function validateApiKey(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false
    }
    const apiKey = authHeader.split(' ')[1]
    return apiKey === process.env.MESSENGER_APP_API_KEY
}

// Helper to generate sales ID
async function generateSalesId(supabase: any, orderDate?: string) {
    const { data, error } = await supabase
        .rpc('generate_website_sales_id', {
            for_date: orderDate || new Date().toISOString().split('T')[0]
        })

    if (error) {
        console.error('Error generating sales ID:', error)
        const date = new Date(orderDate || Date.now())
        const prefix = 'WS-' + (date.getMonth() + 1).toString().padStart(2, '0') + date.getDate().toString().padStart(2, '0')
        const random = Math.floor(Math.random() * 90000) + 10001
        return `${prefix}-${random}`
    }

    return data
}

export async function POST(req: NextRequest) {
    // 1. Validate API Key
    if (!await validateApiKey(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        console.log('Received payload for website orders:', JSON.stringify(body, null, 2))

        const {
            order_number,
            customer_name,
            phone_number,
            alternative_phone,
            address,
            items,
            total_amount,
            delivery_charge,
            order_status,
            // Synced fields
            platform,
            page_name,
            logistic_name,
            courier_provider,
            courier_consignment_id,
            city,
            delivery_branch,
            branch_charge,
            messaging_app_order_id,
            confirmed_at,
            confirmed_by
        } = body

        const supabase = await createAdminClient()

        // 2. Generate Sales ID
        const salesId = await generateSalesId(supabase)

        // 3. Determine branch and branch charge based on courier provider
        let branchValue = null
        let branchChargeValue = branch_charge || 0

        if (courier_provider === 'pathao') {
            branchValue = city
        } else if (courier_provider === 'local') {
            branchValue = delivery_branch
        }

        // 4. Validate and format phone numbers
        const formattedPhoneNumber = phone_number?.replace(/\D/g, '').slice(0, 10) || ''
        const formattedAltPhone = alternative_phone?.replace(/\D/g, '').slice(0, 10) || null

        // 5. Create Order
        const { data: order, error: orderError } = await supabase
            .from('website_orders')
            .insert({
                sales_id: salesId,
                order_date: new Date().toISOString().split('T')[0],
                customer_name,
                phone_number: formattedPhoneNumber,
                alternative_phone: formattedAltPhone,
                address,
                delivery_branch: branchValue,
                branch_charge: branchChargeValue,
                delivery_charge: delivery_charge || 0,
                total_amount: total_amount || 0,
                order_status: order_status || 'Pending',
                user_type: 'System',
                order_type: 'Website',
                remarks: `Synced from Messenger App (Order #${order_number})`,
                platform,
                page_name,
                logistic_name,
                courier_provider,
                courier_consignment_id,
                city,
                messaging_app_order_id,
                confirmed_at,
                confirmed_by
            })
            .select()
            .single()

        if (orderError) {
            console.error('Order creation error:', orderError)
            return NextResponse.json({ 
                error: orderError.message,
                details: 'Failed to create website order'
            }, { status: 500 })
        }

        // 6. Create Items
        if (items && items.length > 0) {
            const itemsToInsert = items.map((item: any) => ({
                order_id: order.id,
                product_id: item.product_id,
                product_name: item.product_name || item.name,
                quantity: item.quantity,
                amount: item.price || 0
            }))

            const { error: itemsError } = await supabase
                .from('website_order_items')
                .insert(itemsToInsert)

            if (itemsError) {
                console.error('Items creation error:', itemsError)
                return NextResponse.json({ error: 'Order created but items failed: ' + itemsError.message }, { status: 500 })
            }
        }

        return NextResponse.json({
            success: true,
            data: order,
            message: 'Website order created successfully'
        })

    } catch (error: any) {
        console.error('API Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
