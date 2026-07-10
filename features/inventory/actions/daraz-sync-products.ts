'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { signRequest } from '@/features/sales/actions/daraz-sync-order'
import axios from 'axios'
import { revalidatePath } from 'next/cache'

/**
 * Syncs product listings from all active Daraz stores.
 */
export async function syncAllDarazProductsAction() {
    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim()
    const appSecret = process.env.DARAZ_APP_SECRET?.trim()
    const apiUrl = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest'

    if (!appKey || !appSecret) {
        throw new Error('Daraz API configuration missing')
    }

    const supabase = await createAdminClient()

    // 1. Fetch active stores
    const { data: stores, error: storesError } = await supabase
        .from('online_stores')
        .select('id, seller_account, seller_id')
        .eq('is_active', true)

    if (storesError) {
        throw new Error(`Failed to fetch stores: ${storesError.message}`)
    }

    if (!stores || stores.length === 0) {
        return { success: true, message: 'No active stores found to sync.' }
    }

    // 2. Fetch Sync Cutoff settings
    const { data: settingsData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'daraz_sync_rules')
        .maybeSingle()

    const productCutoffDate = settingsData?.value?.product_cutoff_date
        ? new Date(settingsData.value.product_cutoff_date)
        : null

    let totalSynced = 0
    let totalSkipped = 0
    let totalDuplicates = 0

    // Fetch existing SKUs to prevent duplicates in memory
    const { data: existingProducts, error: existingError } = await supabase
        .from('products')
        .select('seller_sku1, seller_sku2, seller_sku3, seller_sku4')
        .eq('is_deleted', false)

    if (existingError) {
        throw new Error(`Failed to fetch existing products: ${existingError.message}`)
    }

    const existingSkusSet = new Set<string>()
    existingProducts?.forEach(p => {
        if (p.seller_sku1) existingSkusSet.add(p.seller_sku1.toLowerCase().trim())
        if (p.seller_sku2) existingSkusSet.add(p.seller_sku2.toLowerCase().trim())
        if (p.seller_sku3) existingSkusSet.add(p.seller_sku3.toLowerCase().trim())
        if (p.seller_sku4) existingSkusSet.add(p.seller_sku4.toLowerCase().trim())
    })

    // Fetch Category Mappings from daraz_website_category_mappings
    const mappingMap = new Map<string, string>()
    try {
        const { data: mappingsData } = await supabase
            .from('daraz_website_category_mappings')
            .select('daraz_category, website_category')
        if (mappingsData) {
            for (const m of mappingsData) {
                if (m.daraz_category && m.website_category) {
                    mappingMap.set(m.daraz_category.toLowerCase().trim(), m.website_category)
                }
            }
        }
    } catch (mapErr: any) {
        console.error(`[ProductSync] Failed to fetch category mappings:`, mapErr.message)
    }

    // 3. Loop through each store and pull products
    for (const store of stores) {
        // Get Token for this store
        const { data: tokenData } = await supabase
            .from('daraz_api_tokens')
            .select('*')
            .eq('store_id', store.id)
            .eq('app_type', 'order') // Matches existing app_type pattern
            .maybeSingle()

        if (!tokenData || !tokenData.access_token) {
            console.log(`[ProductSync] No token found for store: ${store.seller_account}. Skipping.`)
            continue
        }

        try {
            // Fetch category tree to resolve category names
            const categoryMap = new Map<string, string>()
            try {
                const catTimestamp = Date.now().toString()
                const catParams: Record<string, any> = {
                    app_key: appKey,
                    access_token: tokenData.access_token,
                    timestamp: catTimestamp,
                    sign_method: 'sha256'
                }
                catParams.sign = signRequest('/category/tree/get', catParams, appSecret)
                const catResponse = await axios.get(`${apiUrl}/category/tree/get`, { params: catParams })
                if (catResponse.data?.code === "0" || catResponse.data?.code === 0) {
                    const categoriesList = catResponse.data?.data || []
                    
                    const buildCategoryMap = (list: any[]) => {
                        for (const cat of list) {
                            const id = String(cat.category_id)
                            if (cat.name) {
                                categoryMap.set(id, cat.name)
                            }
                            if (cat.children && cat.children.length > 0) {
                                buildCategoryMap(cat.children)
                            }
                        }
                    }
                    buildCategoryMap(categoriesList)
                } else {
                    console.warn(`[ProductSync] Failed to fetch category tree for ${store.seller_account}:`, catResponse.data?.message || catResponse.data?.msg)
                }
            } catch (catErr: any) {
                console.error(`[ProductSync] Failed to fetch category tree request:`, catErr.message)
            }

            // Call Daraz /products/get API. Pulling first 100 products (2 pages of 50)
            const limit = 50
            for (let pageIndex = 0; pageIndex < 2; pageIndex++) {
                const offset = pageIndex * limit
                const timestamp = Date.now().toString()

                const params: Record<string, any> = {
                    app_key: appKey,
                    access_token: tokenData.access_token,
                    timestamp: timestamp,
                    sign_method: 'sha256',
                    filter: 'live',
                    limit: limit,
                    offset: offset
                }

                params.sign = signRequest('/products/get', params, appSecret)

                const response = await axios.get(`${apiUrl}/products/get`, { params })

                if (response.data.code !== "0" && response.data.code !== 0) {
                    console.error(`[ProductSync] Daraz API Error for ${store.seller_account}:`, response.data.message || response.data.msg)
                    break
                }

                const productsList = response.data?.data?.products || []
                if (productsList.length === 0) break

                for (const item of productsList) {
                    const createdTimestamp = item.created_time ? parseInt(item.created_time) : null
                    const createdDate = createdTimestamp ? new Date(createdTimestamp) : null

                    // Apply Cutoff check
                    if (productCutoffDate && createdDate && createdDate < productCutoffDate) {
                        totalSkipped++
                        continue
                    }

                    const productName = item.attributes?.name || 'Daraz Product'
                    const mainImage = item.images?.[0] || null
                    const description = item.attributes?.description || null
                    const highlights = item.attributes?.short_description || null
                    
                    const categoryIdStr = item.primary_category ? String(item.primary_category) : null
                    const categoryName = categoryIdStr ? (categoryMap.get(categoryIdStr) || categoryIdStr) : null
                    
                    const matchedWebsiteCategory = categoryName 
                        ? (mappingMap.get(categoryName.toLowerCase().trim()) || null) 
                        : null

                    const skus = item.skus || []
                    for (const sku of skus) {
                        const sellerSku = (sku.SellerSku || '').trim()
                        if (!sellerSku) continue

                        // Check for duplicate SKU
                        if (existingSkusSet.has(sellerSku.toLowerCase())) {
                            totalDuplicates++
                            continue
                        }

                        // Insert new product
                        const skuImage = sku.Images?.[0] || mainImage || null
                        const darazProductUrl = sku.Url || null
                        
                        // Parse other images: exclude main image
                        const skuImages = (sku.Images && sku.Images.length > 0) ? sku.Images : (item.images || [])
                        const otherImages = skuImages.slice(1)

                        // Parse prices
                        const regularPrice = sku.price ? parseFloat(sku.price) : null
                        const specialPrice = sku.special_price ? parseFloat(sku.special_price) : null

                        const { error: insertError } = await supabase
                            .from('products')
                            .insert({
                                product_name: productName,
                                product_title: productName,
                                image_url: skuImage,
                                other_images: otherImages,
                                product_type: 'single',
                                status: 'Active',
                                seller_sku1: sellerSku,
                                seller_account1: store.seller_account,
                                approval_status: 'Pending',
                                marketplace_sync_status: 'Pending',
                                website_sync_status: 'Pending',
                                import_flag: true,
                                daraz_product_url: darazProductUrl,
                                description: description,
                                highlights: highlights,
                                regular_price: regularPrice,
                                special_price: specialPrice,
                                category_name: categoryName,
                                website_category: matchedWebsiteCategory
                            })

                        if (insertError) {
                            console.error(`[ProductSync] Failed to insert product SKU ${sellerSku}:`, insertError.message)
                        } else {
                            // Add to memory set to avoid duplicate insertion in the same batch
                            existingSkusSet.add(sellerSku.toLowerCase())
                            totalSynced++
                        }
                    }
                }

                // If less than limit returned, no more products
                if (productsList.length < limit) break
            }
        } catch (err: any) {
            console.error(`[ProductSync] Request failed for store ${store.seller_account}:`, err.message)
        }
    }

    revalidatePath('/dashboard/inventory/product-list')

    return {
        success: true,
        totalSynced,
        totalSkipped,
        totalDuplicates,
        message: `Synced ${totalSynced} new products, skipped ${totalSkipped} (before cutoff), ignored ${totalDuplicates} duplicates.`
    }
}
