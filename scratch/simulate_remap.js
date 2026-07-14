// Full simulation of remapAllCategories logic using service role key
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://shblzjrzulnrsarfxptv.supabase.co',
  'sb_secret_PaA5qtMPuL--0kHtBzWHQg_seL1iINA'
)

async function simulateRemap() {
  console.log('=== STEP 1: Fetch all mappings ===')
  const { data: md, error: mapError } = await supabase
    .from('daraz_website_category_mappings')
    .select('daraz_category, website_category, marketplace_category')

  if (mapError) {
    console.log('ERROR fetching mappings:', mapError.message)
    return
  }
  console.log(`Total mapping rows: ${md?.length}`)

  // Build mapping map (exactly as code does)
  const mappingMap = new Map()
  for (const m of (md || [])) {
    if (m.daraz_category) {
      mappingMap.set(m.daraz_category.toLowerCase().trim(), {
        website_category: m.website_category || null,
        marketplace_category: m.marketplace_category || null,
      })
    }
  }
  console.log(`Mapping entries in map: ${mappingMap.size}`)

  // Show ALL mapping keys (lowercased)
  console.log('\nAll mapping keys:')
  for (const [key, val] of mappingMap) {
    console.log(`  "${key}" (len:${key.length}) → "${val.website_category}"`)
  }

  console.log('\n=== STEP 2: Fetch products with category_name ===')
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, category_name, website_category')
    .eq('is_deleted', false)
    .not('category_name', 'is', null)

  console.log(`Products with category_name: ${products?.length}`)
  products?.forEach(p => {
    const catKey = p.category_name.toLowerCase().trim()
    const mapping = mappingMap.get(catKey) || null
    console.log(`  cat="${p.category_name}" (key="${catKey}" len:${catKey.length}) → mapping=${JSON.stringify(mapping)} | current website_cat="${p.website_category}"`)
  })

  console.log('\n=== STEP 3: Group by category and update ===')
  const categoryGroups = new Map()
  for (const p of (products || [])) {
    if (!p.category_name) continue
    const key = p.category_name.toLowerCase().trim()
    if (!categoryGroups.has(key)) categoryGroups.set(key, { ids: [], original: p.category_name })
    categoryGroups.get(key).ids.push(p.id)
  }

  for (const [catKey, { ids, original }] of categoryGroups) {
    const mapping = mappingMap.get(catKey) || null
    const websiteCat = mapping?.website_category || null
    const marketplaceCat = mapping?.marketplace_category || null

    console.log(`\nUpdating category "${original}" (${ids.length} products) → website_category="${websiteCat}"`)
    const { error } = await supabase
      .from('products')
      .update({ website_category: websiteCat, marketplace_category: marketplaceCat })
      .in('id', ids)

    if (error) {
      console.log(`  ❌ ERROR: ${error.message}`)
    } else {
      console.log(`  ✅ Updated ${ids.length} product(s)`)
    }
  }

  console.log('\n=== STEP 4: Verify final state ===')
  const { data: verify } = await supabase
    .from('products')
    .select('product_name, category_name, website_category')
    .not('category_name', 'is', null)
  
  verify?.forEach(p => {
    console.log(`  "${p.product_name?.substring(0,35)}" | Daraz:"${p.category_name}" | Website:"${p.website_category}"`)
  })
}

simulateRemap().catch(console.error)
