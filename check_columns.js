const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    console.log('Checking columns...');
    // Just try to select the columns from a single row. If error, they don't exist.
    const { data: testData, error: testError } = await supabase
        .from('daraz_orders')
        .select('customer_return_delivered_at, returned_delivered_at, returning_to_seller_at, delivery_failed_at, customer_return_at')
        .limit(1);

    if (testError) {
        console.log('Error/Missing:', testError.message);
    } else {
        console.log('All columns exist!');
    }
}

checkColumns();
