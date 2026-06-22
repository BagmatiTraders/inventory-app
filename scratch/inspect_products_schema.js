const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching product:', error);
    } else if (products && products.length > 0) {
        console.log('Products columns:', Object.keys(products[0]));
        console.log('Sample Product:', products[0]);
    } else {
        console.log('No products found in database.');
    }
}

run();
