import { getPurchasePlans } from '@/features/purchase/actions/plan-actions'
import { getTodayPurchases } from '@/features/purchase/actions/purchase-actions'
import { AddPlanModal } from '@/features/purchase/components/daily-plan/AddPlanModal'
import { PlanList } from '@/features/purchase/components/daily-plan/PlanList'
import { SearchInput } from '@/features/purchase/components/daily-plan/SearchInput'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DailyPurchaseListPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    // Await params
    const params = await searchParams

    // Fetch Plans
    const plansPromise = getPurchasePlans()
    const todayPurchasesPromise = getTodayPurchases()

    const [allPlans, todayPurchasesData] = await Promise.all([plansPromise, todayPurchasesPromise])

    const completedProductIds = Array.from(new Set(todayPurchasesData.purchases?.map((p: any) => p.product_id) || [])) as string[]

    // Server-side filtering for Search
    const query = params?.q?.toLowerCase() || ''
    const filteredPlans = query
        ? allPlans.filter(p => p.product?.product_name.toLowerCase().includes(query))
        : allPlans

    return (
        <div className="container mx-auto md:p-4 md:pt-4 max-w-7xl">


            <div className="space-y-2 md:space-y-6">
                {/* Mobile Search */}
                <div className="md:hidden">
                    <SearchInput />
                </div>

                {/* Desktop Header */}
                <div className="hidden md:flex flex-col gap-2 md:flex-row md:justify-between md:items-center bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-lg border dark:border-zinc-800 shadow-sm md:gap-4">
                    <div className="flex justify-between items-center w-full md:w-auto">
                        <div>
                            <h1 className="hidden md:block text-2xl font-bold tracking-tight text-blue-600">Daily Purchase List Plan</h1>
                            <p className="hidden md:block text-muted-foreground text-sm">Plan and track your daily procurement needs</p>
                        </div>

                    </div>

                    <div className="hidden md:flex items-center gap-2 w-full md:w-auto">
                        <div className="flex-1 md:w-auto">
                            <SearchInput />
                        </div>
                        <div className="hidden md:block">
                            <AddPlanModal
                                onPlanAdded={async () => {
                                    'use server'
                                }}
                            />
                        </div>
                        <Link
                            href="/dashboard/purchase"
                            className="flex items-center justify-center p-2 md:px-3 md:py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
                        >
                            <ArrowLeft size={16} className="md:mr-2" />
                            <span className="hidden md:inline">Back to Purchase</span>
                        </Link>
                    </div>
                </div>

                {/* List */}
                <PlanList plans={filteredPlans} completedProductIds={completedProductIds} />
            </div>

            {/* Mobile Floating Action Button */}
            <div className="md:hidden fixed bottom-6 right-4 z-40">
                <AddPlanModal
                    onPlanAdded={async () => {
                        'use server'
                    }}
                    trigger={
                        <button className="h-12 w-12 bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all">
                            <Plus size={24} />
                        </button>
                    }
                />
            </div>
        </div>
    )
}
