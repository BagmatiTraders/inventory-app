'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { checkProductPlan } from '@/features/purchase/actions/plan-actions'
import { ProductSelectionModal } from './ProductSelectionModal'
import { AddPlanModal } from '@/features/purchase/components/daily-plan/AddPlanModal'
import { toast } from 'sonner'

interface QuickPlanButtonProps {
    order: any
    stockInfo?: any
}

export function QuickPlanButton({ order, stockInfo }: QuickPlanButtonProps) {
    const [showProductSelection, setShowProductSelection] = useState(false)
    const [showPlanModal, setShowPlanModal] = useState(false)
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
    const [isChecking, setIsChecking] = useState(false)

    // Don't show button for "Shipped" orders
    const orderStatus = order.order_status?.toLowerCase()
    if (orderStatus === 'shipped') {
        return null
    }

    // Get order items from the order object
    const orderItems = order.items || []

    if (orderItems.length === 0) {
        return null // No products in order
    }

    const handleClick = async () => {
        setIsChecking(true)

        try {
            // If single product, check and open directly
            if (orderItems.length === 1) {
                const productId = orderItems[0].product_id

                // Skip if product_id is null (product not in inventory yet)
                if (!productId) {
                    toast.error('Product not found in inventory', {
                        description: 'Please add this product to inventory first.'
                    })
                    setIsChecking(false)
                    return
                }

                const today = new Date().toISOString().split('T')[0]
                const alreadyPlanned = await checkProductPlan(productId, today)

                if (alreadyPlanned) {
                    toast.error('Product Already Planned', {
                        description: 'This product already has a purchase plan for today.'
                    })
                    setIsChecking(false)
                    return
                }

                setSelectedProductId(productId)
                setShowPlanModal(true)
            } else {
                // Multiple products - show selection modal
                setShowProductSelection(true)
            }
        } catch (error) {
            console.error('Error:', error)
            toast.error('Failed to process request')
        } finally {
            setIsChecking(false)
        }
    }

    const handleProductSelect = async (productId: string) => {
        setShowProductSelection(false)

        if (!productId) {
            toast.error('Product not found in inventory', {
                description: 'Please add this product to inventory first.'
            })
            return
        }

        const today = new Date().toISOString().split('T')[0]
        const alreadyPlanned = await checkProductPlan(productId, today)

        if (alreadyPlanned) {
            toast.error('Product Already Planned', {
                description: 'This product already has a purchase plan for today.'
            })
            return
        }

        setSelectedProductId(productId)
        setShowPlanModal(true)
    }

    const handlePlanSuccess = () => {
        setShowPlanModal(false)
        setSelectedProductId(null)
        toast.success('Purchase plan created successfully!')
    }

    return (
        <>
            <button
                onClick={handleClick}
                disabled={isChecking}
                className="p-0.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded text-blue-600 dark:text-blue-400 disabled:opacity-50"
                title="Quick Purchase Plan"
            >
                <Plus size={16} />
            </button>

            {/* Product Selection Modal for multi-product orders */}
            <ProductSelectionModal
                isOpen={showProductSelection}
                onClose={() => setShowProductSelection(false)}
                products={orderItems.map((item: any) => {
                    // Get stock for this product from stockInfo
                    const productStock = stockInfo?.products?.find((p: any) => p.product_id === item.product_id)
                    return {
                        product_id: item.product_id,
                        product_name: item.product_name || 'Unknown Product',
                        quantity: item.quantity,
                        stock: productStock?.total_stock
                    }
                })}
                onProductSelect={handleProductSelect}
            />

            {/* Plan Modal */}
            {selectedProductId && (
                <AddPlanModal
                    trigger={null}
                    onPlanAdded={() => { }}
                    prefilledProductId={selectedProductId}
                    onSuccess={handlePlanSuccess}
                    isOpen={showPlanModal}
                    onClose={() => {
                        setShowPlanModal(false)
                        setSelectedProductId(null)
                    }}
                />
            )}
        </>
    )
}
