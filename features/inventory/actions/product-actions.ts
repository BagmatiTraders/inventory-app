'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Product {
    id: string
    product_id: number
    product_name: string
    image_url: string | null
    product_type: 'single' | 'combo'
    seller_sku1: string | null
    seller_account1: string | null
    seller_sku2: string | null
    seller_account2: string | null
    seller_sku3: string | null
    seller_account3: string | null
    seller_sku4: string | null
    seller_account4: string | null
    created_by: string | null
    created_at: string
    updated_by: string | null
    updated_at: string
    import_flag: boolean
    is_deleted: boolean
    product_combos?: { count: number }[]
}

export interface ProductCombo {
    id: string
    parent_product_id: string
    child_product_id: string
    quantity: number
    created_at: string
}

export interface ApprovalRequest {
    id: string
    resource_type: string
    resource_id: string
    resource_name: string
    action_type: string
    requested_by: string | null
    requested_at: string
    expires_at: string
    status: 'pending' | 'approved' | 'rejected' | 'expired'
    reviewed_by: string | null
    reviewed_at: string | null
    metadata: any
}

export interface DeletedItem {
    id: string
    resource_type: string
    resource_id: string
    resource_name: string
    resource_data: any
    related_data: any
    deleted_by: string | null
    deleted_at: string
    approved_by: string | null
    approved_at: string | null
    expires_at: string
    is_restored: boolean
    restored_by: string | null
    restored_at: string | null
}

// ============================================================================
// PRODUCT CRUD OPERATIONS
// ============================================================================

/**
 * Get paginated list of products with search and filters
 */
export async function getProducts(params: {
    page?: number
    limit?: number
    search?: string
    productType?: 'single' | 'combo' | 'all'
}) {
    const { page = 1, limit = 50, search = '', productType = 'all' } = params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Calculate pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    // Build query
    let query = supabase
        .from('products')
        // Select all fields + count of combo items (where product is PARENT)
        .select('*, product_combos!product_combos_parent_product_id_fkey(count)', { count: 'exact' })
        .eq('is_deleted', false)

    // Apply product type filter
    if (productType !== 'all') {
        query = query.eq('product_type', productType)
    }

    // Apply search across multiple fields
    if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`
        let orQuery = `product_name.ilike.${searchTerm},seller_sku1.ilike.${searchTerm},seller_sku2.ilike.${searchTerm},seller_sku3.ilike.${searchTerm},seller_sku4.ilike.${searchTerm}`

        // If search looks like a number, allow searching by ID match
        if (!isNaN(Number(search.trim()))) {
            orQuery += `,product_id.eq.${search.trim()}`
        }

        query = query.or(orQuery)
    }

    // Sort alphabetically by product name (A-Z)
    query = query.order('product_name', { ascending: true })

    // Apply pagination
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw new Error(error.message)

    return {
        products: data as Product[],
        totalCount: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
    }
}

/**
 * Get single product by ID with combo items
 */
export async function getProductById(productId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get product
    const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('is_deleted', false)
        .single()

    if (productError) throw new Error(productError.message)
    if (!product) throw new Error('Product not found')

    // If combo, get combo items
    let comboItems: any[] = []
    if (product.product_type === 'combo') {
        const { data: combos, error: comboError } = await supabase
            .from('product_combos')
            .select(`
                id,
                quantity,
                child:products!product_combos_child_product_id_fkey(
                    id,
                    product_id,
                    product_name
                )
            `)
            .eq('parent_product_id', productId)

        if (comboError) throw new Error(comboError.message)
        comboItems = combos || []
    }

    // Get creator/updater details
    const { data: creator } = await supabase.rpc('get_user_display_name', { user_id: product.created_by })
    const { data: updater } = await supabase.rpc('get_user_display_name', { user_id: product.updated_by })

    return {
        ...product,
        combo_items: comboItems,
        created_by_name: creator,
        updated_by_name: updater
    }
}

/**
 * Create new product
 */
export async function createProduct(data: {
    product_name: string
    image_url?: string
    product_type: 'single' | 'combo'
    seller_sku1?: string
    seller_account1?: string
    seller_sku2?: string
    seller_account2?: string
    seller_sku3?: string
    seller_account3?: string
    seller_sku4?: string
    seller_account4?: string
    combo_items?: Array<{ child_product_id: string; quantity: number }>
    import_flag?: boolean
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Validate product name
    if (!data.product_name || !data.product_name.trim()) {
        throw new Error('Product name is required')
    }

    // Validate combo items if product type is combo
    if (data.product_type === 'combo') {
        if (!data.combo_items || data.combo_items.length === 0) {
            throw new Error('Combo products must have at least one component')
        }
    }

    // Create product
    const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
            product_name: data.product_name.trim(),
            image_url: data.image_url || null,
            product_type: data.product_type,
            seller_sku1: data.seller_sku1 || null,
            seller_account1: data.seller_account1 || null,
            seller_sku2: data.seller_sku2 || null,
            seller_account2: data.seller_account2 || null,
            seller_sku3: data.seller_sku3 || null,
            seller_account3: data.seller_account3 || null,
            seller_sku4: data.seller_sku4 || null,
            seller_account4: data.seller_account4 || null,
            created_by: user.id,
            updated_by: user.id,
            import_flag: data.import_flag || false
        })
        .select()
        .single()

    if (productError) throw new Error(productError.message)

    // If combo, create combo items
    if (data.product_type === 'combo' && data.combo_items) {
        const comboInserts = data.combo_items.map(item => ({
            parent_product_id: product.id,
            child_product_id: item.child_product_id,
            quantity: item.quantity
        }))

        const { error: comboError } = await supabase
            .from('product_combos')
            .insert(comboInserts)

        if (comboError) {
            // Rollback: delete the product
            await supabase.from('products').delete().eq('id', product.id)
            throw new Error(`Failed to create combo items: ${comboError.message}`)
        }
    }

    revalidatePath('/dashboard/inventory/product-list')
    return product
}

/**
 * Update existing product
 */
export async function updateProduct(
    productId: string,
    data: Partial<{
        product_name: string
        image_url: string
        product_type: 'single' | 'combo'
        seller_sku1: string
        seller_account1: string
        seller_sku2: string
        seller_account2: string
        seller_sku3: string
        seller_account3: string
        seller_sku4: string
        seller_account4: string
        combo_items: Array<{ child_product_id: string; quantity: number }>
    }>
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get existing product
    const { data: existingProduct } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('is_deleted', false)
        .single()

    if (!existingProduct) throw new Error('Product not found')

    // Separate combo_items from product fields to avoid schema error
    const { combo_items, ...updatePayload } = data

    // Update product
    const { data: updatedProduct, error: updateError } = await supabase
        .from('products')
        .update({
            ...updatePayload,
            updated_by: user.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select()
        .single()

    if (updateError) throw new Error(updateError.message)

    // Update combo items if product type is combo
    if (data.product_type === 'combo' && data.combo_items) {
        // Delete existing combo items
        await supabase.from('product_combos').delete().eq('parent_product_id', productId)

        // Insert new combo items
        const comboInserts = data.combo_items.map(item => ({
            parent_product_id: productId,
            child_product_id: item.child_product_id,
            quantity: item.quantity
        }))

        const { error: comboError } = await supabase
            .from('product_combos')
            .insert(comboInserts)

        if (comboError) throw new Error(`Failed to update combo items: ${comboError.message}`)
    }

    revalidatePath('/dashboard/inventory/product-list')
    return updatedProduct
}

/**
 * Delete product (role-based logic)
 * - Admin: Direct delete → Restore Backup
 * - User: Create approval request
 */
export async function deleteProduct(productId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get user role
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile) throw new Error('User profile not found')

    // Get product details
    // Get product details
    const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

    if (!product) throw new Error(`Product not found (ID: ${productId})`)
    if (product.is_deleted) throw new Error('Product already deleted')

    let comboItems = []
    if (product.product_type === 'combo') {
        const { data: combos } = await supabase
            .from('product_combos')
            .select('*')
            .eq('parent_product_id', productId)

        comboItems = combos || []
    }

    const productWithCombos = { ...product, combo_items: comboItems }

    const isAdmin = profile.role === 'admin'

    if (isAdmin) {
        // Admin: Direct delete
        // 1. Mark product as deleted
        await supabase
            .from('products')
            .update({ is_deleted: true })
            .eq('id', productId)

        // 2. Move to restore backup
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 15) // 15 days from now

        await supabase
            .from('deleted_items')
            .insert({
                resource_type: 'product',
                resource_id: productId,
                resource_name: product.product_name,
                resource_data: product,
                related_data: { combo_items: comboItems },
                deleted_by: user.id,
                approved_by: user.id,
                approved_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString()
            })

        revalidatePath('/dashboard/inventory/product-list')
        return { status: 'deleted', message: 'Product deleted successfully' }
    } else {
        // User: Create approval request
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 48) // 48 hours from now

        const { error: approvalError } = await supabase
            .from('approval_requests')
            .insert({
                resource_type: 'product',
                resource_id: productId,
                resource_name: product.product_name,
                action_type: 'delete',
                requested_by: user.id,
                expires_at: expiresAt.toISOString(),
                metadata: { product_data: product, combo_items: product.combo_items }
            })

        if (approvalError) throw new Error(approvalError.message)

        revalidatePath('/dashboard/inventory/product-list')
        return { status: 'pending', message: 'Delete request sent for approval' }
    }
}

// ============================================================================
// APPROVAL WORKFLOW
// ============================================================================

/**
 * Get all approval requests
 */
export async function getApprovalRequests(resourceType?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    let query = supabase
        .from('approval_requests')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })

    if (resourceType) {
        query = query.eq('resource_type', resourceType)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return data as ApprovalRequest[]
}

/**
 * Approve delete request
 */
export async function approveDeleteRequest(requestId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if user is admin
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Only admins can approve requests')
    }

    // Get approval request
    const { data: request } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('id', requestId)
        .single()

    if (!request) throw new Error('Approval request not found')
    if (request.status !== 'pending') throw new Error('Request is not pending')

    // Mark product as deleted
    if (request.resource_type === 'product') {
        await supabase
            .from('products')
            .update({ is_deleted: true })
            .eq('id', request.resource_id)

        // Move to restore backup
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 15)

        await supabase
            .from('deleted_items')
            .insert({
                resource_type: request.resource_type,
                resource_id: request.resource_id,
                resource_name: request.resource_name,
                resource_data: request.metadata.product_data,
                related_data: request.metadata,
                deleted_by: request.requested_by,
                approved_by: user.id,
                approved_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString()
            })
    }

    // Update approval request
    await supabase
        .from('approval_requests')
        .update({
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId)

    revalidatePath('/dashboard/inventory/product-list')
    revalidatePath('/dashboard/settings/approvals')
    return { success: true }
}

/**
 * Reject delete request
 */
export async function rejectDeleteRequest(requestId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if user is admin
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Only admins can reject requests')
    }

    // Update approval request
    const { error } = await supabase
        .from('approval_requests')
        .update({
            status: 'rejected',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/settings/approvals')
    return { success: true }
}

// ============================================================================
// RESTORE BACKUP
// ============================================================================

/**
 * Get deleted items for restore
 */
export async function getDeletedItems(resourceType?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Only admins can view restore backup
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Only admins can access restore backup')
    }

    let query = supabase
        .from('deleted_items')
        .select('*')
        .eq('is_restored', false)
        .order('deleted_at', { ascending: false })

    if (resourceType) {
        query = query.eq('resource_type', resourceType)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return data as DeletedItem[]
}

/**
 * Restore deleted product
 */
export async function restoreProduct(deletedItemId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if user is admin
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Only admins can restore items')
    }

    // Get deleted item
    const { data: deletedItem } = await supabase
        .from('deleted_items')
        .select('*')
        .eq('id', deletedItemId)
        .single()

    if (!deletedItem) throw new Error('Deleted item not found')
    if (deletedItem.is_restored) throw new Error('Item already restored')

    // Restore product
    await supabase
        .from('products')
        .update({ is_deleted: false })
        .eq('id', deletedItem.resource_id)

    // Mark as restored
    await supabase
        .from('deleted_items')
        .update({
            is_restored: true,
            restored_by: user.id,
            restored_at: new Date().toISOString()
        })
        .eq('id', deletedItemId)

    revalidatePath('/dashboard/inventory/product-list')
    revalidatePath('/dashboard/settings/backup')
    return { success: true }
}

// ============================================================================
// CSV IMPORT/EXPORT
// ============================================================================

/**
 * Bulk import products from CSV data
 */
export async function bulkImportProducts(products: Array<Partial<Product>>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ row: number; product: string; error: string }>
    }

    // Filter out rows with empty product names and prepare batch data
    const validProducts = products
        .map((p, index) => ({ ...p, originalIndex: index }))
        .filter(p => p.product_name && p.product_name.trim())

    if (validProducts.length === 0) {
        return results
    }

    // Prepare batch insert data
    const batchData = validProducts.map(productData => ({
        product_name: productData.product_name!.trim(),
        image_url: productData.image_url || null,
        product_type: productData.product_type || 'single',
        seller_sku1: productData.seller_sku1 || null,
        seller_account1: productData.seller_account1 || null,
        seller_sku2: productData.seller_sku2 || null,
        seller_account2: productData.seller_account2 || null,
        seller_sku3: productData.seller_sku3 || null,
        seller_account3: productData.seller_account3 || null,
        seller_sku4: productData.seller_sku4 || null,
        seller_account4: productData.seller_account4 || null,
        created_by: user.id,
        updated_by: user.id,
        import_flag: true
    }))

    // Process in chunks of 500 to avoid timeout
    const CHUNK_SIZE = 500
    for (let i = 0; i < batchData.length; i += CHUNK_SIZE) {
        const chunk = batchData.slice(i, i + CHUNK_SIZE)

        try {
            const { data, error } = await supabase
                .from('products')
                .insert(chunk)
                .select()

            if (error) {
                // If batch fails, try individual inserts for this chunk
                for (let j = 0; j < chunk.length; j++) {
                    try {
                        await supabase.from('products').insert(chunk[j])
                        results.success++
                    } catch (individualError: any) {
                        results.failed++
                        const originalIndex = validProducts[i + j].originalIndex
                        results.errors.push({
                            row: originalIndex + 2,
                            product: chunk[j].product_name,
                            error: individualError.message
                        })
                    }
                }
            } else {
                results.success += data.length
            }
        } catch (error: any) {
            // Fallback to individual inserts for this chunk
            for (let j = 0; j < chunk.length; j++) {
                try {
                    await supabase.from('products').insert(chunk[j])
                    results.success++
                } catch (individualError: any) {
                    results.failed++
                    const originalIndex = validProducts[i + j].originalIndex
                    results.errors.push({
                        row: originalIndex + 2,
                        product: chunk[j].product_name,
                        error: individualError.message
                    })
                }
            }
        }
    }

    revalidatePath('/dashboard/inventory/product-list')
    return results
}

/**
 * Export products to CSV format
 */
export async function exportProducts() {
    const { products } = await getProducts({ page: 1, limit: 10000 })

    // Transform products to CSV-friendly format
    const csvData = products.map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        image_url: p.image_url || '',
        product_type: p.product_type,
        seller_sku1: p.seller_sku1 || '',
        seller_account1: p.seller_account1 || '',
        seller_sku2: p.seller_sku2 || '',
        seller_account2: p.seller_account2 || '',
        seller_sku3: p.seller_sku3 || '',
        seller_account3: p.seller_account3 || '',
        seller_sku4: p.seller_sku4 || '',
        seller_account4: p.seller_account4 || '',
    }))

    return csvData
}

/**
 * Delete all products (admin only)
 */
export async function deleteAllProducts() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if user is admin
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Only admins can delete all products')
    }

    // Get all products
    const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('is_deleted', false)

    if (!products || products.length === 0) {
        return { deleted: 0, message: 'No products to delete' }
    }

    // Mark all products as deleted
    const { error } = await supabase
        .from('products')
        .update({ is_deleted: true })
        .eq('is_deleted', false)

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/inventory/product-list')
    return { deleted: products.length, message: `Successfully deleted ${products.length} products` }
}

/**
 * Find product by matching any seller sku
 */
export async function getProductBySku(sku: string) {
    const supabase = await createClient()

    // We search all 4 columns. 
    // OR condition: seller_sku1.eq.sku, seller_sku2.eq.sku...

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_deleted', false)
        .or(`seller_sku1.eq.${sku},seller_sku2.eq.${sku},seller_sku3.eq.${sku},seller_sku4.eq.${sku}`)
        .limit(1)
        .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found" which is fine
        console.error('Error finding product by SKU:', error)
    }

    return data as Product | null
}
