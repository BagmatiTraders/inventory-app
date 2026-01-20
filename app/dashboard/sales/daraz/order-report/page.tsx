'use server'

import { getProfitTrackerData, syncBulkOrderPurchaseCosts } from '@/features/sales/actions/report-actions'
import { format } from 'date-fns'
import Link from 'next/link'
import {
    Card,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Badge,
    Button
} from '@/components/ui-shim'
import { RefreshCw, ArrowLeft, Search } from 'lucide-react'
import { revalidatePath } from 'next/cache'

// Note: This is an async Server Component
export default async function DarazOrderReportPage({
    searchParams
}: {
    searchParams: { page?: string, search?: string, startDate?: string, endDate?: string }
}) {
    const page = Number(searchParams.page) || 1
    const search = searchParams.search || ''
    const startDate = searchParams.startDate
    const endDate = searchParams.endDate

    const { data: orders, totalCount, totalPages } = await getProfitTrackerData({
        page,
        limit: 50,
        search,
        startDate,
        endDate
    })

    // Inline Server Action for syncing
    async function handleSync(formData: FormData) {
        'use server'
        const result = await syncBulkOrderPurchaseCosts()
        // We can't use toast here directly in server component without libs, 
        // but revalidating will define UX. 
        revalidatePath('/dashboard/sales/daraz/order-report')
    }

    // Helper for pagination links
    const createPageLink = (p: number) => {
        const params = new URLSearchParams()
        if (p) params.set('page', p.toString())
        if (search) params.set('search', search)
        if (startDate) params.set('startDate', startDate)
        if (endDate) params.set('endDate', endDate)
        return `?${params.toString()}`
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/sales/daraz"
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Daraz Order Report</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Net Profit Analysis (Delivered Orders) | Total: {totalCount}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <form action={handleSync}>
                        <Button type="submit" variant="outline" size="sm" className="gap-2">
                            <RefreshCw size={14} />
                            Auto-Sync Missing Costs
                        </Button>
                    </form>
                </div>
            </div>

            {/* Filters & Content */}
            <div className="p-6 space-y-4">
                {/* Search / Filters Form */}
                {/* For interactivity in server component, we use a simple form with GET */}
                <form className="flex item-end gap-4 bg-white dark:bg-zinc-900 p-4 rounded-lg border dark:border-zinc-800 shadow-sm">
                    <div className="flex-1">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Search Order / Invoice</label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                name="search"
                                defaultValue={search}
                                placeholder="Order # or Invoice #"
                                className="w-full pl-9 h-9 text-sm rounded-md border border-gray-300 dark:border-zinc-700 bg-transparent"
                            />
                        </div>
                    </div>
                    <div className="w-40">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Start Date</label>
                        <input
                            name="startDate"
                            type="date"
                            defaultValue={startDate}
                            className="w-full h-9 text-sm rounded-md border border-gray-300 dark:border-zinc-700 bg-transparent px-2"
                        />
                    </div>
                    <div className="w-40">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">End Date</label>
                        <input
                            name="endDate"
                            type="date"
                            defaultValue={endDate}
                            className="w-full h-9 text-sm rounded-md border border-gray-300 dark:border-zinc-700 bg-transparent px-2"
                        />
                    </div>
                    <div className="flex items-end">
                        <Button type="submit">Filter</Button>
                    </div>
                </form>

                {/* Table */}
                <Card className="overflow-hidden border-none shadow-md bg-white dark:bg-zinc-900">
                    <Table>
                        <TableHeader className="bg-gray-50 dark:bg-zinc-800">
                            <TableRow>
                                <TableHead className="w-[180px]">Order Date</TableHead>
                                <TableHead className="w-[180px]">Order No. / Invoice</TableHead>
                                <TableHead>Seller Account</TableHead>
                                <TableHead className="w-[40%]">Items</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                                <TableHead className="text-right">Cost</TableHead>
                                <TableHead className="text-right">Profit</TableHead>
                                <TableHead className="text-center w-[80px]">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                                        No orders found matching criteria.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                orders.map((order) => {
                                    if (!order) return null

                                    const profit = order.profit || 0
                                    const isPositive = profit > 0

                                    return (
                                        <TableRow key={order.order_primary_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <TableCell className="align-top py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                                        {format(new Date(order.delivered_at || order.created_at), 'MM/dd/yyyy, h:mm:ss a')}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">{order.order_number}</span>
                                                    {order.invoice_number && (
                                                        <span className="text-xs text-gray-400">Inv: {order.invoice_number}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top py-4">
                                                <Badge variant="outline" className="font-normal">
                                                    {order.seller_account || 'N/A'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="align-top py-4">
                                                <div className="space-y-3">
                                                    {order.products?.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex flex-col gap-0.5 border-b border-gray-100 last:border-0 pb-2 last:pb-0 dark:border-zinc-800">
                                                            <div className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2" title={item.product_name}>
                                                                {item.product_name}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-blue-500 font-mono bg-blue-50 dark:bg-blue-900/20 px-1 rounded">
                                                                    ID: {item.product_id || 'N/A'}
                                                                </span>
                                                                {item.seller_sku && (
                                                                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                                                        {item.seller_sku}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                                                                <span>Cost: Rs. {item.purchase_price?.toLocaleString()}</span>
                                                                {item.purchase_price === 0 && (
                                                                    <span className="text-red-500 font-bold">(Missing!)</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(order.products?.length || 0) > 3 && (
                                                        <div className="text-xs text-gray-400 pl-1 italic">
                                                            +{(order.products?.length || 0) - 3} More
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top py-4 text-right">
                                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                                    {order.total_revenue?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top py-4 text-right">
                                                <div className="text-gray-600 dark:text-gray-400">
                                                    {order.total_purchase_cost?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top py-4 text-right">
                                                <div className={`font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} px-2 py-1 rounded bg-opacity-10 ${isPositive ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10'} inline-block`}>
                                                    Rs. {profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top py-4 text-center">
                                                <Link
                                                    href={`/dashboard/sales/daraz/order-report/${order.order_number}`}
                                                    className="text-sm text-blue-600 hover:underline"
                                                >
                                                    View
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </Card>

                {/* Pagination */}
                <div className="flex justify-between items-center text-sm text-gray-500">
                    <div>
                        Page {page} of {totalPages} ({totalCount} entries)
                    </div>
                    <div className="flex gap-2">
                        {page > 1 && (
                            <Link href={createPageLink(page - 1)}>
                                <Button variant="outline" size="sm" >Previous</Button>
                            </Link>
                        )}
                        {page < totalPages && (
                            <Link href={createPageLink(page + 1)}>
                                <Button variant="outline" size="sm" >Next</Button>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
