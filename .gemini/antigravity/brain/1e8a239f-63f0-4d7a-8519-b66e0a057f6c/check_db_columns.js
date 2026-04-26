const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkColumns() {
    console.log('Checking daraz_orders columns...')
    const { data: orders, error: orderError } = await supabase.from('daraz_orders').select('*').limit(1)
    if (orderError) {
        console.error('Error fetching daraz_orders:', orderError.message)
    } else if (orders.length > 0) {
        console.log('daraz_orders columns:', Object.keys(orders[0]).join(', '))
    } else {
        console.log('daraz_orders table is empty.')
    }

    console.log('\nChecking daraz_order_items columns...')
    const { data: items, error: itemError } = await supabase.from('daraz_order_items').select('*').limit(1)
    if (itemError) {
        console.error('Error fetching daraz_order_items:', itemError.message)
    } else if (items.length > 0) {
        console.log('daraz_order_items columns:', Object.keys(items[0]).join(', '))
    } else {
        console.log('daraz_order_items table is empty.')
    }
}

checkColumns()
