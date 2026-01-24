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
    const [selectedProductRemarks, setSelectedProductRemarks] = useState<string>('')
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
            // Always show selection modal
            setShowProductSelection(true)
        } catch (error) {
            console.error('Error:', error)
            toast.error('Failed to process request')
        } finally {
            setIsChecking(false)
        }
    }

    const handleProductSelect = async (productId: string, remarks?: string) => {
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
        if (remarks) setSelectedProductRemarks(remarks)
        setShowPlanModal(true)
    }

    const handlePlanSuccess = () => {
        setShowPlanModal(false)
        setSelectedProductId(null)
        setSelectedProductRemarks('')
        toast.success('Purchase plan created successfully!')
    }

    return (
        <>
            <button
                onClick={handleClick}
                disabled={isChecking}
                className="flex items-center gap-0.5 px-1 py-0.5 text-[11px] font-medium bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded disabled:opacity-50 transition-colors"
                title="Quick Purchase Plan"
            >
                <Plus size={12} />
                Add
            </button>

            {/* Product Selection Modal for multi-product orders */}
            <ProductSelectionModal
                isOpen={showProductSelection}
                onClose={() => setShowProductSelection(false)}
                products={orderItems.map((item: any) => {
                    // Get stock for this product from stockInfo
                    // Note: In new design, stock is handled internally via stockBreakdown for resolved components
                    // But we still pass basic info here
                    const productStock = stockInfo?.products?.find((p: any) => p.product_id === item.product_id)
                    return {
                        product_id: item.product_id,
                        product_name: item.product_name || 'Unknown Product',
                        image_url: productStock?.image_url,
                        quantity: item.quantity,
                        stock: 0 // Placeholder
                    }
                })}
                stockBreakdown={stockInfo?.products}
                onProductSelect={handleProductSelect}
            />

            {/* Plan Modal */}
            {selectedProductId && (
                <AddPlanModal
                    trigger={null}
                    onPlanAdded={() => { }}
                    prefilledProductId={selectedProductId}
                    prefilledRemarks={selectedProductRemarks}
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
