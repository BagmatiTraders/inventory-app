
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://shblzjrzulnrsarfxptv.supabase.co';
const supabaseKey = 'sb_secret_PaA5qtMPuL--0kHtBzWHQg_seL1iINA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const { data, error } = await supabase.from('products').select('*').limit(2);
    if (error) {
        console.error(error);
        return;
    }
    console.log('Sample data:', data.map(d => ({ name: d.product_name, s1: d.seller_sku1, s2: d.seller_sku2 })));
}

checkData();
