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
        .rpc('generate_marketplace_sales_id', {
            for_date: orderDate || new Date().toISOString().split('T')[0]
        })

    if (error) {
        console.error('Error generating sales ID:', error)
        const date = new Date(orderDate || Date.now())
        const prefix = (date.getMonth() + 1).toString().padStart(2, '0') + date.getDate().toString().padStart(2, '0')
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
        const {
            order_number, // We'll store this in remarks or external_id if available, or just rely on sales_id
            customer_name,
            phone_number,
            address,
            items,
            total_amount,
            delivery_charge
        } = body

        const supabase = await createAdminClient()

        // 2. Generate Sales ID
        const salesId = await generateSalesId(supabase)

        // 3. Create Order
        const { data: order, error: orderError } = await supabase
            .from('marketplace_orders')
            .insert({
                sales_id: salesId,
                order_date: new Date().toISOString().split('T')[0], // Today
                customer_name,
                phone_number,
                address,
                delivery_charge: delivery_charge || 0,
                total_amount: total_amount || 0,
                order_status: 'Pending',
                user_type: 'Messenger',
                remarks: `Imported from Messenger App (Order #${order_number})`,
                // We don't have a 'created_by' user UUID since it's an API call. 
                // Either define a system user or leave nullable if allowed.
                // Assuming it's nullable or we can skip it.
            })
            .select()
            .single()

        if (orderError) {
            console.error('Order creation error:', orderError)
            return NextResponse.json({ error: orderError.message }, { status: 500 })
        }

        // 4. Create Items
        if (items && items.length > 0) {
            const itemsToInsert = items.map((item: any) => ({
                order_id: order.id,
                product_id: item.product_id, // If mapping exists
                product_name: item.product_name || item.name,
                quantity: item.quantity,
                amount: item.price || 0
            }))

            const { error: itemsError } = await supabase
                .from('marketplace_order_items')
                .insert(itemsToInsert)

            if (itemsError) {
                console.error('Items creation error:', itemsError)
                // We created the order but failed items. Ideally strictly transactional.
                // For now, return error.
                return NextResponse.json({ error: 'Order created but items failed: ' + itemsError.message }, { status: 500 })
            }
        }

        return NextResponse.json({
            success: true,
            data: order,
            message: 'Order created successfully'
        })

    } catch (error: any) {
        console.error('API Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
