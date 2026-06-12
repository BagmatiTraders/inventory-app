const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

async function run() {
    const { data: plans, error } = await supabase
        .from('purchase_plans')
        .select('*')
        .limit(3);

    if (error) {
        console.error(error);
        return;
    }
    console.log(JSON.stringify(plans, null, 2));
}
run();
