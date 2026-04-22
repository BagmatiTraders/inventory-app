
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://shblzjrzulnrsarfxptv.supabase.co';
const supabaseKey = 'sb_secret_PaA5qtMPuL--0kHtBzWHQg_seL1iINA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listColumns() {
    const { data, error } = await supabase.from('products').select('*').limit(1);
    if (error) {
        console.error(error);
        return;
    }
    console.log('Columns in products table:', Object.keys(data[0] || {}));
}

listColumns();
