'use client'

import { useState } from 'react'
import { PurchasePlan, updatePurchasePlanStatus } from '@/features/purchase/actions/plan-actions'
import { CountdownTimer } from './CountdownTimer'
import { PlanDetailModal } from './PlanDetailModal'
import { Check, Eye, Archive } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui-shim'
import PurchaseForm from '@/features/purchase/components/PurchaseForm'

interface PlanListProps {
    plans: PurchasePlan[]
    completedProductIds: string[]
}

export function PlanList({ plans, completedProductIds }: PlanListProps) {
    const router = useRouter()

    // View Modal State
    const [selectedPlan, setSelectedPlan] = useState<PurchasePlan | null>(null)
    const [viewOpen, setViewOpen] = useState(false)

    // Purchase Modal State
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
    const [purchasePlanData, setPurchasePlanData] = useState<{ productId: string, productName: string, quantity: number, remarks: string } | undefined>(undefined)

    // Dynamic Grouping
    const isPurchased = (plan: PurchasePlan) => completedProductIds.includes(plan.product_id)

    const purchasedPlans = plans.filter(isPurchased)
    const pendingPlans = plans.filter(p => p.status === 'Pending' && !isPurchased(p))
    const manualCompletePlans = plans.filter(p => p.status === 'Complete' && !isPurchased(p))
    const cancelPlans = plans.filter(p => p.status === 'Cancel')

    const handleView = (plan: PurchasePlan) => {
        setSelectedPlan(plan)
        setViewOpen(true)
    }

    const handleOpenPurchaseModal = (plan: PurchasePlan) => {
        setPurchasePlanData({
            productId: plan.product_id,
            productName: plan.product?.product_name || '',
            quantity: plan.quantity,
            remarks: plan.remarks || ''
        })
        setPurchaseModalOpen(true)
    }

    const handleMarkComplete = async (plan: PurchasePlan) => {
        try {
            await updatePurchasePlanStatus(plan.id, 'Complete')
            toast.success("Marked as Complete")
        } catch (err) {
            toast.error("Failed to update status")
        }
    }

    const onPurchaseSuccess = async () => {
        setPurchaseModalOpen(false)
        router.refresh()
        toast.success("Purchase Entry Created. Plan Updated.")
    }

    const ActionButtons = ({ plan, type }: { plan: PurchasePlan, type: 'pending' | 'purchased' | 'complete' | 'cancel' }) => (
        <div className="flex items-center justify-end gap-2">
            <button onClick={() => handleView(plan)} className="p-1 hover:bg-gray-200 rounded text-blue-600" title="View Details">
                <Eye size={16} />
            </button>

            {type === 'pending' && (
                <button
                    onClick={() => {
                        if (window.confirm("Are you ready to complete this purchase?")) {
                            handleOpenPurchaseModal(plan)
                        }
                    }}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded flex items-center gap-1"
                    title="Open Purchase Entry Form"
                >
                    Complete
                </button>
            )}

            {type === 'purchased' && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-bold flex items-center gap-1 border border-blue-200">
                    <Check size={14} /> Purchased
                </span>
            )}

            {type === 'complete' && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-bold flex items-center gap-1 border border-gray-200">
                    <Archive size={14} /> Done
                </span>
            )}

            {type === 'cancel' && (
                <span className="text-red-500 text-xs font-bold">Cancelled</span>
            )}
        </div>
    )

    const RenderTable = ({ data, title, colorClass, type }: { data: PurchasePlan[], title: string, colorClass: string, type: 'pending' | 'purchased' | 'complete' | 'cancel' }) => {
        if (data.length === 0) return null

        return (
            <Card className="mb-6 border-none shadow-none md:border md:shadow-sm bg-transparent md:bg-white md:dark:bg-zinc-900">
                <CardHeader className="py-3 px-0 md:px-6 bg-transparent md:bg-gray-50 md:dark:bg-zinc-800 rounded-t-lg">
                    <CardTitle className={`text-base font-bold ${colorClass}`}>
                        {title} ({data.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto bg-white dark:bg-zinc-900 rounded-b-lg border-t md:border-none">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 dark:bg-zinc-700 text-gray-600">
                                <tr>
                                    <th className="px-4 py-2 w-12">S.N</th>
                                    <th className="px-4 py-2">Date</th>
                                    <th className="px-4 py-2">Product Name</th>
                                    <th className="px-4 py-2">Qty</th>
                                    <th className="px-4 py-2">L. Price</th>
                                    <th className="px-4 py-2">L. Supplier</th>
                                    <th className="px-4 py-2">Remarks</th>
                                    <th className="px-4 py-2">Expires In</th>
                                    <th className="px-4 py-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-zinc-700">
                                {data.map((plan, index) => (
                                    <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-4 py-2">{index + 1}</td>
                                        <td className="px-4 py-2 text-nowrap">{new Date(plan.plan_date).toLocaleDateString()}</td>
                                        <td
                                            className="px-4 py-2 font-medium text-blue-600 hover:underline cursor-pointer"
                                            onClick={() => handleView(plan)}
                                            title="Click to view details"
                                        >
                                            {plan.product?.product_name}
                                        </td>
                                        <td className="px-4 py-2">{plan.quantity}</td>
                                        <td className="px-4 py-2">Rs. {plan.snapshot_latest_price}</td>
                                        <td className="px-4 py-2 text-xs truncate max-w-[100px]" title={plan.snapshot_latest_supplier}>{plan.snapshot_latest_supplier}</td>
                                        <td className="px-4 py-2 text-xs truncate max-w-[150px]">{plan.remarks}</td>
                                        <td className="px-4 py-2">
                                            {type === 'pending' ? (
                                                <CountdownTimer targetDate={plan.expires_at} />
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <ActionButtons plan={plan} type={type} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                        {data.map((plan) => (
                            <div key={plan.id} className="bg-white dark:bg-zinc-900 p-4 rounded-lg border shadow-sm space-y-3">
                                <div className="flex justify-between items-start gap-3">
                                    <div
                                        onClick={() => handleView(plan)}
                                        className="font-medium text-blue-600 flex-1 flex items-start gap-3 group active:opacity-80"
                                    >
                                        {plan.product?.image_url ? (
                                            <img
                                                src={plan.product.image_url}
                                                alt="Product"
                                                className="w-12 h-12 rounded object-cover border bg-gray-50 flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-400 border flex-shrink-0">
                                                <Archive size={20} />
                                            </div>
                                        )}
                                        <span className="line-clamp-2 leading-tight">{plan.product?.product_name}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 whitespace-nowrap bg-gray-100 px-2 py-1 rounded dark:bg-zinc-800">
                                        {new Date(plan.plan_date).toLocaleDateString()}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-700 dark:text-gray-300">
                                    <div className="flex justify-between border-b border-dashed pb-1">
                                        <span className="text-gray-500 text-xs">Qty:</span>
                                        <span className="font-medium">{plan.quantity}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed pb-1">
                                        <span className="text-gray-500 text-xs">L. Price:</span>
                                        <span>Rs. {plan.snapshot_latest_price}</span>
                                    </div>
                                    <div className="col-span-2 flex flex-col text-xs pt-1">
                                        <span className="text-gray-500">Last Supplier:</span>
                                        <span className="truncate">{plan.snapshot_latest_supplier || 'N/A'}</span>
                                    </div>
                                </div>

                                {plan.remarks && (
                                    <div className="text-xs text-gray-600 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded border border-yellow-100 dark:border-yellow-900/20">
                                        <span className="font-semibold">Note:</span> {plan.remarks}
                                    </div>
                                )}

                                <div className="flex justify-between items-center pt-3 border-t dark:border-zinc-800">
                                    <div className="text-xs font-mono text-gray-500">
                                        {type === 'pending' && <CountdownTimer targetDate={plan.expires_at} />}
                                    </div>
                                    <ActionButtons plan={plan} type={type} />
                                </div>
                            </div>
                        ))}
                    </div>

                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <RenderTable data={pendingPlans} title="Pending Plans" colorClass="text-yellow-600" type="pending" />
            <RenderTable data={purchasedPlans} title="Purchased Today" colorClass="text-blue-600" type="purchased" />
            <RenderTable data={manualCompletePlans} title="Manually Completed" colorClass="text-green-600" type="complete" />
            <RenderTable data={cancelPlans} title="Cancelled Plans" colorClass="text-red-600" type="cancel" />

            {plans.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                    No purchase plans found
                </div>
            )}

            {/* Detail View Modal */}
            {selectedPlan && (
                <PlanDetailModal
                    plan={selectedPlan}
                    open={viewOpen}
                    onClose={() => setViewOpen(false)}
                    onUpdate={() => router.refresh()}
                />
            )}

            {/* Add Purchase Modal */}
            {purchaseModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-3xl h-[80vh] bg-white dark:bg-zinc-900 rounded-lg shadow-xl overflow-hidden">
                        <PurchaseForm
                            onClose={() => setPurchaseModalOpen(false)}
                            onSuccess={onPurchaseSuccess}
                            initialData={purchasePlanData}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
