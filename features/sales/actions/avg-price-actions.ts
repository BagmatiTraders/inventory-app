'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getGoogleSheetsClient } from '@/lib/google-sheets'

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
        .select('id, seller_sku1, seller_sku2, seller_sku3, seller_sku4')

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
        const actualCommission = latestCommissionMap.has(p.product_id) ? latestCommissionMap.get(p.product_id)! : null
        const isDefaultCommission = actualCommission === null
        const commissionPercent = isDefaultCommission ? 0.20 : actualCommission // 20% default

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
            updated_at: editableStats?.updated_at || null
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
                item.commission_percent !== null ? item.commission_percent.toFixed(2) + '%' : 'N/A',
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
        }).catch(() => {})

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
