'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type MobileCapture = {
    id: string
    created_at: string
    image_path: string
    image_url: string
    price: number | null
    remarks: string | null
    group_id: string | null
    user_id: string | null
}

export type SaveCaptureParams = {
    image_path: string
    image_url: string
    price?: number
    remarks?: string
    group_id?: string
}

export async function saveMobileCapture(params: SaveCaptureParams) {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        throw new Error('User not authenticated')
    }

    const { data, error } = await supabase
        .from('mobile_captures')
        .insert({
            image_path: params.image_path,
            image_url: params.image_url,
            price: params.price || null,
            remarks: params.remarks || null, // Allow empty string to be null or store as is? Prefer null if empty for cleaner DB
            group_id: params.group_id || null,
            user_id: user.id
        })
        .select()
        .single()

    if (error) {
        console.error('Error saving mobile capture:', error)
        throw new Error('Failed to save capture info')
    }

    revalidatePath('/dashboard/mobile-uploads')
    return data
}

export async function getMobileCaptures() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('mobile_captures')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching mobile captures:', error)
        throw new Error('Failed to fetch captures')
    }

    return data as MobileCapture[]
}

export type PhotoGroup = {
    id: string // group_id or capture id for single photos
    captures: MobileCapture[]
    created_at: string // earliest created_at in group
}

export function groupCapturesByGroupId(captures: MobileCapture[]): PhotoGroup[] {
    const grouped = new Map<string, MobileCapture[]>()

    // Group captures by group_id
    captures.forEach(capture => {
        const key = capture.group_id || `single-${capture.id}`
        if (!grouped.has(key)) {
            grouped.set(key, [])
        }
        grouped.get(key)!.push(capture)
    })

    // Convert to PhotoGroup array and sort each group's captures
    const groups: PhotoGroup[] = Array.from(grouped.entries()).map(([id, groupCaptures]) => {
        // Sort captures within group by created_at
        const sortedCaptures = groupCaptures.sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )

        return {
            id,
            captures: sortedCaptures,
            created_at: sortedCaptures[0].created_at
        }
    })

    // Sort groups by earliest photo's created_at (most recent first)
    return groups.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
}
