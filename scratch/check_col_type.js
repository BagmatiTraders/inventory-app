const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://shblzjrzulnrsarfxptv.supabase.co';
const supabaseKey = 'sb_secret_PaA5qtMPuL--0kHtBzWHQg_seL1iINA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // We can query pg_catalog to get actual types since we have service role access
    const { data, error } = await supabase.rpc('execute_sql', {
        query_text: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'products'"
    });
    
    if (error) {
        // Fallback: If no rpc function, query a view if we can, or just print info
        console.error('RPC execute_sql error:', error);
        
        // Let's try direct query via select if we can't run raw SQL
        const { data: cols } = await supabase.from('products').select('product_id').limit(5);
        console.log('Sample product_ids:', cols);
        return;
    }
    console.log('Columns types:', data);
}

run();
