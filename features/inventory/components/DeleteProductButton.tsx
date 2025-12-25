'use client'

import { useState } from 'react'
import { Trash2, Clock } from 'lucide-react'
import { deleteProduct } from '@/features/inventory/actions/product-actions'
import { useQueryClient } from '@tanstack/react-query'

interface DeleteProductButtonProps {
    productId: string
    productName: string
    userRole: 'admin' | 'user'
    isPending?: boolean
}

export function DeleteProductButton({ productId, productName, userRole, isPending = false }: DeleteProductButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const queryClient = useQueryClient()

    const handleDelete = async () => {
        if (isPending) {
            // Already pending approval, do nothing
            return
        }

        // Confirmation message based on role
        const confirmMessage = userRole === 'admin'
            ? `Are you sure you want to delete "${productName}"? This will move it to Restore Backup.`
            : `Delete Product! Need Admin Approval\n\nProduct: ${productName}\n\nYour delete request will be sent to Admin for approval.`

        if (!confirm(confirmMessage)) {
            return
        }

        setIsDeleting(true)
        try {
            const result = await deleteProduct(productId)

            // Refresh product list
            queryClient.invalidateQueries({ queryKey: ['products'] })

            if (result.status === 'deleted') {
                alert('Product deleted successfully and moved to Restore Backup')
            } else if (result.status === 'pending') {
                alert('Delete request sent for admin approval')
            }
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        } finally {
            setIsDeleting(false)
        }
    }

    // If pending approval, show clock icon
    if (isPending) {
        return (
            <button
                disabled
                className="px-3 py-1 text-sm text-orange-600 bg-orange-50 dark:bg-orange-900/20 rounded cursor-not-allowed flex items-center gap-1"
                title="Delete pending approval"
            >
                <Clock size={14} />
                Pending
            </button>
        )
    }

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
    )
}
