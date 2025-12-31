'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface DamagedStock {
    id: string
    date: string
    location: string
    product_id: string
    product_name?: string
    product_custom_id?: string // For displaying Product ID
    quantity: number
    status: 'Damaged' | 'Repair' | 'Exchange'
    remarks?: string
    created_at: string
    updated_at: string
}

// Save Damaged Stock
export async function saveDamagedStock(data: {
    date: string
    location: string
    product_id: string
    quantity: number
    status: 'Damaged' | 'Repair' | 'Exchange'
    remarks?: string
}) {
    const supabase = await createClient()

    // Status Logic for Quantity is handled on Frontend before sending here?
    // User Requirement: "Logic if status is damaged then show Damage Qty is -{Qty}, if repair ... show +{qty}"
    // It says "show". Does it mean store?
    // Usually "Damaged" means stock is removed from inventory. So it should be saved as NEGATIVE?
    // "Repair/Exchange" checks IN damaged item? Or sends if off?
    // If I "Repair" an item, it usually comes BACK to stock? Or is it LEAVING for repair?
    // Wait, "Damaged" -> Stock decreases (Manual Adjustment does this with negative).
    // Manual Adjustment logic: "Quantity (-) ... e.g. -5".
    // User request: "Logic if status is damaged then show Damage Qty is -{Qty}, if repair and exchange then show damage qty is +{qty}"
    // This implies the USER inputs a positive number (e.g. 5 damaged), and the system should treat it as -5.
    // For Repair/Exchange, user puts 5, system treats as +5?
    // Let's assume the frontend sends the SIGNED quantity correctly.
    // But wait, the backend just stores "quantity".
    // I will store exactly what is sent. The frontend will handle the logic of flipping signs if needed.

    // HOWEVER, for clarity in `damaged_stocks` table, usually "quantity" represents the *count* of damaged items (always positive usually? Or is it stock adjustment?)
    // If this table acts as a log, maybe we store the absolute qty and the status tells us the direction?
    // But `ManualAdjustment` stores signed qty.
    // Let's stick to signed quantity (Effect on Stock) to be consistent with other adjustments if this table is used for stock calculation.
    // user said: "Logic if status is damaged then show Damage Qty is -{Qty}"

    // I'll just save what is passed.

    const { error } = await supabase
        .from('damaged_stocks')
        .insert({
            date: data.date,
            location: data.location,
            product_id: data.product_id,
            quantity: data.quantity, // Expecting signed integer here
            status: data.status,
            remarks: data.remarks
        })

    if (error) {
        console.error('Error saving damaged stock:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/inventory/damaged-stocks')
}

// Get Damaged Stocks
export async function getDamagedStocks() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('damaged_stocks')
        .select(`
            *,
            products (
                product_name,
                product_id
            )
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching damaged stocks:', error)
        throw new Error(error.message)
    }

    return data.map((item: any) => ({
        ...item,
        product_name: item.products?.product_name || 'Unknown Product',
        product_custom_id: item.products?.product_id ? String(item.products.product_id) : '-'
    })) as DamagedStock[]
}

// Update Damaged Stock
export async function updateDamagedStock(id: string, data: Partial<DamagedStock>) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('damaged_stocks')
        .update({
            date: data.date,
            location: data.location,
            quantity: data.quantity,
            status: data.status,
            remarks: data.remarks,
            product_id: data.product_id,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (error) {
        console.error('Error updating damaged stock:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/inventory/damaged-stocks')
}

// Delete Damaged Stock
export async function deleteDamagedStock(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('damaged_stocks')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting damaged stock:', error)
        throw new Error(error.message)
    }

    revalidatePath('/dashboard/inventory/damaged-stocks')
}
