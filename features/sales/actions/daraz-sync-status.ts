'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Sync order statuses for manually added or CSV imported orders
export async function syncOrderStatusesFromDarazData() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    try {
        console.log('[OrderSync] Starting status sync...')

        // Get manual/CSV orders that have been matched to Daraz (have order_id)
        const { data: orders, error } = await supabase
            .from('daraz_orders')
            .select('id, order_number, order_id, order_status, import_source, statuses')
            .in('import_source', ['manual', 'csv'])
            .not('order_id', 'is', null)
            .or('deleted.is.null,deleted.eq.false')

        if (error) throw error

        console.log(`[OrderSync] Found ${orders?.length || 0} manual/CSV orders`)

        if (!orders || orders.length === 0) {
            return {
                success: true,
                updated: 0,
                message: 'No manual/CSV orders found (sync from Order Sync page first)'
            }
        }

        let updatedCount = 0

        for (const order of orders) {
            const rawStatus = order.statuses?.[0]?.toLowerCase() || ''
            let newStatus = order.order_status

            // Map Daraz status to Sales status
            if (rawStatus === 'pending') newStatus = 'Pending'
            else if (rawStatus === 'packed') newStatus = 'Packed'
            else if (rawStatus === 'ready_to_ship') newStatus = 'Ready to Ship'
            else if (rawStatus === 'shipped') newStatus = 'Shipped'
            else if (rawStatus === 'delivered' || rawStatus === 'completed') newStatus = 'Delivered'
            else if (rawStatus === 'canceled' || rawStatus === 'cancelled') newStatus = 'Cancel'
            else if (rawStatus === 'failed') newStatus = 'Failed Delivered'
            else if (rawStatus === 'returned') newStatus = 'Customer Return'

            if (newStatus && newStatus !== order.order_status) {
                console.log(`[OrderSync] ${order.order_number}: ${order.order_status} → ${newStatus}`)

                const { error: updateError } = await supabase
                    .from('daraz_orders')
                    .update({
                        order_status: newStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', order.id)

                if (!updateError) updatedCount++
            }
        }

        console.log(`[OrderSync] Updated ${updatedCount} orders`)

        revalidatePath('/dashboard/sales/daraz/sales-entry')
        revalidatePath('/dashboard/sales/daraz/order-list')

        return {
            success: true,
            updated: updatedCount,
            total: orders.length,
            message: updatedCount > 0
                ? `Updated ${updatedCount} order${updatedCount > 1 ? 's' : ''}`
                : `All ${orders.length} orders already up to date`
        }
    } catch (error: any) {
        console.error('[OrderSync] Error:', error)
        return {
            success: false,
            updated: 0,
            message: 'Failed to sync order statuses'
        }
    }
}
