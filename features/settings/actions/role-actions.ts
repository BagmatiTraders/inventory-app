'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface PageRole {
    id: string
    main_role: string
    sub_role: string | null
    created_at: string
}

export type AddPageRoleInput = Omit<PageRole, 'id' | 'created_at'>

// Get all page roles
export async function getPageRoles() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('page_roles')
        .select('*')
        .order('main_role', { ascending: true })
        .order('sub_role', { ascending: true, nullsFirst: false })

    if (error) throw new Error(error.message)

    return data as PageRole[]
}

// Create new page role
export async function createPageRole(input: AddPageRoleInput) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if requester is admin
    const { data: adminCheck } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (adminCheck?.role !== 'admin') {
        throw new Error('Only admins can create roles')
    }

    const { error } = await supabase
        .from('page_roles')
        .insert({
            main_role: input.main_role,
            sub_role: input.sub_role,
        })

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/settings/roles')
}

// Update page role
export async function updatePageRole(id: string, input: AddPageRoleInput) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if requester is admin
    const { data: adminCheck } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (adminCheck?.role !== 'admin') {
        throw new Error('Only admins can update roles')
    }

    const { error } = await supabase
        .from('page_roles')
        .update({
            main_role: input.main_role,
            sub_role: input.sub_role,
        })
        .eq('id', id)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/settings/roles')
}

// Delete page role
export async function deletePageRole(id: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if requester is admin
    const { data: adminCheck } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (adminCheck?.role !== 'admin') {
        throw new Error('Only admins can delete roles')
    }

    const { error } = await supabase
        .from('page_roles')
        .delete()
        .eq('id', id)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/settings/roles')
}
