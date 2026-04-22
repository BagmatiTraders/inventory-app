
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://shblzjrzulnrsarfxptv.supabase.co';
const supabaseKey = 'sb_secret_PaA5qtMPuL--0kHtBzWHQg_seL1iINA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLivePrices() {
    const { data, error } = await supabase.from('daraz_live_prices').select('seller_sku, sku_id, quantity').limit(5);
    if (error) {
        console.error(error);
        return;
    }
    console.log('Live prices sample:', data);
}

checkLivePrices();
