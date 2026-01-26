'use client'

import { Fragment, useState, useEffect, Suspense } from 'react'
import {
    Card,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Button
} from '@/components/ui-shim'
import { Search, Eye, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { getProfitTrackerData, getDailyProfitStats } from '@/features/sales/actions/report-actions'
import { format } from 'date-fns'
import { BulkSyncButton } from './bulk-sync-button'
import { MobileHeaderAction } from '@/components/MobileHeaderAction'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'

// Helper component for Limit Selector using props
function LimitSelector({ currentLimit, onLimitChange }: { currentLimit: number, onLimitChange: (limit: number) => void }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Rows per page</span>
            <select
                value={currentLimit}
                onChange={(e) => onLimitChange(Number(e.target.value))}
                className="h-8 w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
            >
                {[10, 20, 50, 100].map((size) => (
                    <option key={size} value={size}>
                        {size}
                    </option>
                ))}
            </select>
        </div>
    )
}

function ProfitTrackerContent({ isEmbedded = false }: { isEmbedded?: boolean }) {
    const searchParams = useSearchParams()
    const router = useRouter()

    // State
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(50)
    const [search, setSearch] = useState('')
    const [syncStatus, setSyncStatus] = useState<'all' | 'synced' | 'not_synced'>('all')

    // Initialize from URL on mount only
    useEffect(() => {
        const p = Number(searchParams.get('page')) || 1
        const l = Number(searchParams.get('limit')) || 50
        const s = searchParams.get('search') || ''
        const ss = (searchParams.get('syncStatus') as any) || 'all'

        setPage(p)
        setLimit(l)
        setSearch(s)
        setSyncStatus(ss)
    }, []) // Empty dependency to run only once on mount

    // Update URL when state changes (only if NOT embedded)
    useEffect(() => {
        if (!isEmbedded) {
            const params = new URLSearchParams()
            if (page > 1) params.set('page', String(page))
            if (limit !== 50) params.set('limit', String(limit))
            if (search) params.set('search', search)
            if (syncStatus !== 'all') params.set('syncStatus', syncStatus)

            const str = params.toString()
            const url = str ? `?${str}` : window.location.pathname
            router.replace(url, { scroll: false })
        }
    }, [page, limit, search, syncStatus, isEmbedded, router])

    // Data Fetching
    const { data: profitData, isLoading: isOrdersLoading } = useQuery({
        queryKey: ['profit-tracker', page, limit, search, syncStatus],
        queryFn: async () => {
            // Wrap the server action call
            return getProfitTrackerData({
                page,
                limit,
                search,
                syncStatus,
                startDate: undefined,
                endDate: undefined
            })
        }
    })

    const { data: dailyStats, isLoading: isStatsLoading } = useQuery({
        queryKey: ['daily-profit-stats', search, syncStatus],
        queryFn: async () => {
            return getDailyProfitStats({
                search,
                syncStatus,
                startDate: undefined,
                endDate: undefined
            })
        },
        staleTime: 5 * 60 * 1000 // Cache stats for 5 mins
    })

    const orders = profitData?.data || []
    const totalCount = profitData?.totalCount || 0
    const totalPages = profitData?.totalPages || 0
    const rawStatsList: any[] = Array.isArray(dailyStats) ? dailyStats : []
    const isLoading = isOrdersLoading || isStatsLoading

    // Client-Side Aggregation of Stats
    // We process the raw list from backend to match Frontend/Local Timezone grouping
    const stats: Record<string, { statsBySeller: Record<string, { profit: number, missing: number, revenue: number, cost: number }>, totalProfit: number, totalRevenue: number }> = {}

    rawStatsList.forEach((stat: any) => {
        if (!stat.date) return
        const dateKey = format(new Date(stat.date), 'yyyy-MM-dd') // Local Time Grouping

        if (!stats[dateKey]) {
            stats[dateKey] = { statsBySeller: {}, totalProfit: 0, totalRevenue: 0 }
        }

        const seller = stat.seller || 'Unknown'
        if (!stats[dateKey].statsBySeller[seller]) {
            stats[dateKey].statsBySeller[seller] = { profit: 0, missing: 0, revenue: 0, cost: 0 }
        }

        stats[dateKey].totalProfit += stat.profit
        stats[dateKey].totalRevenue += (stat.revenue || 0)
        stats[dateKey].statsBySeller[seller].profit += stat.profit
        stats[dateKey].statsBySeller[seller].revenue += (stat.revenue || 0)
        stats[dateKey].statsBySeller[seller].cost += (stat.cost || 0)
        stats[dateKey].statsBySeller[seller].missing += stat.missing
    })

    // Grouping Logic
    const groupedOrders = orders.reduce((groups: any, order: any) => {
        // Priority: delivered_by_daraz > delivered_at
        const dateRaw = order.delivered_by_daraz || order.delivered_at
        const dateKey = dateRaw ? format(new Date(dateRaw), 'yyyy-MM-dd') : 'Unknown Date'

        if (!groups[dateKey]) {
            // Use aggregated stats for this day
            const dayStats = stats[dateKey] || { statsBySeller: {}, totalProfit: 0 }

            groups[dateKey] = {
                orders: [],
                totalProfit: dayStats.totalProfit || 0,
                totalRevenue: dayStats.totalRevenue || 0,
                dateLabel: dateRaw ? format(new Date(dateRaw), 'EEEE, MMMM d, yyyy') : 'Unknown Date',
                statsBySeller: dayStats.statsBySeller || {}
            }
        }
        groups[dateKey].orders.push(order)
        return groups
    }, {})



    const sortedDateKeys = Object.keys(groupedOrders).sort((a, b) => {
        if (a === 'Unknown Date') return 1
        if (b === 'Unknown Date') return -1
        return b.localeCompare(a)
    })

    let globalIndex = 0
    const visibleOrderNumbers = orders.map((o: any) => o.order_number)

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950">
            {/* Header - Conditional */}
            {!isEmbedded && (
                <div className="hidden md:flex bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-4 flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profit Tracker</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Financial analysis of delivered orders | Total: {totalCount}
                            </p>
                        </div>
                        <div>
                            <BulkSyncButton orderNumbers={visibleOrderNumbers} />
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Actions Portal - Only if standalone? User didn't specify, keeping safe */}
            <div className="md:hidden">
                <MobileHeaderAction>
                    <BulkSyncButton orderNumbers={visibleOrderNumbers} />
                </MobileHeaderAction>
            </div>


            {/* Controls Bar: Tabs & Search */}
            <div className={`sticky ${isEmbedded ? 'top-0' : 'top-0'} z-20 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 md:px-6 md:py-4 shadow-sm`}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* Search Box */}
                    <div className="w-full md:flex-1 md:max-w-sm relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value)
                                setPage(1)
                            }}
                            type="text"
                            placeholder="Search Order / Invoice..."
                            className="w-full pl-9 h-9 text-sm rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* Sync Button */}
                    <div className="w-full md:w-auto">
                        <BulkSyncButton orderNumbers={visibleOrderNumbers} />
                    </div>

                    {/* Status Tabs */}
                    <div className="flex w-full md:w-auto p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-x-auto no-scrollbar">
                        {(['all', 'synced', 'not_synced'] as const).map(status => (
                            <button
                                key={status}
                                onClick={() => { setSyncStatus(status); setPage(1); }}
                                className={`flex-1 md:flex-none text-center px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${syncStatus === status
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                {status === 'all' ? 'All' : status === 'synced' ? 'Synced' : 'Not Synced'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-2 md:p-6 space-y-4">
                {/* Table */}
                <Card className="overflow-hidden border-none shadow-md bg-white dark:bg-zinc-900">
                    <div className="overflow-x-auto">
                        <Table className="min-w-[800px]">
                            <TableHeader className="bg-gray-50 dark:bg-zinc-800">
                                <TableRow>
                                    <TableHead className="w-16">S.N</TableHead>
                                    <TableHead className="w-[100px]">Sync Status</TableHead>
                                    <TableHead>Delivered Date</TableHead>
                                    <TableHead>Order Number</TableHead>
                                    <TableHead>Seller Account</TableHead>
                                    <TableHead>Product Name</TableHead>
                                    <TableHead className="text-right">Product Price</TableHead>
                                    <TableHead className="text-right">Purchase Cost</TableHead>
                                    <TableHead className="text-right">Profit</TableHead>
                                    <TableHead className="text-center w-[100px]">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-48 text-center text-gray-500">
                                            Loading data...
                                        </TableCell>
                                    </TableRow>
                                ) : orders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center text-gray-500">
                                            No delivered orders found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedDateKeys.map((dateKey) => {
                                        const group = groupedOrders[dateKey]
                                        return (
                                            <Fragment key={dateKey}>
                                                {/* Group Header */}
                                                <TableRow className="bg-gray-100 dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-700">
                                                    <TableCell colSpan={8} className="py-3 pl-4 align-top">
                                                        <div className="relative min-h-[28px]">
                                                            <span className="absolute left-0 top-1 font-bold text-gray-700 dark:text-gray-200 text-sm whitespace-nowrap">
                                                                {group.dateLabel}
                                                            </span>
                                                            <div className="w-full flex justify-center">
                                                                <div className="flex flex-col gap-1.5">
                                                                    {Object.entries(group.statsBySeller).map(([seller, stats]: [string, any]) => (
                                                                        <div key={seller} className="flex items-center gap-3 text-xs bg-white dark:bg-zinc-900/50 px-2 py-1 rounded border border-gray-200 dark:border-zinc-700 w-fit shadow-sm">
                                                                            <span className="font-semibold text-gray-700 dark:text-gray-300 w-[140px] truncate" title={seller}>
                                                                                {seller}
                                                                            </span>
                                                                            <span className="text-gray-300 dark:text-zinc-700">|</span>
                                                                            <span className="flex items-center gap-1 w-[140px]">
                                                                                <span className="text-gray-500">Profit:</span>
                                                                                <span className={`font-medium ${stats.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                                    Rs. {stats.profit.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                                                                                </span>
                                                                            </span>
                                                                            <span className="text-gray-300 dark:text-zinc-700">|</span>
                                                                            <span className="flex items-center gap-1 w-[180px]">
                                                                                <span className="text-gray-500">Total Price:</span>
                                                                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                                                                    Rs. {(stats.revenue || 0).toLocaleString()}
                                                                                </span>
                                                                            </span>
                                                                            <span className="text-gray-300 dark:text-zinc-700">|</span>
                                                                            <span className="flex items-center gap-1 w-[180px]">
                                                                                <span className="text-gray-500">Total Cost:</span>
                                                                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                                                                    Rs. {(stats.cost || 0).toLocaleString()}
                                                                                </span>
                                                                            </span>
                                                                            {stats.missing > 0 && (
                                                                                <>
                                                                                    <span className="text-gray-300 dark:text-zinc-700">|</span>
                                                                                    <span className="text-red-600 font-medium flex items-center gap-1 w-[100px]">
                                                                                        <AlertTriangle className="w-3 h-3 text-red-500" /> Missing: {stats.missing}
                                                                                    </span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell colSpan={2} className="text-right font-bold py-3 pr-4 text-gray-900 dark:text-gray-100 align-top">
                                                        <div className="flex items-center justify-end gap-2 h-full min-h-[28px]">
                                                            <span className="text-xs text-gray-500 font-normal uppercase">TP :</span>
                                                            <span className={`${group.totalProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                Rs. {group.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>

                                                {/* Group Rows */}
                                                {group.orders.map((order: any, i: number) => {
                                                    const currentRowIndex = globalIndex++
                                                    const isSynced = order.sync_status === 'synced'

                                                    return (
                                                        <TableRow key={order.order_primary_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                            <TableCell className="text-gray-500">
                                                                {((page - 1) * limit) + currentRowIndex + 1}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${isSynced
                                                                    ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                                                                    : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                                                    }`}>
                                                                    {isSynced ? 'Synced' : 'Not Synced'}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col">
                                                                    <span className={`font-medium text-gray-900 dark:text-gray-100 ${!order.delivered_by_daraz && order.delivered_at ? 'underline decoration-wavy decoration-2 decoration-amber-500 font-bold' : ''}`}
                                                                        title={!order.delivered_by_daraz && order.delivered_at ? 'Using Sync Time (Official Time Missing)' : 'Official Delivery Time'}
                                                                    >
                                                                        {(order.delivered_by_daraz || order.delivered_at) ? format(new Date(order.delivered_by_daraz || order.delivered_at), 'MM/dd/yyyy') : '-'}
                                                                    </span>
                                                                    <span className="text-xs text-gray-400">
                                                                        {(order.delivered_by_daraz || order.delivered_at) ? format(new Date(order.delivered_by_daraz || order.delivered_at), 'h:mm a') : ''}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col gap-0.5">
                                                                    <Link
                                                                        href={`/dashboard/sales/daraz/profit-tracker/${order.order_primary_id}`}
                                                                        className="font-mono text-blue-600 dark:text-blue-400 font-medium hover:underline"
                                                                    >
                                                                        {order.order_number}
                                                                    </Link>
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                                        {order.invoice_number || '-'}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="px-2 py-1 rounded bg-gray-100 dark:bg-zinc-800 text-xs font-medium">
                                                                    {order.seller_account || 'N/A'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell children={
                                                                <div
                                                                    className="max-w-[300px] cursor-help"
                                                                    title={order.products?.map((p: any) => `${p.product_name} (ID: ${p.product_id || 'N/A'})`).join('\n')}
                                                                >
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="truncate block text-sm text-gray-900 dark:text-gray-100">
                                                                            {order.products?.[0]?.product_name || 'Unknown Product'}
                                                                        </span>
                                                                        <span className="text-xs text-gray-500 font-mono">
                                                                            ID: {order.products?.[0]?.product_id || 'N/A'}
                                                                        </span>
                                                                    </div>
                                                                    {order.products && order.products.length > 1 && (
                                                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1 block">
                                                                            (+{order.products.length - 1} more)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            } />
                                                            <TableCell className="text-right">
                                                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                                    Rs. {order.total_revenue?.toLocaleString() || '0'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {order.total_purchase_cost > 0 ? (
                                                                    <span
                                                                        className={`text-sm font-medium text-gray-900 dark:text-gray-100 ${order.products.length > 1 ? 'cursor-help border-b border-dotted border-gray-400' : ''}`}
                                                                        title={order.products.length > 1 ? order.products.map((p: any) => `${p.product_name}: Rs. ${p.purchase_price.toLocaleString()} (x${p.quantity})`).join('\n') : undefined}
                                                                    >
                                                                        Rs. {order.total_purchase_cost.toLocaleString()}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-red-400 text-sm font-medium">Missing</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex flex-col items-end">
                                                                    <span className={`text-sm font-semibold ${order.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                        Rs. {order.profit?.toLocaleString() || '0'}
                                                                    </span>
                                                                    {order.profit_percentage !== undefined && (
                                                                        <span className={`text-xs ${order.profit > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                            ({order.profit_percentage.toFixed(2)}%)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Link href={`/dashboard/sales/daraz/profit-tracker/${order.order_primary_id}`}>
                                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                        <Eye className="h-4 w-4 text-blue-600" />
                                                                    </Button>
                                                                </Link>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </Fragment>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>

                {/* Footer Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 items-center py-4 gap-4 relative">
                    <div className="justify-self-start">
                        <LimitSelector currentLimit={limit} onLimitChange={(val) => { setLimit(val); setPage(1); }} />
                    </div>

                    <div className="justify-self-center flex items-center gap-1.5">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className={`px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded transition-colors ${page > 1
                                ? 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                                : 'opacity-50 cursor-not-allowed'
                                }`}
                        >
                            Previous
                        </button>

                        {totalPages > 1 && Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                            .map((p, i, arr) => {
                                const showEllipsis = i > 0 && arr[i - 1] !== p - 1
                                return (
                                    <Fragment key={p}>
                                        {showEllipsis && <span className="px-1 text-[13px] text-gray-400">...</span>}
                                        <button
                                            onClick={() => setPage(p)}
                                            className={`px-2 py-0.5 text-[13px] rounded transition-colors ${p === page
                                                ? 'bg-blue-600 text-white'
                                                : 'border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    </Fragment>
                                )
                            })
                        }

                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className={`px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded transition-colors ${page < totalPages
                                ? 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                                : 'opacity-50 cursor-not-allowed'
                                }`}
                        >
                            Next
                        </button>
                    </div>

                    <div className="justify-self-end text-sm text-gray-500">
                        Page {page} of {totalPages} ({totalCount} items)
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function ProfitTrackerPage(props: { isEmbedded?: boolean }) {
    return (
        <Suspense fallback={<div className="p-4 text-center">Loading profit tracker...</div>}>
            <ProfitTrackerContent {...props} />
        </Suspense>
    )
}
