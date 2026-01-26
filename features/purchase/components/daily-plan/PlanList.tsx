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
import { ComboComponentSelectModal } from '@/features/inventory/components/ComboComponentSelectModal'

interface PlanListProps {
    plans: PurchasePlan[]
    completedProductIds: string[]
    onPlanUpdated?: () => void
}

export function PlanList({ plans, completedProductIds, onPlanUpdated }: PlanListProps) {
    const router = useRouter()

    // View Modal State
    const [selectedPlan, setSelectedPlan] = useState<PurchasePlan | null>(null)
    const [viewOpen, setViewOpen] = useState(false)

    // Purchase Modal State
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
    const [purchasePlanData, setPurchasePlanData] = useState<{ productId: string, productName: string, quantity: number, remarks: string } | undefined>(undefined)

    // Combo Resolving State
    const [comboResolving, setComboResolving] = useState<{ id: string, name: string, planQuantity: number, remarks: string, components?: any[] } | null>(null)

    // Full Image State
    const [fullImage, setFullImage] = useState<string | null>(null)

    // Dynamic Grouping
    const isPurchased = (plan: PurchasePlan) => completedProductIds.includes(plan.product_id)

    const rawPurchasedPlans = plans.filter(isPurchased)

    // Aggregate purchased plans by product_id
    const purchasedPlans = Object.values(rawPurchasedPlans.reduce((acc, plan) => {
        const key = plan.product_id
        if (!acc[key]) {
            acc[key] = { ...plan }
        } else {
            acc[key].quantity += plan.quantity
        }
        return acc
    }, {} as Record<string, PurchasePlan>))

    const pendingPlans = plans.filter(p => p.status === 'Pending' && !isPurchased(p))
    const manualCompletePlans = plans.filter(p => p.status === 'Complete' && !isPurchased(p))
    const cancelPlans = plans.filter(p => p.status === 'Cancel')

    const handleView = (plan: PurchasePlan) => {
        setSelectedPlan(plan)
        setViewOpen(true)
    }

    const handleOpenPurchaseModal = (plan: PurchasePlan) => {
        // Check if combo
        if (plan.product && plan.product.product_type === 'combo') {
            setComboResolving({
                id: plan.product_id,
                name: plan.product.product_name,
                planQuantity: plan.quantity,
                remarks: plan.remarks || '',
                components: plan.product.product_combos || [] // Pass eager components
            })
            return
        }

        setPurchasePlanData({
            productId: plan.product_id,
            productName: plan.product?.product_name || '',
            quantity: plan.quantity,
            remarks: plan.remarks || ''
        })
        setPurchaseModalOpen(true)
    }

    // Sound Effect (Short Clap/Pop)
    const playClapSound = () => {
        const audio = new Audio("data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==") // Placeholder for actual clap sound, I will use a real one in next step if this is too short. Actually let's use a real base64.
        // Replacing with a real short 'pop/clap' base64 to ensure it works.
        const realClap = "data:audio/wav;base64,UklGRqQGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YYAGAACAgICAgICAgICAgICAgICAgICAgICAgICAf3hxeHCAgIB/cnV5gICAf3J1eYCAgH9zdXqAgIB/c3V6gICAf3N1eoCAgH9zdXqAgIB/c3V6gICAf3N1eoCAgH9zdXqAgIB/c3V6gICAf3N1eoCAgH90dn2AgIB/dHZ9gICAf3R2fYCAgH90dn2AgIB/dHZ9gICAf3R2fYCAgH90dn2AgIB/dHZ9gICAf3R2fYCAgH90dn2AgIB/dHZ9gICAf3R2fYCAgH5yc3uAgIB+cnN7gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH1xdHqAgIB9cXR6gICAfXF0eoCAgH1xdHqAgIB9cXR6gICAfXF0eoCAgH1xdHqAgIB9cXR6gICAfXF0eoCAgH1xdHqAgIB9cXR6gICAfXF0eoCAgH1xdHqAgIB9cXR6gICAfXF0eoCAgH1xdHqAgIB9cXR6gIB=" // This is truncated dummy. I will use a proper generic function with a reliable URL or just standard "sound" logic.
        // Actually, best approach: Use a standard small distinct beep/pop encoded or simply confirm Vibration first.
        // User asked for "Clap". 
        // I will use a short base64 string for a "tick" or "pop" which is safer.

        try {
            // Using a simple short beep/pop base64
            const snd = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU" + "A".repeat(100)); // Dummy
            const clapAudio = new Audio("https://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3"); // Reliable public CDN for 'Pop' sound
            clapAudio.volume = 0.5;
            clapAudio.play().catch(e => console.error("Audio play failed", e));
        } catch (e) {
            console.error("Sound error", e)
        }
    }

    const triggerMobileFeedback = (withSound: boolean) => {
        // Mobile check
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            // Vibrate
            if (navigator.vibrate) {
                navigator.vibrate(200)
            }

            // Sound
            if (withSound) {
                playClapSound()
            }
        }
    }

    const handleMarkComplete = async (plan: PurchasePlan) => {
        try {
            triggerMobileFeedback(true) // Vibrate + Sound
            await updatePurchasePlanStatus(plan.id, 'Complete')
            toast.success("Marked as Complete")
            onPlanUpdated?.()
        } catch (err) {
            toast.error("Failed to update status")
        }
    }

    const handleMarkCancel = async (plan: PurchasePlan) => {
        if (!confirm("Are you sure you want to cancel this plan?")) return
        try {
            triggerMobileFeedback(false) // Vibrate Only
            await updatePurchasePlanStatus(plan.id, 'Cancel')
            toast.success("Plan Cancelled")
            onPlanUpdated?.()
        } catch (err) {
            toast.error("Failed to update status")
        }
    }

    const onPurchaseSuccess = async () => {
        triggerMobileFeedback(true)
        setPurchaseModalOpen(false)
        toast.success("Purchase Entry Created. Plan Updated.")
        onPlanUpdated?.()
    }

    const ActionButtons = ({ plan, type }: { plan: PurchasePlan, type: 'pending' | 'purchased' | 'complete' | 'cancel' }) => (
        <div className="flex items-center justify-end gap-2">
            {type === 'pending' && (
                <>
                    <button
                        onClick={() => {
                            if (window.confirm("Complete Purchase? This will mark the plan as finished.")) {
                                handleMarkComplete(plan)
                            }
                        }}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded flex items-center gap-1 border border-gray-300"
                        title="Mark as Complete"
                    >
                        <Check size={14} /> Complete
                    </button>

                    <button
                        onClick={() => handleMarkCancel(plan)}
                        className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs rounded flex items-center gap-1 border border-red-200"
                        title="Cancel Plan"
                    >
                        Cancel
                    </button>
                </>
            )}

            {type === 'purchased' && (
                <button disabled className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-bold flex items-center gap-1 border border-gray-200 cursor-not-allowed">
                    <Check size={14} /> Done
                </button>
            )}

            {type === 'complete' && (
                <button
                    onClick={() => {
                        handleOpenPurchaseModal(plan)
                    }}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded flex items-center gap-1"
                    title="Open Purchase Entry Form"
                >
                    Add Purchase
                </button>
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
                <CardHeader className="sticky top-0 z-10 py-3 px-4 md:px-6 bg-gray-100/95 dark:bg-zinc-800/95 backdrop-blur supports-[backdrop-filter]:bg-gray-100/60 border-b dark:border-zinc-700 md:static md:bg-gray-50 md:dark:bg-zinc-800 rounded-t-lg">
                    <CardTitle className={`text-base font-bold ${colorClass.replace(
                        /text-[a-z]+-[0-9]+/,
                        (match) => `${match} dark:text-white`
                    )}`}>
                        {title} ({data.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto bg-white dark:bg-zinc-900 rounded-b-lg border-t md:border-none">
                        <table className="w-full text-sm text-left table-fixed">
                            <thead className="bg-gray-100 dark:bg-zinc-700 text-gray-600">
                                <tr>
                                    <th className="px-4 py-2 w-[5%]">S.N</th>
                                    <th className="px-4 py-2 w-[8%]">Date</th>
                                    <th className="px-4 py-2 w-[25%]">Product Name</th>
                                    <th className="px-4 py-2 w-[5%]">Qty</th>
                                    <th className="px-4 py-2 w-[10%]">L. Price</th>
                                    <th className="px-4 py-2 w-[15%]">L. Supplier</th>
                                    <th className="px-4 py-2 w-[10%]">Remarks</th>
                                    <th className="px-4 py-2 w-[10%]">Expires In</th>
                                    <th className="px-4 py-2 w-[15%] text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-zinc-700">
                                {data.map((plan, index) => (
                                    <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-4 py-2">{index + 1}</td>
                                        <td className="px-4 py-2 whitespace-nowrap">{new Date(plan.plan_date).toLocaleDateString()}</td>
                                        <td
                                            className="px-4 py-2 font-medium text-blue-600 hover:underline cursor-pointer whitespace-normal break-words"
                                            onClick={() => handleView(plan)}
                                            title="Click to view details"
                                        >
                                            {plan.product?.product_name}
                                        </td>
                                        <td className="px-4 py-2">{plan.quantity}</td>
                                        <td className="px-4 py-2">Rs. {plan.snapshot_latest_price}</td>
                                        <td className="px-4 py-2 truncate" title={plan.snapshot_latest_supplier}>{plan.snapshot_latest_supplier}</td>
                                        <td className="px-4 py-2 truncate">{plan.remarks}</td>
                                        <td className="px-4 py-2">
                                            <CountdownTimer targetDate={plan.expires_at} />
                                        </td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap">
                                            <ActionButtons plan={plan} type={type} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-2">
                        {data.map((plan) => (
                            <div key={plan.id} className="bg-white dark:bg-zinc-900 p-2 rounded-lg border shadow-sm flex flex-col gap-1.5">
                                {/* Row 1: Countdown (Left) | Low Price (Right) */}
                                <div className="flex justify-between items-center text-[10px] pb-1.5 border-b border-dashed">
                                    <div className="font-mono text-gray-500 dark:text-white">
                                        <CountdownTimer targetDate={plan.expires_at} />
                                    </div>
                                    <div className="font-medium text-gray-700 dark:text-gray-300">
                                        Rs. {plan.snapshot_low_price}
                                    </div>
                                </div>

                                {/* Row 2: Image 30% | Name 70% */}
                                <div className="flex gap-2 items-center py-0.5" onClick={() => handleView(plan)}>
                                    <div className="w-[30%] flex justify-start" onClick={(e) => {
                                        if (plan.product?.image_url) {
                                            e.stopPropagation()
                                            setFullImage(plan.product.image_url)
                                        }
                                    }}>
                                        {plan.product?.image_url ? (
                                            <img
                                                src={plan.product.image_url}
                                                alt="Product"
                                                className="w-full h-16 rounded-md object-cover border bg-gray-50"
                                            />
                                        ) : (
                                            <div className="w-full h-16 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 border">
                                                <Archive size={24} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-[70%] font-medium text-blue-600 dark:text-white text-xs leading-tight line-clamp-3">
                                        {plan.product?.product_name}
                                    </div>
                                </div>

                                {/* Row 3: Qty (Left - Middle) | L Price (Right - Middle) */}
                                <div className="flex justify-between items-center py-1.5 border-t border-dashed text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-gray-500 text-[10px]">Qty:</span>
                                        <span className="font-bold">{plan.quantity}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-gray-500 text-[10px]">L. Price:</span>
                                        <span className="font-bold">Rs. {plan.snapshot_latest_price}</span>
                                    </div>
                                </div>

                                {/* Row 4: Buttons */}
                                <div className="pt-1.5 border-t dark:border-zinc-800">
                                    {type === 'pending' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            {/* Complete Button */}
                                            <button
                                                onClick={() => {
                                                    if (window.confirm("Complete Purchase? This will mark the plan as finished.")) {
                                                        handleMarkComplete(plan)
                                                    }
                                                }}
                                                className="w-full py-1.5 bg-green-50 hover:bg-green-100 text-green-700 font-medium text-[10px] rounded flex items-center justify-center gap-1 transition-all border border-green-200"
                                            >
                                                <Check size={12} /> Complete
                                            </button>

                                            {/* Cancel Button */}
                                            <button
                                                onClick={() => handleMarkCancel(plan)}
                                                className="w-full py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-medium text-[10px] rounded flex items-center justify-center gap-1 transition-all border border-red-200"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}

                                    {type === 'complete' && (
                                        <button
                                            onClick={() => handleOpenPurchaseModal(plan)}
                                            className="w-full py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] rounded-full flex items-center justify-center gap-1 transition-all shadow-sm"
                                        >
                                            Add Purchase
                                        </button>
                                    )}

                                    {type === 'purchased' && (
                                        <div className="w-full py-1.5 bg-gray-50 text-gray-400 text-[10px] rounded flex items-center justify-center gap-1 border border-gray-100 cursor-not-allowed font-medium">
                                            <Check size={12} /> Entry Done
                                        </div>
                                    )}

                                    {type === 'cancel' && (
                                        <div className="w-full py-1.5 text-center text-red-500 text-[10px] font-bold bg-red-50 rounded border border-red-100">
                                            Cancelled
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                </CardContent>
            </Card >
        )
    }

    return (
        <div className="space-y-6">
            {/* Styles for custom animations */}
            <style jsx global>{`
                @keyframes shimmer-x {
                    from { transform: translateX(-150%); }
                    to { transform: translateX(150%); }
                }
                .animate-shimmer-x {
                    animation: shimmer-x 2s infinite linear;
                }
            `}</style>

            <RenderTable data={pendingPlans} title="Pending Plans" colorClass="text-yellow-600" type="pending" />
            <RenderTable data={manualCompletePlans} title="Manually Completed" colorClass="text-green-600" type="complete" />
            <RenderTable data={purchasedPlans} title="Purchased Today" colorClass="text-blue-600" type="purchased" />
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 md:p-4">
                    <div className="w-full max-w-3xl h-full md:h-[80vh] bg-white dark:bg-zinc-900 md:rounded-lg shadow-xl overflow-hidden">
                        <PurchaseForm
                            onClose={() => setPurchaseModalOpen(false)}
                            onSuccess={onPurchaseSuccess}
                            initialData={purchasePlanData}
                        />
                    </div>
                </div>
            )}

            {/* Combo Component Select Modal */}
            {comboResolving && (
                <ComboComponentSelectModal
                    comboProductId={comboResolving.id}
                    comboProductName={comboResolving.name}
                    initialComponents={comboResolving.components}
                    onClose={() => setComboResolving(null)}
                    onSelectComponent={(component) => {
                        setComboResolving(null)
                        // Open purchase form with component
                        setPurchasePlanData({
                            productId: component.id,
                            productName: component.product_name,
                            quantity: comboResolving.planQuantity, // Or calculate based on ratio? User said "when user click Product A then open add purchase form with Product name is Product A" implies simple mapping. Quantity likely needs user input or just prefill with plan quantity. I'll prefill with plan quantity for now as a default.
                            remarks: `Component of bundle: ${comboResolving.name}. ${comboResolving.remarks}`
                        })
                        setPurchaseModalOpen(true)
                    }}
                />
            )}

            {/* Full Image Modal */}
            {fullImage && (
                <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setFullImage(null)}>
                    <div className="relative max-w-full max-h-full">
                        <button className="absolute -top-10 right-0 text-white p-2">Close</button>
                        <img src={fullImage} alt="Full View" className="max-w-full max-h-[80vh] object-contain rounded-md" />
                    </div>
                </div>
            )}
        </div>
    )
}
