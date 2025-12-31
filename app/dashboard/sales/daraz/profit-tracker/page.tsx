import { Fragment } from 'react'
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
import { LimitSelector } from './limit-selector'
import { MobileHeaderAction } from '@/components/MobileHeaderAction'

// Force dynamic rendering (no caching)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProfitTrackerPage({
    searchParams
}: {
    searchParams: Promise<{ page?: string, search?: string, syncStatus?: string, limit?: string }>
}) {
    const params = await searchParams
    const page = Number(params.page) || 1
    const limit = Number(params.limit) || 50
    const search = params.search || ''
    // Default to 'all' if not specified
    const syncStatus = (params.syncStatus as 'all' | 'synced' | 'not_synced') || 'all'

    // Fetch Delivered Orders from Profit Tracker Action
    const { data: orders, totalCount, totalPages } = await getProfitTrackerData({
        page,
        limit, // Use dynamic limit
        search,
        syncStatus,
        startDate: undefined,
        endDate: undefined
    })

    // Fetch Global Daily Stats (Ignoring Pagination)
    const dailyStats = await getDailyProfitStats({
        search,
        syncStatus,
        startDate: undefined,
        endDate: undefined
    })

    // Group orders by Delivered Date
    const groupedOrders = orders.reduce((groups: any, order: any) => {
        const dateKey = order.delivered_at ? format(new Date(order.delivered_at), 'yyyy-MM-dd') : 'Unknown Date'
        if (!groups[dateKey]) {
            // Retrieve Global Stats for this Date
            const globalDayStats = dailyStats[dateKey] || { statsBySeller: {}, totalProfit: 0 }

            groups[dateKey] = {
                orders: [],
                totalProfit: globalDayStats.totalProfit || 0,
                dateLabel: order.delivered_at ? format(new Date(order.delivered_at), 'EEEE, MMMM d, yyyy') : 'Unknown Date',
                statsBySeller: globalDayStats.statsBySeller || {}
            }
        }
        groups[dateKey].orders.push(order)
        // No local accumulation. We use Pre-calculated Global Stats.

        return groups
    }, {})

    // Sort dates descending
    const sortedDateKeys = Object.keys(groupedOrders).sort((a, b) => {
        if (a === 'Unknown Date') return 1
        if (b === 'Unknown Date') return -1
        return b.localeCompare(a)
    })

    let globalIndex = 0

    // Always pass visible orders to Bulk Sync to allow re-syncing/fixing of any list
    const visibleOrderNumbers = orders.map((o: any) => o.order_number)

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950">
            {/* Header - Desktop Only */}
            <div className="hidden md:flex bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-4 flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profit Tracker</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Financial analysis of delivered orders | Total: {totalCount}
                        </p>
                    </div>

                    {/* Bulk Sync Button (Top Right) */}
                    <div>
                        <BulkSyncButton orderNumbers={visibleOrderNumbers} />
                    </div>
                </div>
            </div>

            {/* Mobile Actions Portal */}
            <div className="md:hidden">
                <MobileHeaderAction>
                    <BulkSyncButton orderNumbers={visibleOrderNumbers} />
                </MobileHeaderAction>
            </div>

            {/* Controls Bar: Tabs & Search - Sticky on Mobile */}
            <div className="sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 md:px-6 md:py-4 shadow-sm">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* Search Box */}
                    <form className="w-full md:flex-1 md:max-w-sm">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                name="search"
                                defaultValue={search}
                                type="text"
                                placeholder="Search Order / Invoice..."
                                className="w-full pl-9 h-9 text-sm rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            {/* Keep filters */}
                            <input type="hidden" name="syncStatus" value={syncStatus} />
                            <input type="hidden" name="limit" value={limit} />
                        </div>
                    </form>

                    {/* Status Tabs */}
                    <div className="flex w-full md:w-auto p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-x-auto no-scrollbar">
                        <Link
                            href={`?page=1&limit=${limit}&search=${search}&syncStatus=all`}
                            className={`flex-1 md:flex-none text-center px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${syncStatus === 'all'
                                ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            All
                        </Link>
                        <Link
                            href={`?page=1&limit=${limit}&search=${search}&syncStatus=synced`}
                            className={`flex-1 md:flex-none text-center px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${syncStatus === 'synced'
                                ? 'bg-white dark:bg-zinc-900 text-green-700 dark:text-green-400 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Synced
                        </Link>
                        <Link
                            href={`?page=1&limit=${limit}&search=${search}&syncStatus=not_synced`}
                            className={`flex-1 md:flex-none text-center px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${syncStatus === 'not_synced'
                                ? 'bg-white dark:bg-zinc-900 text-red-700 dark:text-red-400 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Not Synced
                        </Link>
                    </div>
                </div>
            </div>

            <div className="p-2 md:p-6 space-y-4">
                {/* Table */}
                <Card className="overflow-hidden border-none shadow-md bg-white dark:bg-zinc-900">
                    <div className="overflow-x-auto"> {/* Added wrapper for scroll */}
                        <Table className="min-w-[800px]"> {/* Ensure min-width for mobile scroll */}
                            <TableHeader className="bg-gray-50 dark:bg-zinc-800">
                                <TableRow>
                                    <TableHead className="w-16">S.N</TableHead>
                                    <TableHead className="w-[100px]">Sync Status</TableHead>
                                    <TableHead>Delivered At</TableHead>
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
                                {orders.length === 0 ? (
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
                                                            {/* Date Label - Positioned Absolute Left */}
                                                            <span className="absolute left-0 top-1 font-bold text-gray-700 dark:text-gray-200 text-sm whitespace-nowrap">
                                                                {group.dateLabel}
                                                            </span>

                                                            {/* Stats by Seller (Vertical Rows) - Centered Block, Left Aligned Items */}
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
                                                    <TableCell className="text-right font-bold py-3 pr-4 text-gray-900 dark:text-gray-100 align-top">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-xs text-gray-500 font-normal uppercase">Total Profit</span>
                                                            <span className={`${group.totalProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                Rs. {group.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell />
                                                </TableRow>

                                                {/* Group Rows */}
                                                {group.orders.map((order: any, i: number) => {
                                                    const currentRowIndex = globalIndex++
                                                    const isSynced = order.sync_status === 'synced'

                                                    return (
                                                        <TableRow key={order.order_primary_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                            <TableCell className="text-gray-500">
                                                                {((page - 1) * 50) + currentRowIndex + 1}
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
                                                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                                                        {order.delivered_at ? format(new Date(order.delivered_at), 'MM/dd/yyyy') : '-'}
                                                                    </span>
                                                                    <span className="text-xs text-gray-400">
                                                                        {order.delivered_at ? format(new Date(order.delivered_at), 'h:mm a') : ''}
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
                                                                /* Product Name with Tooltip */
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

                {/* Footer Controls: Limit - Pagination - Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 items-center py-4 gap-4 relative">
                    {/* Left: Limit Selector */}
                    <div className="justify-self-start">
                        <LimitSelector currentLimit={limit} />
                    </div>

                    {/* Center: Smart Pagination */}
                    <div className="justify-self-center flex items-center gap-1.5">
                        {/* Previous Button */}
                        <Link
                            href={page > 1 ? `?page=${page - 1}&limit=${limit}&search=${search}&syncStatus=${syncStatus}` : '#'}
                            className={`px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded transition-colors ${page > 1
                                ? 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                                : 'opacity-50 cursor-not-allowed pointer-events-none'
                                }`}
                            aria-disabled={page <= 1}
                        >
                            Previous
                        </Link>

                        {/* Page Numbers */}
                        {totalPages > 1 && Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                            .map((p, i, arr) => {
                                const showEllipsis = i > 0 && arr[i - 1] !== p - 1
                                return (
                                    <Fragment key={p}>
                                        {showEllipsis && (
                                            <span className="px-1 text-[13px] text-gray-400">...</span>
                                        )}
                                        <Link
                                            href={`?page=${p}&limit=${limit}&search=${search}&syncStatus=${syncStatus}`}
                                            className={`px-2 py-0.5 text-[13px] rounded transition-colors ${p === page
                                                ? 'bg-blue-600 text-white'
                                                : 'border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                                }`}
                                        >
                                            {p}
                                        </Link>
                                    </Fragment>
                                )
                            })
                        }

                        {/* Next Button */}
                        <Link
                            href={page < totalPages ? `?page=${page + 1}&limit=${limit}&search=${search}&syncStatus=${syncStatus}` : '#'}
                            className={`px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded transition-colors ${page < totalPages
                                ? 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                                : 'opacity-50 cursor-not-allowed pointer-events-none'
                                }`}
                            aria-disabled={page >= totalPages}
                        >
                            Next
                        </Link>
                    </div>

                    {/* Right: Info */}
                    <div className="justify-self-end text-sm text-gray-500">
                        Page {page} of {totalPages} ({totalCount} items)
                    </div>
                </div>
            </div>
        </div>
    )
}
