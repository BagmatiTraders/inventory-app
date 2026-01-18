'use client'

import { useState, useEffect } from 'react'
import { X, ArrowRightLeft, AlertCircle, Search, CheckCircle } from 'lucide-react'
import { MarketplaceOrder, redirectMarketplaceOrder } from '@/features/sales/actions/marketplace-actions'
import { toast } from 'sonner'

interface RedirectOrderModalProps {
    sourceOrder: MarketplaceOrder
    initialTargetOrder?: MarketplaceOrder | null
    candidates?: MarketplaceOrder[]
    onClose: () => void
    onSuccess: () => void
}

export function RedirectOrderModal({ sourceOrder, initialTargetOrder, candidates = [], onClose, onSuccess }: RedirectOrderModalProps) {
    // Mode: 'select' or 'confirm'
    const [step, setStep] = useState<'select' | 'confirm'>(initialTargetOrder ? 'confirm' : 'select')
    const [selectedTarget, setSelectedTarget] = useState<MarketplaceOrder | null>(initialTargetOrder || null)

    // Form State
    const [charge, setCharge] = useState<number>(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    // Search State
    const [searchTerm, setSearchTerm] = useState('')

    // Reset logic if initialTarget changes
    useEffect(() => {
        if (initialTargetOrder) {
            setSelectedTarget(initialTargetOrder)
            setStep('confirm')
        } else {
            setStep('select')
        }
    }, [initialTargetOrder])

    const filteredCandidates = candidates.filter(c => {
        const term = searchTerm.toLowerCase()
        const salesIdMatch = c.sales_id.toLowerCase().includes(term)
        const customerMatch = c.customer_name.toLowerCase().includes(term)
        const productMatch = c.items?.some(item => item.product_name.toLowerCase().includes(term)) || false

        return salesIdMatch || customerMatch || productMatch
    })

    const handleSelectTarget = (target: MarketplaceOrder) => {
        setSelectedTarget(target)
        setStep('confirm')
    }

    const handleChangeTarget = () => {
        setStep('select')
        setError('')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!selectedTarget) {
            setError('No target order selected')
            return
        }

        if (!confirm('This will permanently redirect both orders. Continue?')) {
            return
        }

        setIsSubmitting(true)
        try {
            await redirectMarketplaceOrder({
                sourceOrderId: sourceOrder.id,
                targetOrderId: selectedTarget.id,
                charge
            })
            toast.success('Orders redirected successfully')
            onSuccess()
        } catch (err: any) {
            setError(err.message || 'Redirect failed')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="border-b dark:border-zinc-800 px-4 py-3 flex items-center justify-between bg-white dark:bg-zinc-900 shrink-0">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <ArrowRightLeft className="text-blue-600" size={20} />
                        Redirect Order
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex bg-gray-50 dark:bg-zinc-800/50 p-3 border-b dark:border-zinc-800 shrink-0">
                    <div className="flex-1">
                        <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Source (Pending)</span>
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-sm bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                                {sourceOrder.sales_id}
                            </span>
                            <span className="text-sm font-medium truncate">{sourceOrderDetails(sourceOrder)}</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4">
                    {step === 'select' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Select Matching "Returning" Order
                                </h3>
                                <div className="text-xs text-gray-500">
                                    Branch: {sourceOrder.branch?.branch_name || 'Generic'}
                                </div>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search by Sales ID, Customer, or Product..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-sm border dark:border-zinc-700 rounded-md focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800"
                                />
                            </div>

                            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                {filteredCandidates.length === 0 ? (
                                    <div className="text-center p-8 border border-dashed rounded-lg text-gray-500">
                                        <p>No matching Returning orders found.</p>
                                        <p className="text-xs mt-1">Make sure the target order is "Returning to Seller" and in the same branch.</p>
                                    </div>
                                ) : (
                                    filteredCandidates.map(candidate => (
                                        <div
                                            key={candidate.id}
                                            onClick={() => handleSelectTarget(candidate)}
                                            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border dark:border-zinc-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-sm font-medium text-blue-700 dark:text-blue-400">
                                                        {candidate.sales_id}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        • {new Date(candidate.order_date).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="text-sm font-medium mb-0.5">
                                                    {sourceOrderDetails(candidate)}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {candidate.customer_name} • {candidate.phone_number}
                                                </div>
                                            </div>
                                            <button className="text-sm font-medium text-blue-600 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded border border-blue-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                                Select
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'confirm' && selectedTarget && (
                        <div className="space-y-6">
                            {/* Selected Target Summary */}
                            <div className="border dark:border-zinc-700 rounded-lg p-3 bg-blue-50 dark:bg-blue-900/10 relative">
                                <div className="absolute top-3 right-3">
                                    <button
                                        onClick={handleChangeTarget}
                                        className="text-xs text-blue-600 hover:underline font-medium"
                                    >
                                        Change Target
                                    </button>
                                </div>
                                <span className="text-xs font-bold text-blue-600 uppercase mb-2 block">Target (Returning)</span>
                                <div className="space-y-1 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold">{selectedTarget.sales_id}</span>
                                        <CheckCircle size={14} className="text-green-600" />
                                    </div>
                                    <div className="font-medium">{sourceOrderDetails(selectedTarget)}</div>
                                    <div className="text-gray-500 text-xs">
                                        {selectedTarget.customer_name} • {selectedTarget.phone_number}
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-4">

                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Redirect Charge (INR ₹) <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={charge}
                                                onChange={(e) => setCharge(parseFloat(e.target.value) || 0)}
                                                className="w-full pl-7 pr-3 py-2 border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-100 text-red-700 rounded-md flex items-center gap-2 text-sm">
                                        <AlertCircle size={16} />
                                        {error}
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-4 border-t dark:border-zinc-800">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        disabled={isSubmitting}
                                        className="px-4 py-2 text-sm border dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50 shadow-sm"
                                    >
                                        {isSubmitting ? 'Processing...' : 'Confirm Redirect'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function sourceOrderDetails(order: any) {
    if (!order.items || order.items.length === 0) return 'No items'
    const first = order.items[0].product_name
    const count = order.items.length
    return count > 1 ? `${first} +${count - 1}` : first
}
