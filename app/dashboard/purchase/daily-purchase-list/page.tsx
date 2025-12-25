import { getPurchasePlans } from '@/features/purchase/actions/plan-actions'
import { getTodayPurchases } from '@/features/purchase/actions/purchase-actions'
import { AddPlanModal } from '@/features/purchase/components/daily-plan/AddPlanModal'
import { PlanList } from '@/features/purchase/components/daily-plan/PlanList'
import { SearchInput } from '@/features/purchase/components/daily-plan/SearchInput'

export const dynamic = 'force-dynamic'

export default async function DailyPurchaseListPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    // Await params
    const params = await searchParams

    // Fetch Plans
    const plansPromise = getPurchasePlans()
    const todayPurchasesPromise = getTodayPurchases()

    const [allPlans, todayPurchasesData] = await Promise.all([plansPromise, todayPurchasesPromise])

    const completedProductIds = Array.from(new Set(todayPurchasesData.purchases?.map(p => p.product_id) || []))

    // Server-side filtering for Search
    const query = params?.q?.toLowerCase() || ''
    const filteredPlans = query
        ? allPlans.filter(p => p.product?.product_name.toLowerCase().includes(query))
        : allPlans

    return (
        <div className="container mx-auto p-4 space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-lg border dark:border-zinc-800 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-blue-600">Daily Purchase List Plan</h1>
                    <p className="text-muted-foreground text-sm">Plan and track your daily procurement needs</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <SearchInput />
                    <AddPlanModal
                        onPlanAdded={async () => {
                            'use server'
                            // Client component handles refresh
                        }}
                    />
                </div>
            </div>

            {/* List */}
            <PlanList plans={filteredPlans} completedProductIds={completedProductIds} />
        </div>
    )
}
