'use client'

import { useState } from 'react'
import { useOnlineStores } from '@/features/settings/hooks/useStores'
import { Card } from '@/components/ui-shim'
import { Store } from 'lucide-react'

import { StatementDetailView } from './StatementDetailView'

export function AccountStatementView({ storeId }: { storeId?: string }) {
    const { data: stores } = useOnlineStores()
    const [selectedStore, setSelectedStore] = useState(storeId || '')
    const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)

    if (selectedPeriod) {
        return (
            <StatementDetailView
                period={selectedPeriod}
                storeId={selectedStore}
                onBack={() => setSelectedPeriod(null)}
            />
        )
    }

    return (
        <div className="space-y-4">
            {/* Store Selection Dropdown as requested */}
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 text-gray-500">
                    <Store className="w-5 h-5" />
                    <span className="text-sm font-medium">Select Store:</span>
                </div>
                <select
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="h-10 flex-1 md:w-64 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
                >
                    <option value="" disabled>Select a connected store</option>
                    {stores?.map((store: any) => (
                        <option key={store.id} value={store.id}>
                            {store.seller_account} ({store.company_name})
                        </option>
                    ))}
                </select>
            </div>

            {/* Statement Table */}
            {selectedStore && (
                <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 font-medium">
                                <tr>
                                    <th className="px-4 py-3">Statement Period</th>
                                    <th className="px-4 py-3 text-right">Release Amount</th>
                                    <th className="px-4 py-3 text-right">Commission/Fee</th>
                                    <th className="px-4 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {generateWeeklyPeriods().map((period, index) => (
                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                                            {period.label}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-500">
                                            -
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-500">
                                            -
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => setSelectedPeriod(period.label)}
                                                    className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 transition-colors"
                                                >
                                                    View Statement Details
                                                </button>
                                                <button className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 dark:bg-zinc-800 dark:text-gray-400 dark:border-zinc-700 transition-colors">
                                                    Release Status
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {!selectedStore && (
                <Card className="p-8 border-dashed flex flex-col items-center justify-center text-gray-500 min-h-[200px]">
                    <p>Please select a store to view its statement</p>
                </Card>
            )}
        </div>
    )
}

// Helper to generate last 5 weeks (Mon-Sun)
function generateWeeklyPeriods() {
    const periods = []
    const today = new Date()
    // Find last Monday
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
    let currentMonday = new Date(today.setDate(diff))

    for (let i = 0; i < 5; i++) {
        const monday = new Date(currentMonday)
        monday.setDate(currentMonday.getDate() - (i * 7))

        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)

        const startStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        const endStr = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

        periods.push({
            label: `${startStr} - ${endStr}`, // Monday - Sunday
        })
    }
    return periods
}
