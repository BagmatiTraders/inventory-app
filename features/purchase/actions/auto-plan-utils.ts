/**
 * Auto Purchase Planning Utilities
 *
 * IMPORTANT: This file has NO 'use server' directive intentionally.
 * It is designed to be called from API routes, webhook handlers, and other
 * server-side Node.js contexts directly — NOT as a Next.js Server Action.
 *
 * Server Actions (plan-actions.ts) call these helpers for their auto-plan logic.
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface ProductPurchaseStatsInternal {
    latestPrice: number
    latestSupplier: string
    lowPrice: number
    lowSupplier: string
}

/**
 * Get active order demand for a product.
 * Only counts orders with status: Pending, Packed, Ready to Ship.
 * Counts both direct orders and indirect demand via parent combo products.
 */
export async function getActiveDemandForProduct(productId: string, supabase: any): Promise<number> {
    let totalDemand = 0

    // Step 1: Fetch all direct order items for this product (across all orders)
    const { data: directItems, error: directErr } = await supabase
        .from('daraz_order_items')
        .select('quantity, order_id')
        .eq('product_id', productId)

    if (directErr) {
        console.error('[AutoPlan] Error fetching order items for demand calc:', directErr)
        return 0
    }

    // Step 2 & 3: Sum quantities only for active orders
    if (directItems && directItems.length > 0) {
        const orderIds = directItems.map((i: any) => i.order_id).filter(Boolean)
        if (orderIds.length > 0) {
            const { data: activeOrders, error: orderErr } = await supabase
                .from('daraz_orders')
                .select('id, order_status')
                .in('id', orderIds)
                .in('order_status', ['Pending', 'Packed', 'Ready to Ship'])

            if (orderErr) {
                console.error('[AutoPlan] Error fetching active order statuses:', orderErr)
            } else {
                const activeOrderIds = new Set((activeOrders || []).map((o: any) => o.id))
                totalDemand += directItems
                    .filter((i: any) => activeOrderIds.has(i.order_id))
                    .reduce((sum: number, i: any) => sum + (i.quantity || 0), 0)
            }
        }
    }

    // Step 4: Add indirect demand via parent combos (if this product is a component)
    const { data: parentCombos, error: comboErr } = await supabase
        .from('product_combos')
        .select('parent_product_id, quantity')
        .eq('child_product_id', productId)

    if (comboErr) {
        console.error('[AutoPlan] Error fetching parent combos:', comboErr)
    }

    if (parentCombos && parentCombos.length > 0) {
        const parentIds = parentCombos.map((c: any) => c.parent_product_id)

        const { data: parentItems, error: parentErr } = await supabase
            .from('daraz_order_items')
            .select('product_id, quantity, order_id')
            .in('product_id', parentIds)

        if (parentErr) {
            console.error('[AutoPlan] Error fetching parent order items:', parentErr)
        }

        if (parentItems && parentItems.length > 0) {
            const parentOrderIds = parentItems.map((i: any) => i.order_id).filter(Boolean)
            const { data: activeParentOrders, error: activeParentErr } = await supabase
                .from('daraz_orders')
                .select('id')
                .in('id', parentOrderIds)
                .in('order_status', ['Pending', 'Packed', 'Ready to Ship'])

            if (activeParentErr) {
                console.error('[AutoPlan] Error fetching active parent order statuses:', activeParentErr)
            }

            if (activeParentOrders && activeParentOrders.length > 0) {
                const activeParentOrderIds = new Set((activeParentOrders || []).map((o: any) => o.id))

                parentItems
                    .filter((item: any) => activeParentOrderIds.has(item.order_id))
                    .forEach((item: any) => {
                        const combo = parentCombos.find((c: any) => c.parent_product_id === item.product_id)
                        if (combo) {
                            totalDemand += (item.quantity || 0) * (combo.quantity || 0)
                        }
                    })
            }
        }
    }

    return totalDemand
}

/**
 * Get current stock from stock_ledger_view (uses product `id` column)
 */
export async function getProductStock(productId: string, supabase: any): Promise<number> {
    const { data, error } = await supabase
        .from('stock_ledger_view')
        .select('total_stock')
        .eq('id', productId)
        .maybeSingle()

    if (error) {
        console.error('[AutoPlan] Error fetching stock:', error)
        return 0
    }
    return Number(data?.total_stock) || 0
}

/**
 * Fetch latest/lowest purchase price snapshots for a product (no auth check)
 */
export async function getProductPurchaseStatsInternal(productId: string, supabase: any): Promise<ProductPurchaseStatsInternal> {
    const { data: latest } = await supabase
        .from('purchases')
        .select('unit_amount, supplier:suppliers(supplier_name)')
        .eq('product_id', productId)
        .order('purchase_date', { ascending: false })
        .limit(1)
        .maybeSingle()

    const { data: lowest } = await supabase
        .from('purchases')
        .select('unit_amount, supplier:suppliers(supplier_name)')
        .eq('product_id', productId)
        .order('unit_amount', { ascending: true })
        .limit(1)
        .maybeSingle()

    return {
        latestPrice: latest?.unit_amount || 0,
        latestSupplier: (Array.isArray(latest?.supplier)
            ? latest?.supplier[0]?.supplier_name
            : (latest?.supplier as any)?.supplier_name) || '',
        lowPrice: lowest?.unit_amount || 0,
        lowSupplier: (Array.isArray(lowest?.supplier)
            ? lowest?.supplier[0]?.supplier_name
            : (lowest?.supplier as any)?.supplier_name) || '',
    }
}

/**
 * Handle auto-plan logic for a single (non-combo) product.
 * Creates/updates a 'Pending' plan if stock deficit exists, or deletes auto-plan if resolved.
 */
async function processSingleProductAutoPlan(productId: string, supabase: any) {
    const { data: product } = await supabase
        .from('products')
        .select('id, product_name')
        .eq('id', productId)
        .maybeSingle()

    if (!product) {
        console.log(`[AutoPlan] Product ${productId} not found in products table — skipping.`)
        return
    }

    const demand = await getActiveDemandForProduct(productId, supabase)
    const stock = await getProductStock(productId, supabase)
    const needed = demand - stock

    console.log(`[AutoPlan]   → "${product.product_name}": demand=${demand}, stock=${stock}, needed=${needed}`)

    const { data: existingPlans, error: plansErr } = await supabase
        .from('purchase_plans')
        .select('id, status, quantity, remarks')
        .eq('product_id', productId)
        .in('status', ['Pending', 'Pending Confirmation'])
        .order('created_at', { ascending: true })

    if (plansErr) {
        console.error('[AutoPlan] Error fetching existing plans:', plansErr.message)
    }

    const existingPlan = existingPlans && existingPlans.length > 0 ? existingPlans[0] : null

    // Self-healing: if there are duplicates, delete the extra ones
    if (existingPlans && existingPlans.length > 1) {
        console.warn(`[AutoPlan] ⚠️ Found ${existingPlans.length} duplicate plans for product ${productId}. Cleaning up...`)
        const extraPlanIds = existingPlans.slice(1).map((p: any) => p.id)
        const { error: delErr } = await supabase
            .from('purchase_plans')
            .delete()
            .in('id', extraPlanIds)
        if (delErr) console.error('[AutoPlan] Error deleting duplicate plans:', delErr.message)
    }

    if (needed > 0) {
        if (existingPlan) {
            console.log(`[AutoPlan]   → Updating existing plan (id: ${existingPlan.id}) qty to ${needed}`)
            const { error } = await supabase
                .from('purchase_plans')
                .update({ quantity: needed, updated_at: new Date().toISOString() })
                .eq('id', existingPlan.id)
            if (error) console.error('[AutoPlan]   → Update error:', error.message)
        } else {
            console.log(`[AutoPlan]   → Creating new Pending plan with qty=${needed}`)
            const stats = await getProductPurchaseStatsInternal(productId, supabase)
            const { error } = await supabase
                .from('purchase_plans')
                .insert({
                    plan_date: new Date().toLocaleDateString('en-CA'),
                    product_id: productId,
                    quantity: needed,
                    status: 'Pending',
                    remarks: 'Auto-planned from order demand',
                    snapshot_latest_price: stats.latestPrice,
                    snapshot_latest_supplier: stats.latestSupplier,
                    snapshot_low_price: stats.lowPrice,
                    snapshot_low_supplier: stats.lowSupplier,
                })
            if (error) console.error('[AutoPlan]   → Insert error:', error.message)
        }
    } else {
        // Stock is sufficient — clean up any previous auto-plan for this product
        if (existingPlan && existingPlan.remarks?.startsWith('Auto-planned')) {
            console.log(`[AutoPlan]   → Stock sufficient. Removing auto-plan for "${product.product_name}"`)
            await supabase.from('purchase_plans').delete().eq('id', existingPlan.id)
        } else {
            console.log(`[AutoPlan]   → Stock sufficient. No auto-plan to remove.`)
        }
    }
}

/**
 * Main entry point: given an internal daraz_orders.id (UUID), compute
 * and update purchase plans for all products in that order.
 *
 * Called directly from daraz-sync-order.ts (NOT as a Server Action).
 */
export async function autoPlanPurchaseForOrder(orderId: string): Promise<void> {
    const supabase = await createAdminClient()

    console.log(`[AutoPlan] ====== Running for order UUID: ${orderId} ======`)

    // 1. Fetch order items (product_ids) for this order
    const { data: orderItems, error: itemsError } = await supabase
        .from('daraz_order_items')
        .select('product_id, product_name, quantity')
        .eq('order_id', orderId)

    if (itemsError) {
        console.error(`[AutoPlan] Error fetching order items:`, itemsError.message)
        return
    }

    if (!orderItems || orderItems.length === 0) {
        console.log(`[AutoPlan] No items in order ${orderId} — skipping.`)
        return
    }

    console.log(`[AutoPlan] Order has ${orderItems.length} item(s):`, orderItems.map((i: any) => `${i.product_name} (product_id: ${i.product_id})`))

    // 2. Get unique, non-null product IDs
    const productIds = [...new Set(
        orderItems.map((i: any) => i.product_id).filter(Boolean)
    )] as string[]

    if (productIds.length === 0) {
        console.warn(`[AutoPlan] ⚠️  All items in order ${orderId} have NULL product_id — SKU matching failed! Check product SKUs.`)
        return
    }

    // 3. Process each product
    for (const productId of productIds) {
        // Fetch product type and combo structure
        const { data: product, error: prodErr } = await supabase
            .from('products')
            .select(`
                id,
                product_name,
                product_type,
                product_combos:product_combos!product_combos_parent_product_id_fkey(
                    child_product_id,
                    quantity
                )
            `)
            .eq('id', productId)
            .maybeSingle()

        if (prodErr || !product) {
            console.error(`[AutoPlan] Product ${productId} not found — skipping.`, prodErr?.message)
            continue
        }

        const isCombo = product.product_type === 'combo'
        const componentsCount = (product.product_combos || []).length
        const isVariation = isCombo && componentsCount === 1

        console.log(`[AutoPlan] Processing: "${product.product_name}" | type=${product.product_type} | components=${componentsCount} | isVariation=${isVariation}`)

        if (isVariation) {
            const comp = product.product_combos[0]
            const childProductId = comp.child_product_id

            // Variation: bypass stock check, create Pending Confirmation plan based on child product's total demand
            // Note: Since we bypass stock, the quantity needed is exactly the active demand for the child product.
            const demand = await getActiveDemandForProduct(childProductId, supabase)

            const { data: existingPlans, error: plansErr } = await supabase
                .from('purchase_plans')
                .select('id, status, quantity, remarks')
                .eq('product_id', childProductId)
                .in('status', ['Pending', 'Pending Confirmation'])
                .order('created_at', { ascending: true })

            if (plansErr) {
                console.error('[AutoPlan] Error fetching existing plans for variation:', plansErr.message)
            }

            const existingPlan = existingPlans && existingPlans.length > 0 ? existingPlans[0] : null

            // Self-healing: if there are duplicates, delete the extra ones
            if (existingPlans && existingPlans.length > 1) {
                console.warn(`[AutoPlan] ⚠️ Found ${existingPlans.length} duplicate plans for child product ${childProductId}. Cleaning up...`)
                const extraPlanIds = existingPlans.slice(1).map((p: any) => p.id)
                const { error: delErr } = await supabase
                    .from('purchase_plans')
                    .delete()
                    .in('id', extraPlanIds)
                if (delErr) console.error('[AutoPlan] Error deleting duplicate plans:', delErr.message)
            }

            if (demand > 0) {
                let newRemarks = product.product_name
                if (existingPlan) {
                    const existingRemarks = existingPlan.remarks || ''
                    if (existingRemarks && !existingRemarks.startsWith('Auto-planned variation')) {
                        const names = existingRemarks.split(',').map((n: string) => n.trim()).filter(Boolean)
                        if (!names.includes(product.product_name)) {
                            names.push(product.product_name)
                        }
                        newRemarks = names.join(', ')
                    }
                }

                if (existingPlan) {
                    console.log(`[AutoPlan]   → Variation: Updating existing plan (id: ${existingPlan.id}) for child product ${childProductId} qty to ${demand}, remarks to: "${newRemarks}"`)
                    const { error } = await supabase
                        .from('purchase_plans')
                        .update({ 
                            quantity: demand, 
                            remarks: newRemarks,
                            updated_at: new Date().toISOString() 
                        })
                        .eq('id', existingPlan.id)
                    if (error) console.error('[AutoPlan]   → Update error:', error.message)
                } else {
                    console.log(`[AutoPlan]   → Variation: Creating Pending Confirmation plan for child product ${childProductId} qty=${demand}, remarks: "${newRemarks}"`)
                    const stats = await getProductPurchaseStatsInternal(childProductId, supabase)
                    const { error: insErr } = await supabase
                        .from('purchase_plans')
                        .insert({
                            plan_date: new Date().toLocaleDateString('en-CA'),
                            product_id: childProductId,
                            quantity: demand,
                            status: 'Pending Confirmation',
                            remarks: newRemarks,
                            snapshot_latest_price: stats.latestPrice,
                            snapshot_latest_supplier: stats.latestSupplier,
                            snapshot_low_price: stats.lowPrice,
                            snapshot_low_supplier: stats.lowSupplier,
                        })
                    if (insErr) console.error('[AutoPlan]   → Insert error:', insErr.message)
                }
            } else {
                if (existingPlan && (existingPlan.status === 'Pending Confirmation' || existingPlan.remarks?.startsWith('Auto-planned'))) {
                    console.log(`[AutoPlan]   → Variation: demand=0, removing auto-plan for child product ${childProductId}`)
                    await supabase.from('purchase_plans').delete().eq('id', existingPlan.id)
                }
            }

        } else if (isCombo) {
            // Multi-component Combo: check stock for each component individually
            for (const comp of (product.product_combos || [])) {
                console.log(`[AutoPlan]   → Combo component: ${comp.child_product_id}`)
                await processSingleProductAutoPlan(comp.child_product_id, supabase)
            }

        } else {
            // Single product: deficit check
            await processSingleProductAutoPlan(product.id, supabase)
        }
    }

    console.log(`[AutoPlan] ====== Done for order UUID: ${orderId} ======`)
}
