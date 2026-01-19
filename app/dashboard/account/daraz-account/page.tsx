'use client'

import { useState, useEffect } from 'react'
import { useOnlineStores } from '@/features/settings/hooks/useStores'
import { getDarazStatement, WeeklyStatement } from '@/features/account/actions/daraz-account-actions'
import { syncDarazFinances } from '@/features/sales/actions/daraz-finance-service'
import { Card, Button } from '@/components/ui-shim'
import { RefreshCw, Store, Calendar, ArrowDownToLine, AlertCircle } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { toast } from 'sonner'
import { AccountStatementView } from '@/features/account/components/AccountStatementView'

export default function DarazAccountPage() {
    return (
        <DarazAccountContent />
    )
}

function DarazAccountContent() {
    const { data: stores, isLoading: isStoresLoading } = useOnlineStores()
    const [selectedStoreId, setSelectedStoreId] = useState<string>('')
    const [activeTab, setActiveTab] = useState<'statement' | 'report' | 'account-statement'>('statement')

    // Select first store by default
    useEffect(() => {
        if (stores && stores.length > 0 && !selectedStoreId) {
            setSelectedStoreId(stores[0].id)
        }
    }, [stores, selectedStoreId])

    const selectedStore = stores?.find(s => s.id === selectedStoreId)

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-4 shadow-sm">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Daraz Account</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Financial statements and ledger
                            </p>
                        </div>

                        {/* Store Selector */}
                        <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-gray-400" />
                            <select
                                value={selectedStoreId}
                                onChange={(e) => setSelectedStoreId(e.target.value)}
                                className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                                disabled={isStoresLoading}
                            >
                                {isStoresLoading ? (
                                    <option>Loading stores...</option>
                                ) : (
                                    stores?.map((store: any) => (
                                        <option key={store.id} value={store.id}>
                                            {store.seller_account} ({store.company_name})
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 border-b border-gray-200 dark:border-zinc-800">
                        <button
                            onClick={() => setActiveTab('statement')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'statement'
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Statement
                        </button>
                        <button
                            onClick={() => setActiveTab('account-statement')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'account-statement'
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Account Statement
                        </button>
                        <button
                            onClick={() => setActiveTab('report')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'report'
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Report
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 md:p-6">
                {selectedStoreId ? (
                    activeTab === 'statement' ? (
                        <StatementView storeId={selectedStoreId} />
                    ) : activeTab === 'account-statement' ? (
                        <AccountStatementView storeId={selectedStoreId} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                            <p>Report View is coming soon</p>
                        </div>
                    )
                ) : (
                    <div className="text-center py-10 text-gray-500">
                        Please select a store to view accounts.
                    </div>
                )}
            </div>
        </div>
    )
}

function StatementView({ storeId }: { storeId: string }) {
    const [data, setData] = useState<WeeklyStatement[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [lastSync, setLastSync] = useState<Date | null>(null)

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const res = await getDarazStatement(storeId)
            setData(res)
        } catch (err) {
            console.error(err)
            toast.error('Failed to load statements')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [storeId])

    const handleSync = async () => {
        setIsSyncing(true)
        try {
            // Sync last 60 days by default (covers ~8 weeks)
            const end = new Date()
            const start = subDays(end, 60)

            const startStr = format(start, 'yyyy-MM-dd')
            const endStr = format(end, 'yyyy-MM-dd')

            toast.message('Syncing Financials...', { description: `Fetching from ${startStr} to ${endStr}` })

            const result = await syncDarazFinances(storeId, startStr, endStr)

            if (result.count > 0) {
                toast.success('Sync Complete', { description: result.message })
                fetchData() // Refresh table
                setLastSync(new Date())
            } else {
                toast.info('No new transactions found')
            }
        } catch (error: any) {
            toast.error('Sync Failed', { description: error.message })
        } finally {
            setIsSyncing(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-200 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Weekly Statements (Mon-Sun)
                    </span>
                    {lastSync && (
                        <span className="text-xs">
                            Synced: {lastSync.toLocaleTimeString()}
                        </span>
                    )}
                </div>
                <Button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Financials'}
                </Button>
            </div>

            {/* Table */}
            <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 font-medium">
                            <tr>
                                <th className="px-4 py-3">Statement Period</th>
                                <th className="px-4 py-3 text-right text-green-600">Total Sales</th>
                                <th className="px-4 py-3 text-right text-red-600">Daraz Fees</th>
                                <th className="px-4 py-3 text-right text-orange-600">Other Charges</th>
                                <th className="px-4 py-3 text-right font-bold text-gray-900 dark:text-gray-100">Net Payout</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-right">Trans. Count</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                        Loading statements...
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                        No financial data found. Click "Sync Financials" to start.
                                    </td>
                                </tr>
                            ) : (
                                data.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900 dark:text-gray-100">
                                                {row.periodLabel}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {row.startDate} ~ {row.endDate}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-green-600">
                                            {formatCurrency(row.revenue)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-red-600">
                                            {formatCurrency(row.darazFees)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-orange-600">
                                            {formatCurrency(row.otherCharges)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-gray-100">
                                            {formatCurrency(row.netPayout)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span
                                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${row.status === 'Paid'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    }`}
                                            >
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-500">
                                            {row.transactionCount}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}

function formatCurrency(val: number) {
    if (val === 0) return '-'
    const isNegative = val < 0
    const money = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return isNegative ? `(${money})` : money
}
