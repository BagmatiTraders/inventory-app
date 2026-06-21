const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: stores, error: storeErr } = await supabase.from('online_stores').select('id, seller_account, seller_id')
    if (storeErr) {
        console.error('Error fetching online stores:', storeErr)
    } else {
        console.log('\n--- online_stores ---')
        console.log(stores)
    }
}

run()
