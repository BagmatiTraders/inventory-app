const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("Querying daraz_orders_with_totals columns...");
    const { data: order, error } = await supabase
        .from('daraz_orders_with_totals')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching order from view:", error);
    } else {
        console.log("View Columns:", Object.keys(order[0] || {}));
        console.log("Sample Order from View:", order[0]);
    }
}

run();
