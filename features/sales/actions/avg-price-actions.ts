'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getGoogleSheetsClient } from '@/lib/google-sheets'
import axios from 'axios'
import crypto from 'crypto'

const STORE_NAME_MAP: Record<string, string> = {
    'lamichhaneram100@gmail.com': 'Balaju',
    'shop.bagmati@gmail.com': 'BTAS',
    'Bagmationline8@gmail.com': 'Bagmati',
    'supplierslamichhane9@gmail.com': 'Cosmetics'
}

export interface DarazAvgPriceItem {
    product_id: string
    product_name: string
    image_url: string | null
    seller_skus: string[]
    seller_sku1: string | null
    seller_sku2: string | null
    seller_sku3: string | null
    seller_sku4: string | null
    purchasing_price: number // Priority: Last Price -> Est Price -> Wholesale -> 0
    purchasing_remark: string | null
    commission_percent: number | null // Daraz fee % based on delivered orders
    is_default_commission: boolean
    breakeven_price: number // purchasing_price / (1 - commission_percent)
    regular_sales_price: number // breakeven_price * 1.15
    market_price: number | null
    market_price_profit: number | null // market_price - (market_price * commission) - purchasing_price
    campaign_price: number | null
    campaign_price_profit: number | null
    updated_at: string | null
    live_prices?: Record<string, { price: number, special_price: number | null, store_name: string, quantity: number, store_id: string }>
}

export async function getDarazAvgPrices() {
    const supabase = await createClient()

    // 1. Fetch all products from pricing view
    const { data: productsData, error: productsError } = await supabase
        .from('inventory_price_reports_view')
        .select('*')

    if (productsError) {
        console.error('Error fetching products from inventory_price_reports_view:', productsError)
        throw new Error('Failed to fetch product pricing data: ' + productsError.message)
    }

    // 1b. Fetch SKUs from products table (since view might not have them)
    const { data: skusData, error: skuError } = await supabase
        .from('products')
        .select('id, seller_sku1, seller_account1, seller_sku2, seller_account2, seller_sku3, seller_account3, seller_sku4, seller_account4')

    if (skuError) {
        console.error('Error fetching SKUs from products table:', skuError)
    }

    const skuMap = new Map<string, any>()
    const reverseSkuMap = new Map<string, string>() // Map SKU to Product ID

    if (skusData) {
        skusData.forEach(s => {
            skuMap.set(s.id, s)
            if (s.seller_sku1) reverseSkuMap.set(s.seller_sku1.toLowerCase().trim(), s.id)
            if (s.seller_sku2) reverseSkuMap.set(s.seller_sku2.toLowerCase().trim(), s.id)
            if (s.seller_sku3) reverseSkuMap.set(s.seller_sku3.toLowerCase().trim(), s.id)
            if (s.seller_sku4) reverseSkuMap.set(s.seller_sku4.toLowerCase().trim(), s.id)
        })
    }

    // 1c. Fetch product combos to calculate accurate purchasing cost for combos
    const { data: combosData } = await supabase
        .from('product_combos')
        .select('parent_product_id, child_product_id, quantity')

    const comboComponentsMap: Record<string, Array<{ child_product_id: string, quantity: number }>> = {}
    combosData?.forEach((c: any) => {
        if (!comboComponentsMap[c.parent_product_id]) {
            comboComponentsMap[c.parent_product_id] = []
        }
        comboComponentsMap[c.parent_product_id].push({
            child_product_id: c.child_product_id,
            quantity: c.quantity
        })
    })

    // 1d. Fetch Wholesale Prices for fallback if no history exists
    const { data: wholesalePricesData } = await supabase
        .from('product_wholesale_prices')
        .select('product_id, wholesale_price')

    const bestWholesaleMap = new Map<string, number>()
    wholesalePricesData?.forEach(wp => {
        const currentMin = bestWholesaleMap.get(wp.product_id) || Infinity
        if (wp.wholesale_price < currentMin) {
            bestWholesaleMap.set(wp.product_id, Number(wp.wholesale_price))
        }
    })

    const basePricesMap: Record<string, { price: number, remark: string | null }> = {}
    productsData?.forEach((p: any) => {
        let price = p.last_price || p.est_price || 0
        let remark: string | null = null

        if (price === 0 && bestWholesaleMap.has(p.product_id)) {
            price = bestWholesaleMap.get(p.product_id)!
            remark = '(Est Price)'
        }

        basePricesMap[p.product_id] = { price, remark }
    })

    const calculatedComboPrices: Record<string, { price: number, remark: string | null }> = {}
    Object.keys(comboComponentsMap).forEach(parentId => {
        const components = comboComponentsMap[parentId]
        let hasWholesaleFallback = false
        const parentPrice = components.reduce((sum, comp) => {
            const childData = basePricesMap[comp.child_product_id] || { price: 0, remark: null }
            if (childData.remark === '(Est Price)') hasWholesaleFallback = true
            return sum + (childData.price * comp.quantity)
        }, 0)
        calculatedComboPrices[parentId] = {
            price: parentPrice,
            remark: hasWholesaleFallback ? '(Est Price)' : null
        }
    })

    // 2. Fetch all Daraz product prices (editable fields)
    const { data: dbPrices, error: pricesError } = await supabase
        .from('daraz_avg_prices')
        .select('*')

    const pricesMap = new Map<string, any>()
    if (dbPrices && !pricesError) {
        dbPrices.forEach(p => pricesMap.set(p.product_id, p))
    } else if (pricesError) {
        console.warn('daraz_avg_prices fetch error (table might not exist yet):', pricesError.message)
    }

    // 2b. Fetch Live Daraz Prices from our new cache table
    const allDbLivePrices: any[] = []
    let fetchPage = 0
    let hasMoreLivePrices = true

    while (hasMoreLivePrices) {
        const { data: dbLivePricesChunk, error: livePricesError } = await supabase
            .from('daraz_live_prices')
            .select('*')
            .range(fetchPage * 1000, (fetchPage + 1) * 1000 - 1)

        if (livePricesError) {
            console.error('daraz_live_prices fetch error:', livePricesError.message)
            break
        }
        if (!dbLivePricesChunk || dbLivePricesChunk.length === 0) {
            hasMoreLivePrices = false
            break
        }
        allDbLivePrices.push(...dbLivePricesChunk)
        if (dbLivePricesChunk.length < 1000) {
            hasMoreLivePrices = false
        } else {
            fetchPage++
        }
    }

    const livePricesMap = new Map<string, any[]>()
    if (allDbLivePrices.length > 0) {
        allDbLivePrices.forEach(lp => {
            const sku = lp.seller_sku.toLowerCase().trim()
            if (!livePricesMap.has(sku)) {
                livePricesMap.set(sku, [])
            }
            livePricesMap.get(sku)!.push(lp)
        })
    }

    // 3. Fetch Delivered Daraz Orders with fees to find the LATEST commission per product
    const { data: ordersWithItems, error: ordersError } = await supabase
        .from('daraz_orders')
        .select(`
            daraz_fees,
            created_at,
            order_date,
            items:daraz_order_items(product_id, seller_sku, amount, quantity)
        `)
        .eq('order_status', 'Delivered')
        .not('daraz_fees', 'is', null) // Can be positive or negative
        .order('created_at', { ascending: false }) // Sort by latest first

    if (ordersError) {
        console.error('Error fetching orders for commission:', ordersError)
    }

    // Map product_id to its latest fee %
    const latestCommissionMap = new Map<string, number>()

    if (ordersWithItems) {
        ordersWithItems.forEach((order: any) => {
            const fees = Math.abs(order.daraz_fees || 0)
            if (fees > 0) {
                const totalRevenue = (order.items || []).reduce((sum: number, item: any) => sum + ((item.amount || 0) * (item.quantity || 1)), 0)

                if (totalRevenue > 0) {
                    const feePercent = fees / totalRevenue
                    // Cap it realistically e.g. 0 to 99%
                    if (feePercent >= 0 && feePercent < 1) {
                        const productIds = new Set<string>()
                        order.items?.forEach((item: any) => {
                            let pid = item.product_id
                            if (!pid && item.seller_sku) {
                                pid = reverseSkuMap.get(item.seller_sku.toLowerCase().trim())
                            }
                            if (pid) productIds.add(pid)
                        })

                        productIds.forEach(pid => {
                            // Since orders are sorted latest first, only set it if it's the first time we see this product
                            if (!latestCommissionMap.has(pid)) {
                                latestCommissionMap.set(pid, feePercent)
                            }
                        })
                    }
                }
            }
        })
    }

    // 4. Combine all data
    const result: DarazAvgPriceItem[] = (productsData || []).map((p: any) => {
        const prodSkus = skuMap.get(p.product_id) || {}
        const skus = [prodSkus.seller_sku1, prodSkus.seller_sku2, prodSkus.seller_sku3, prodSkus.seller_sku4].filter(Boolean)

        const comboData = calculatedComboPrices[p.product_id]
        const baseData = basePricesMap[p.product_id] || { price: 0, remark: null }

        const isCombo = !!comboData
        const purchasingPrice = isCombo ? comboData.price : baseData.price
        const purchasingRemark = isCombo ? comboData.remark : baseData.remark

        // Latest Commission Percent
        // Default is 25%; also treat any real commission below 15% as 25% (too low to be realistic)
        const actualCommission = latestCommissionMap.has(p.product_id) ? latestCommissionMap.get(p.product_id)! : null
        const isBelowMinimum = actualCommission !== null && actualCommission < 0.15
        const isDefaultCommission = actualCommission === null || isBelowMinimum
        const commissionPercent = isDefaultCommission ? 0.25 : actualCommission // 25% default

        // Calculations
        let breakevenPrice = 0
        if (commissionPercent !== null && commissionPercent < 1) {
            breakevenPrice = purchasingPrice / (1 - commissionPercent)
        } else {
            breakevenPrice = purchasingPrice // fallback if no commission data
        }

        const rawRegularSalesPrice = breakevenPrice * 1.15
        const regularSalesPrice = Math.ceil(rawRegularSalesPrice / 5) * 5

        const editableStats = pricesMap.get(p.product_id)
        const marketPrice = editableStats?.market_price || null
        const campaignPrice = editableStats?.campaign_price || null

        const marketPriceProfit = marketPrice ? (marketPrice - (marketPrice * commissionPercent) - purchasingPrice) : null
        const campaignPriceProfit = campaignPrice ? (campaignPrice - (campaignPrice * commissionPercent) - purchasingPrice) : null

        // Live Prices Mapping
        const productLivePrices: Record<string, { price: number, special_price: number | null, store_name: string }> = {}
        skus.forEach(sku => {
            const lowerSku = sku.toLowerCase().trim()
            const prices = livePricesMap.get(lowerSku)
            if (prices && prices.length > 0) {
                // If by rare chance multiple stores report the same SKU name, take the first matched price recorded
                const sp = prices[0]
                productLivePrices[sku] = {
                    price: Number(sp.price),
                    special_price: sp.special_price ? Number(sp.special_price) : null,
                    store_name: sp.store_name,
                    quantity: Number(sp.quantity || 0),
                    store_id: sp.store_id
                }
            }
        })

        return {
            product_id: p.product_id,
            product_name: p.product_name,
            image_url: p.image_url,
            seller_skus: skus,
            seller_sku1: prodSkus.seller_sku1 || null,
            seller_sku2: prodSkus.seller_sku2 || null,
            seller_sku3: prodSkus.seller_sku3 || null,
            seller_sku4: prodSkus.seller_sku4 || null,
            purchasing_price: purchasingPrice,
            purchasing_remark: purchasingRemark,
            commission_percent: commissionPercent !== null ? commissionPercent * 100 : null, // Convert to percentage 15%
            is_default_commission: isDefaultCommission,
            breakeven_price: breakevenPrice,
            regular_sales_price: regularSalesPrice,
            market_price: marketPrice,
            market_price_profit: marketPriceProfit,
            campaign_price: campaignPrice,
            campaign_price_profit: campaignPriceProfit,
            updated_at: editableStats?.updated_at || null,
            live_prices: productLivePrices
        }
    })

    return result
}

export async function updateDarazAvgPrice(productId: string, data: { market_price?: number | null, campaign_price?: number | null }) {
    const supabase = await createClient()

    // Assuming daraz_avg_prices exists. If not, this triggers an error you'll know to run the SQL migration.
    // Try to update first, if it fails, maybe insert
    const { data: existing, error: fetchErr } = await supabase
        .from('daraz_avg_prices')
        .select('product_id')
        .eq('product_id', productId)
        .maybeSingle()

    if (fetchErr) {
        throw new Error('Database error. Did you run the SQL migration?')
    }

    if (existing) {
        const { error } = await supabase
            .from('daraz_avg_prices')
            .update(data)
            .eq('product_id', productId)
        if (error) throw new Error(error.message)
    } else {
        const { error } = await supabase
            .from('daraz_avg_prices')
            .insert([{ product_id: productId, ...data }])
        if (error) throw new Error(error.message)
    }

    revalidatePath('/dashboard/sales/daraz/average-sales-price')
    return { success: true }
}

const SHEET_ID = '1ztKJH0rrE1Od2lXJA2f8AoQ_FQ3fmnpqQietx2ZulZE'
const RANGE = 'Daraz Avg Price!A:N'

export async function syncDarazAvgPricesGoogleSheets() {
    try {
        const sheets = await getGoogleSheetsClient()
        const appData = await getDarazAvgPrices()

        // 1. Read Google Sheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: RANGE,
        }).catch((err: any) => {
            console.error('Failed to read Sheet. Does it exist?', err.message)
            return null
        })

        const rows = response?.data?.values || []
        const headerRow = rows[0] || []
        const sheetDataMap = new Map<string, any>()

        // 2. Parse Sheet Data (we assume S.N, Product Name, SKUs, Purchasing, Commission, Breakeven, Regular, Market, Market Profit, Campaign)
        // Let's enforce reading by Product ID to safely sync back. We must place Product ID in a hidden or explicit column.
        // We will store Product ID in Column K or just Column A implicitly if we rewrite entirely.
        // Since the user wants two-way sync, let's write Product ID to the last column.

        // Actually, simplest way for Two-Way sync on entirely derived data where only Market and Campaign are editable:
        // - App -> Sheet: Overwrite entirely but keep Market/Campaign.
        // - Sheet -> App: Read Market/Campaign from Sheet matched by Product ID and update DB, THEN overwrite Sheet again with latest everything.
        // If Sheet has a different Market Price, we read it before overwriting.

        if (rows.length > 1) {
            // Find columns
            const idColIdx = headerRow.findIndex((h: string) => h === 'Product ID (DO NOT EDIT)')
            const marketColIdx = headerRow.findIndex((h: string) => h === 'Market Price')
            const campaignColIdx = headerRow.findIndex((h: string) => h === 'Campaign Price')

            if (idColIdx !== -1 && marketColIdx !== -1 && campaignColIdx !== -1) {
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i]
                    const productId = row[idColIdx]
                    const marketStr = row[marketColIdx]
                    const campaignStr = row[campaignColIdx]

                    if (productId) {
                        const marketVal = marketStr ? parseFloat(marketStr.replace(/[^0-9.]/g, '')) : null
                        const campaignVal = campaignStr ? parseFloat(campaignStr.replace(/[^0-9.]/g, '')) : null

                        sheetDataMap.set(productId, {
                            market_price: isNaN(marketVal as any) ? null : marketVal,
                            campaign_price: isNaN(campaignVal as any) ? null : campaignVal
                        })
                    }
                }
            }
        }

        // 3. Update DB with Sheet Data (Sheet -> App)
        const SYNC_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes priority for Webapp
        const now = Date.now()

        for (const item of appData) {
            const sheetItem = sheetDataMap.get(item.product_id)
            if (sheetItem) {
                // Heuristic: If we recently updated in the Webapp (within 5 mins), ignore the Sheet for now.
                // This ensures Webapp has priority for fresh changes.
                const lastUpdated = item.updated_at ? new Date(item.updated_at).getTime() : 0
                const isRecentlyUpdatedInApp = (now - lastUpdated) < SYNC_COOLDOWN_MS

                if (isRecentlyUpdatedInApp) {
                    // console.log(`[SYNC] Priority: Webapp (recently changed) for ${item.product_name}`)
                    continue
                }

                const updatedFields: any = {}
                if (sheetItem.market_price !== null && sheetItem.market_price !== item.market_price) {
                    updatedFields.market_price = sheetItem.market_price
                    item.market_price = sheetItem.market_price
                }
                if (sheetItem.campaign_price !== null && sheetItem.campaign_price !== item.campaign_price) {
                    updatedFields.campaign_price = sheetItem.campaign_price
                    item.campaign_price = sheetItem.campaign_price
                }

                if (Object.keys(updatedFields).length > 0) {
                    await updateDarazAvgPrice(item.product_id, updatedFields)
                }
            }
        }

        // 4. Overwrite Sheet with latest combined data (App -> Sheet)
        const headers = [
            'S.N', 'Product Name', 'Seller SKU 1', 'Seller SKU 2', 'Seller SKU 3', 'Seller SKU 4',
            'Purchasing Price', 'Commission (%)', 'Breakeven Price', 'Regular Sales Price',
            'Market Price', 'Market Price Profit', 'Campaign Price', 'Product ID (DO NOT EDIT)'
        ]

        const writeValues = [headers]
        appData.forEach((item, index) => {
            writeValues.push([
                String(index + 1),
                item.product_name || '',
                item.seller_sku1 || '',
                item.seller_sku2 || '',
                item.seller_sku3 || '',
                item.seller_sku4 || '',
                item.purchasing_price.toFixed(2),
                (item.commission_percent !== null ? item.commission_percent : 25).toFixed(2) + '%',
                item.breakeven_price.toFixed(2),
                item.regular_sales_price.toFixed(2),
                item.market_price !== null ? String(item.market_price) : '',
                item.market_price !== null ? (item.market_price - item.breakeven_price).toFixed(2) : '',
                item.campaign_price !== null ? String(item.campaign_price) : '',
                item.product_id
            ])
        })

        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: 'Daraz Avg Price!A1:N' + writeValues.length,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: writeValues
            }
        })

        // Clear any leftover rows below
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SHEET_ID,
            range: `Daraz Avg Price!A${writeValues.length + 1}:N1000` // Clear up to row 1000
        }).catch(() => { })

        revalidatePath('/dashboard/sales/daraz/average-sales-price')

        return { success: true, message: 'Synced successfully with Google Sheets' }

    } catch (error: any) {
        console.error('Sync Error:', error)
        return { success: false, message: error.message || 'Unknown error occurred during sync' }
    }
}

export async function pullDarazAvgPricesFromGoogleSheets() {
    try {
        const sheets = await getGoogleSheetsClient()
        const appData = await getDarazAvgPrices()

        // 1. Read Google Sheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: RANGE,
        })

        const rows = response?.data?.values || []
        const headerRow = rows[0] || []
        const sheetDataMap = new Map<string, any>()

        if (rows.length > 1) {
            const idColIdx = headerRow.findIndex((h: string) => h === 'Product ID (DO NOT EDIT)')
            const marketColIdx = headerRow.findIndex((h: string) => h === 'Market Price')
            const campaignColIdx = headerRow.findIndex((h: string) => h === 'Campaign Price')

            if (idColIdx !== -1 && marketColIdx !== -1 && campaignColIdx !== -1) {
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i]
                    const productId = row[idColIdx]
                    const marketStr = row[marketColIdx]
                    const campaignStr = row[campaignColIdx]

                    if (productId) {
                        const marketVal = marketStr ? parseFloat(marketStr.replace(/[^0-9.]/g, '')) : null
                        const campaignVal = campaignStr ? parseFloat(campaignStr.replace(/[^0-9.]/g, '')) : null

                        sheetDataMap.set(productId, {
                            market_price: isNaN(marketVal as any) ? null : marketVal,
                            campaign_price: isNaN(campaignVal as any) ? null : campaignVal
                        })
                    }
                }
            }
        }

        // 2. Update DB with Sheet Data (FORCE Pull)
        for (const item of appData) {
            const sheetItem = sheetDataMap.get(item.product_id)
            if (sheetItem) {
                const updatedFields: any = {}
                if (sheetItem.market_price !== null && sheetItem.market_price !== item.market_price) {
                    updatedFields.market_price = sheetItem.market_price
                }
                if (sheetItem.campaign_price !== null && sheetItem.campaign_price !== item.campaign_price) {
                    updatedFields.campaign_price = sheetItem.campaign_price
                }

                if (Object.keys(updatedFields).length > 0) {
                    await updateDarazAvgPrice(item.product_id, updatedFields)
                }
            }
        }

        revalidatePath('/dashboard/sales/daraz/average-sales-price')
        return { success: true, message: 'Data pulled successfully from Google Sheets' }

    } catch (error: any) {
        console.error('Pull Sync Error:', error)
        return { success: false, message: error.message || 'Unknown error occurred during pull' }
    }
}

export async function syncLiveSellerPrices() {
    try {
        const supabase = await createClient()
        const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
        const appSecret = process.env.DARAZ_APP_SECRET
        const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

        if (!appKey || !appSecret) {
            throw new Error('Missing Daraz API credentials')
        }

        const { data: tokens, error: tokensErr } = await supabase.from('daraz_api_tokens').select('*')
        if (tokensErr || !tokens || tokens.length === 0) {
            throw new Error('No connected seller stores found')
        }

        const allLivePricesToUpsert: any[] = []

        for (const token of tokens) {
            const storeName = STORE_NAME_MAP[token.account] || (token.account ? token.account.split('@')[0] : 'Unknown Store')
            const limit = 50
            let offset = 0
            let hasMore = true

            while (hasMore) {
                const params: Record<string, any> = {
                    app_key: appKey,
                    access_token: token.access_token,
                    timestamp: new Date().getTime(),
                    sign_method: 'sha256',
                    filter: 'live',
                    limit: limit,
                    offset: offset
                }

                const apiPath = '/products/get'
                const keys = Object.keys(params).sort()
                let str = apiPath
                keys.forEach(k => { str += k + params[k] })
                params.sign = crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()

                try {
                    const res = await axios.get(`${apiUrl}${apiPath}`, { params })
                    const data = res.data?.data?.products || []

                    for (const prod of data) {
                        const skus = prod.skus || []
                        for (const sku of skus) {
                            if (sku.SellerSku) {
                                allLivePricesToUpsert.push({
                                    store_id: token.store_id,
                                    store_name: storeName,
                                    seller_sku: sku.SellerSku,
                                    sku_id: sku.SkuId ? String(sku.SkuId) : null,
                                    price: parseFloat(sku.price) || 0,
                                    special_price: sku.special_price ? parseFloat(sku.special_price) : null,
                                    quantity: parseInt(sku.quantity) || 0,
                                    updated_at: new Date().toISOString()
                                })
                            }
                        }
                    }

                    if (data.length < limit) {
                        hasMore = false
                    } else {
                        offset += limit
                        await new Promise(r => setTimeout(r, 200)) // rate limit protection
                        if (offset > 15000) hasMore = false // fail safe
                    }
                } catch (err: any) {
                    console.error(`Failed to fetch live prices for ${storeName} at offset ${offset}:`, err.message)
                    hasMore = false // break this store loop on error and continue to next
                }
            }
        }

        if (allLivePricesToUpsert.length > 0) {
            // Upsert in batches of 500
            for (let i = 0; i < allLivePricesToUpsert.length; i += 500) {
                const batch = allLivePricesToUpsert.slice(i, i + 500)
                const { error: upsertErr } = await supabase.from('daraz_live_prices').upsert(batch, { onConflict: 'store_id,seller_sku' })
                if (upsertErr) {
                    console.error('Failed to upsert daraz live prices batch:', upsertErr.message)
                    throw new Error(`Failed to upsert daraz live prices batch: ${upsertErr.message}`)
                }
            }
        }

        revalidatePath('/dashboard/sales/daraz/average-sales-price')
        return { success: true, count: allLivePricesToUpsert.length, message: `Successfully synced ${allLivePricesToUpsert.length} SKUs across stores` }
    } catch (error: any) {
        console.error('syncLiveSellerPrices Error:', error)
        return { success: false, message: error.message || 'Unknown error occurred during live price sync' }
    }
}


/**
 * Push the Daraz Price (market_price) for one product to Daraz as a special price.
 * Special price date range: today -> 4 years from today.
 */
export async function pushPriceToDaraz(productId: string) {
    try {
        const supabase = await createClient()
        const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
        const appSecret = process.env.DARAZ_APP_SECRET
        const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

        if (!appKey || !appSecret) throw new Error('Missing Daraz API credentials')

        const { data: skuRow, error: skuErr } = await supabase
            .from('products')
            .select('seller_sku1, seller_sku2, seller_sku3, seller_sku4')
            .eq('id', productId)
            .single()

        if (skuErr || !skuRow) throw new Error('Product not found')

        const productSkus = [skuRow.seller_sku1, skuRow.seller_sku2, skuRow.seller_sku3, skuRow.seller_sku4].filter(Boolean) as string[]
        if (productSkus.length === 0) throw new Error('Product has no seller SKUs configured')

        const { data: priceRow } = await supabase
            .from('daraz_avg_prices')
            .select('market_price')
            .eq('product_id', productId)
            .single()

        const marketPrice = priceRow?.market_price
        if (!marketPrice || marketPrice <= 0) throw new Error('Daraz Price is 0 or not set - enter a price first')

        const { data: tokens, error: tokensErr } = await supabase.from('daraz_api_tokens').select('*')
        if (tokensErr || !tokens || tokens.length === 0) throw new Error('No connected seller stores found')

        const { data: livePrices } = await supabase
            .from('daraz_live_prices')
            .select('seller_sku, store_id, price, sku_id')
            .in('seller_sku', productSkus)

        const storeSkuMap = new Map<string, Array<{ sku: string, skuId: string | null, currentPrice: number }>>()
        if (livePrices && livePrices.length > 0) {
            for (const lp of livePrices) {
                if (!storeSkuMap.has(lp.store_id)) storeSkuMap.set(lp.store_id, [])
                storeSkuMap.get(lp.store_id)!.push({
                    sku: lp.seller_sku,
                    skuId: lp.sku_id || null,
                    currentPrice: lp.price || 0
                })
            }
        } else {
            for (const token of tokens) {
                storeSkuMap.set(token.store_id, productSkus.map(sku => ({ sku, skuId: null, currentPrice: 0 })))
            }
        }

        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        const fmt = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
        const startDate = fmt(now)
        const endDate = fmt(new Date(now.getFullYear() + 4, now.getMonth(), now.getDate()))

        const results: { store: string; skus: string[]; success: boolean; message: string }[] = []

        for (const token of tokens) {
            const skusForStore = storeSkuMap.get(token.store_id)
            if (!skusForStore || skusForStore.length === 0) continue

            const storeName = STORE_NAME_MAP[token.account] || token.account

            // Daraz now requires SkuId (not SellerSku). Use SkuId if available, else fall back to SellerSku.
            const skuXml = skusForStore.map(({ sku, skuId, currentPrice }) => {
                const regularPrice = currentPrice > marketPrice
                    ? currentPrice
                    : Math.ceil(marketPrice * 1.2)
                // Daraz requires SkuId now; SellerSku is deprecated
                const identifierXml = skuId
                    ? '<SkuId>' + skuId + '</SkuId>'
                    : '<SellerSku><![CDATA[' + sku + ']]></SellerSku>'
                return '<Sku>' +
                    identifierXml +
                    '<Price>' + regularPrice.toFixed(2) + '</Price>' +
                    '<SalePrice>' + marketPrice.toFixed(2) + '</SalePrice>' +
                    '<SaleStartDate>' + startDate + '</SaleStartDate>' +
                    '<SaleEndDate>' + endDate + '</SaleEndDate>' +
                    '</Sku>'
            }).join('')

            const xmlPayload = '<Request><Product><Skus>' + skuXml + '</Skus></Product></Request>'

            const apiPath = '/product/price_quantity/update'
            const callParams: Record<string, any> = {
                app_key: appKey,
                access_token: token.access_token,
                timestamp: String(new Date().getTime()),
                sign_method: 'sha256',
                payload: xmlPayload
            }
            const sortedKeys = Object.keys(callParams).sort()
            let signStr = apiPath
            sortedKeys.forEach(k => { signStr += k + callParams[k] })
            callParams.sign = crypto.createHmac('sha256', appSecret).update(signStr).digest('hex').toUpperCase()

            try {
                const res = await axios.post(apiUrl + apiPath, null, { params: callParams })
                const code = String(res.data?.code)
                if (code === '0') {
                    results.push({ store: storeName, skus: skusForStore.map(s => s.sku), success: true, message: 'Price pushed' })
                } else {
                    const detail = res.data?.detail ? JSON.stringify(res.data.detail) : ''
                    results.push({ store: storeName, skus: skusForStore.map(s => s.sku), success: false, message: `${res.data?.message || 'API error code ' + code} ${detail}` })
                }
            } catch (err: any) {
                results.push({ store: storeName, skus: skusForStore.map(s => s.sku), success: false, message: err?.response?.data?.message || err.message })
            }
        }

        const anySuccess = results.some(r => r.success)
        const summary = results.map(r => r.store + ': ' + r.message).join(' | ')

        return { success: anySuccess, message: summary, results }

    } catch (error: any) {
        console.error('pushPriceToDaraz Error:', error)
        return { success: false, message: error.message || 'Unknown error' }
    }
}


/**
 * Push stock quantity for one or more SKUs to Daraz.
 * updates can be an array of { sku: string, quantity: number, store_id: string }
 */
export async function pushStockToDaraz(
    productId: string | Array<{ sku: string, quantity: number, store_id: string }>, 
    updates?: Array<{ sku: string, quantity: number, store_id: string }>,
    supabaseClient?: any
) {
    try {
        const upds = Array.isArray(productId) ? productId : updates || []
        const supabase = supabaseClient || await createClient()
        const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
        const appSecret = process.env.DARAZ_APP_SECRET
        const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

        if (!appKey || !appSecret) throw new Error('Missing Daraz API credentials')

        const { data: tokens, error: tokensErr } = await supabase.from('daraz_api_tokens').select('*')
        if (tokensErr || !tokens || tokens.length === 0) throw new Error('No connected seller stores found')

        // Get SKU IDs from live prices cache to use for updates
        const { data: livePrices } = await supabase
            .from('daraz_live_prices')
            .select('seller_sku, store_id, sku_id')
            .in('seller_sku', upds.map(u => u.sku))

        const skuIdMap = new Map<string, string>() // key: store_id:seller_sku
        livePrices?.forEach(lp => {
            if (lp.sku_id) skuIdMap.set(`${lp.store_id}:${lp.seller_sku}`, lp.sku_id)
        })

        const storeUpdates = new Map<string, typeof upds>()
        upds.forEach(u => {
            if (!storeUpdates.has(u.store_id)) storeUpdates.set(u.store_id, [])
            storeUpdates.get(u.store_id)!.push(u)
        })

        const results: { store: string; skus: string[]; success: boolean; message: string }[] = []

        for (const token of tokens) {
            const upds = storeUpdates.get(token.store_id)
            if (!upds || upds.length === 0) continue

            const storeName = STORE_NAME_MAP[token.account] || token.account

            const skuXml = upds.map(({ sku, quantity }) => {
                const skuId = skuIdMap.get(`${token.store_id}:${sku}`)
                const identifierXml = skuId
                    ? '<SkuId>' + skuId + '</SkuId>'
                    : '<SellerSku><![CDATA[' + sku + ']]></SellerSku>'
                return '<Sku>' + identifierXml + '<Quantity>' + quantity + '</Quantity></Sku>'
            }).join('')

            const xmlPayload = '<Request><Product><Skus>' + skuXml + '</Skus></Product></Request>'

            const apiPath = '/product/price_quantity/update'
            const callParams: Record<string, any> = {
                app_key: appKey,
                access_token: token.access_token,
                timestamp: String(new Date().getTime()),
                sign_method: 'sha256',
                payload: xmlPayload
            }
            const sortedKeys = Object.keys(callParams).sort()
            let signStr = apiPath
            sortedKeys.forEach(k => { signStr += k + callParams[k] })
            callParams.sign = crypto.createHmac('sha256', appSecret).update(signStr).digest('hex').toUpperCase()

            try {
                const res = await axios.post(apiUrl + apiPath, null, { params: callParams })
                const code = String(res.data?.code)
                if (code === '0') {
                    results.push({ store: storeName, skus: upds.map(s => s.sku), success: true, message: 'Stock updated' })

                    // Optimistically update local cache
                    for (const u of upds) {
                        await supabase
                            .from('daraz_live_prices')
                            .update({ quantity: u.quantity })
                            .eq('store_id', u.store_id)
                            .eq('seller_sku', u.sku)
                    }
                } else {
                    const detail = res.data?.detail ? JSON.stringify(res.data.detail) : ''
                    results.push({ store: storeName, skus: upds.map(s => s.sku), success: false, message: `${res.data?.message || 'API error code ' + code} ${detail}` })
                }
            } catch (err: any) {
                results.push({ store: storeName, skus: upds.map(s => s.sku), success: false, message: err?.response?.data?.message || err.message })
            }
        }

        const anySuccess = results.some(r => r.success)
        revalidatePath('/dashboard/sales/daraz/average-sales-price')

        return {
            success: anySuccess,
            message: results.map(r => r.store + ': ' + r.message).join(' | '),
            results
        }

    } catch (error: any) {
        console.error('pushStockToDaraz Error:', error)
        return { success: false, message: error.message || 'Unknown error' }
    }
}
