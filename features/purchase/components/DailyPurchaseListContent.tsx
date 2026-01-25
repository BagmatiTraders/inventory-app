'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { getPurchasePlans } from '@/features/purchase/actions/plan-actions'
import { getTodayPurchases, getPurchases } from '@/features/purchase/actions/purchase-actions'
import { getDailyPurchaseReport } from '@/features/purchase/actions/purchase-analytics-actions'
import { PlanList } from '@/features/purchase/components/daily-plan/PlanList'
import { SearchInput } from '@/features/purchase/components/daily-plan/SearchInput'
import { AddPlanModal } from '@/features/purchase/components/daily-plan/AddPlanModal'
import { ArrowLeft, Plus, FileText, List as ListIcon, Eye } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import DailyPurchaseDetailView from './DailyPurchaseDetailView'

import PurchaseForm from '@/features/purchase/components/PurchaseForm'

interface DailyPurchaseListContentProps {
    isEmbedded?: boolean
}

export default function DailyPurchaseListContent({ isEmbedded = false }: DailyPurchaseListContentProps) {
    const [viewMode, setViewMode] = useState<'plan' | 'transactions'>('plan')
    const [isAddPurchaseModalOpen, setIsAddPurchaseModalOpen] = useState(false)
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()
    const searchQuery = searchParams.get('q')?.toLowerCase() || ''

    // Fetch Plans
    const { data: allPlans, isLoading: isPlansLoading } = useQuery({
        queryKey: ['purchase-plans'],
        queryFn: () => getPurchasePlans()
    })

    // Fetch Today's Purchases (for completion status)
    const { data: todayPurchasesData, isLoading: isPurchasesLoading } = useQuery({
        queryKey: ['today-purchases-for-plan'],
        queryFn: () => getTodayPurchases()
    })

    // Fetch Details for Today (for Transaction Details View)
    const today = new Date().toISOString().split('T')[0]
    const { data: detailData, isLoading: isDetailLoading } = useQuery({
        queryKey: ['purchase-details-today', today],
        queryFn: () => getPurchases({ startDate: today, endDate: today, limit: 1000 }),
        enabled: viewMode === 'transactions'
    })

    const completedProductIds = Array.from(new Set(todayPurchasesData?.purchases?.map((p: any) => p.product_id) || [])) as string[]

    // Filter Plans
    const filteredPlans = searchQuery
        ? allPlans?.filter(p => p.product?.product_name.toLowerCase().includes(searchQuery)) || []
        : allPlans || []

    const isLoading = isPlansLoading || isPurchasesLoading

    const handlePlanAdded = async () => {
        // Invalidate queries to refresh list
        queryClient.invalidateQueries({ queryKey: ['purchase-plans'] })
    }

    const handlePlanUpdated = async () => {
        // Invalidate both plans and today's purchases (for purchased status check)
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['purchase-plans'] }),
            queryClient.invalidateQueries({ queryKey: ['today-purchases-for-plan'] }),
            queryClient.invalidateQueries({ queryKey: ['today-purchases'] }) // Also refresh main purchase list if needed
        ])
    }

    const handlePurchaseAdded = async () => {
        // Refresh data after adding a purchase
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['today-purchases-for-plan'] }),
            queryClient.invalidateQueries({ queryKey: ['purchase-details-today'] }),
            queryClient.invalidateQueries({ queryKey: ['today-purchases'] })
        ])
    }

    return (
        <div className={`flex flex-col h-full bg-gray-50 dark:bg-zinc-900 ${isEmbedded ? '' : ''}`}>
            {/* Header - Only shown if NOT embedded */}
            {!isEmbedded && (
                <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                    <div>
                        <h1 className="text-[17px] font-bold text-blue-600">Daily Purchases</h1>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">Plan and track daily procurement</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/dashboard/purchase"
                            className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                        >
                            <ArrowLeft size={16} />
                            Back to Purchase
                        </Link>
                    </div>
                </div>
            )}

            {/* Toggle Buttons & Controls */}
            <div className={`hidden md:block sticky z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-2 shadow-sm ${isEmbedded ? 'top-0' : 'top-0'}`}>
                <div className="flex items-center justify-between gap-3">
                    {/* Left: View Toggles (Desktop) */}
                    <div className="flex items-center p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                        <button
                            onClick={() => setViewMode('plan')}
                            className={`flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'plan'
                                ? 'bg-white dark:bg-zinc-700 text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            <FileText size={14} />
                            Purchase Plan
                        </button>
                        <button
                            onClick={() => setViewMode('transactions')}
                            className={`flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'transactions'
                                ? 'bg-white dark:bg-zinc-700 text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            <ListIcon size={14} />
                            Transaction Details
                        </button>
                    </div>

                    {/* Right: Actions (Only for Plan View currently) - Desktop */}
                    {viewMode === 'plan' && (
                        <div className="flex items-center gap-2">
                            <div className="w-64">
                                <SearchInput />
                            </div>
                            <AddPlanModal onPlanAdded={handlePlanAdded} />
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Header Controls */}
            <div className={`md:hidden sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 ${viewMode === 'plan' ? 'block' : 'hidden'}`}>
                <div className="px-4 py-3 space-y-3">
                    <div className="flex items-center justify-between relative">
                        {/* Spacer for centering */}
                        <div className="w-8"></div>
                        <h1 className="text-lg font-bold">Daily Purchases</h1>
                        {/* Add Purchase Button */}
                        <button
                            onClick={() => setIsAddPurchaseModalOpen(true)}
                            className="p-1.5 text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>
                <div className="px-4 pb-3">
                    <SearchInput />
                </div>
            </div>

            {/* Content Area */}
            <div className={`flex-1 ${viewMode === 'plan' ? 'overflow-auto p-3 pb-24' : 'overflow-hidden'}`}>
                {viewMode === 'plan' ? (
                    isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="text-gray-500">Loading plans...</div>
                        </div>
                    ) : (
                        <PlanList
                            plans={filteredPlans}
                            completedProductIds={completedProductIds}
                            onPlanUpdated={handlePlanUpdated}
                        />
                    )
                ) : (
                    /* Transaction Details View - Direct Detail View */
                    <DailyPurchaseDetailView
                        date={today}
                        purchases={detailData?.purchases || []}
                        isLoading={isDetailLoading}
                    // No onBack provided, so back button will be hidden
                    />
                )}
            </div>

            {/* Mobile Floating Action Button (Plan View Only) */}
            {viewMode === 'plan' && (
                <div className="md:hidden fixed bottom-20 right-4 z-40">
                    <AddPlanModal
                        onPlanAdded={handlePlanAdded}
                        trigger={
                            <button className="h-12 w-12 bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all">
                                <Plus size={24} />
                            </button>
                        }
                    />
                </div>
            )}

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 z-50 px-2 py-2 pb-safe">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('plan')}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors ${viewMode === 'plan'
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                            }`}
                    >
                        <FileText size={20} />
                        <span className="text-xs font-medium">Purchase Plan</span>
                    </button>
                    <button
                        onClick={() => setViewMode('transactions')}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors ${viewMode === 'transactions'
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                            }`}
                    >
                        <ListIcon size={20} />
                        <span className="text-xs font-medium">Transaction Details</span>
                    </button>
                </div>
            </div>

            {/* Add Purchase Modal */}
            {isAddPurchaseModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-3xl h-[80vh] bg-white dark:bg-zinc-900 rounded-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <PurchaseForm
                            onClose={() => setIsAddPurchaseModalOpen(false)}
                            onSuccess={handlePurchaseAdded}
                            showExtraFields={true} // Assuming full entry form is desired as per "Purchase Entry" page
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
