'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMarketplaceOrders, exportMarketplaceOrders, findRedirectTarget } from '@/features/sales/actions/marketplace-actions'
import { ArrowLeft, Download, Search, X, ArrowRightLeft } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { MarketplaceOrderForm } from '@/features/sales/components/MarketplaceOrderForm'
import { MarketplaceOrderDetailModal } from '@/features/sales/components/MarketplaceOrderDetailModal'
import { RedirectOrderModal } from '@/features/sales/components/RedirectOrderModal'
import { useSearchParams, useRouter } from 'next/navigation'
import { getActiveFiscalYear, getAllFiscalYears } from '@/features/sales/actions/daraz-actions'
import { toast } from 'sonner'

interface MarketplaceOrderListProps {
    isEmbedded?: boolean
}

export function MarketplaceOrderList({ isEmbedded = false }: MarketplaceOrderListProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const urlFiscalYearId = searchParams.get('fiscalYearId')

    const [activeFiscalYearId, setActiveFiscalYearId] = useState<string>('')
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('')
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')

    // State for actions
    const [viewingOrder, setViewingOrder] = useState<any>(null)
    const [editingOrder, setEditingOrder] = useState<any>(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)

    // Redirect State
    const [redirectSource, setRedirectSource] = useState<any>(null)
    const [redirectTarget, setRedirectTarget] = useState<any>(null)
    const [redirectCandidates, setRedirectCandidates] = useState<any[]>([])
    const [isRedirectModalOpen, setIsRedirectModalOpen] = useState(false)

    // Fetch active and all fiscal years
    const { data: fiscalYears, isLoading: loadingFYs } = useQuery({
        queryKey: ['fiscal-years'],
        queryFn: getAllFiscalYears,
    })

    useEffect(() => {
        // If URL param exists, respect it.
        if (urlFiscalYearId) {
            setSelectedFiscalYear(urlFiscalYearId)
            // Still fetch active to know it
            getActiveFiscalYear().then(fy => {
                if (fy) setActiveFiscalYearId(fy.id)
            })
        } else {
            // Otherwise default to active FY
            getActiveFiscalYear().then(fy => {
                if (fy) {
                    setActiveFiscalYearId(fy.id)
                    setSelectedFiscalYear(fy.id)
                }
            })
        }
    }, [urlFiscalYearId])

    const isFyReady = !!selectedFiscalYear;

    // Fetch orders
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['marketplace-orders-all', page, search, statusFilter, selectedFiscalYear],
        queryFn: () => getMarketplaceOrders({
            page,
            search,
            status: statusFilter,
            limit: 50,
            fiscalYearId: selectedFiscalYear
        }),
        enabled: isFyReady
    })

    const handleSearch = () => {
        setSearch(searchInput)
        setPage(1)
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setSearch('')
        setPage(1)
    }

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this order?')) {
            try {
                const { deleteMarketplaceOrder } = await import('@/features/sales/actions/marketplace-actions')
                await deleteMarketplaceOrder(id)
                alert('Delete successful')
                refetch()
            } catch (error: any) {
                alert(`Error deleting order: ${error.message}`)
            }
        }
    }

    const handleRedirectClick = async (order: any) => {
        if (order.order_status !== 'Pending') {
            toast.error('Only Pending orders can be redirected')
            return
        }

        const toastId = toast.loading('Searching for returning stock...')
        try {
            const result = await findRedirectTarget(order.id)

            if (!result) {
                toast.error('Cannot redirect: Order has no delivery branch', { id: toastId })
                return
            }

            const { recommended, candidates } = result

            setRedirectSource(order)
            setRedirectTarget(recommended)
            setRedirectCandidates(candidates || [])
            setIsRedirectModalOpen(true)

            if (recommended) {
                toast.success('Returning stock found!', { id: toastId })
            } else if (candidates && candidates.length > 0) {
                toast.info('No exact match found. Select from candidates.', { id: toastId })
            } else {
                toast.info('No returning orders found. Check branch/status.', { id: toastId })
            }
        } catch (error: any) {
            toast.error(`Error: ${error.message}`, { id: toastId })
        }
    }

    const handleExport = async () => {
        try {
            const exportData = await exportMarketplaceOrders({
                status: statusFilter,
                fiscalYearId: selectedFiscalYear
            })

            const headers = Object.keys(exportData[0] || {})
            const csvRows = [
                headers.join(','),
                ...exportData.map(row =>
                    headers.map(header => {
                        const value = row[header as keyof typeof row]
                        return typeof value === 'string' && (value.includes(',') || value.includes('"'))
                            ? `"${value.replace(/"/g, '""')}"`
                            : value
                    }).join(',')
                )
            ]

            const csvString = csvRows.join('\n')
            const blob = new Blob([csvString], { type: 'text/csv' })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `marketplace_orders_${new Date().toISOString().split('T')[0]}.csv`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)

            alert('Export successful')
        } catch (error: any) {
            alert(`Export error: ${error.message}`)
        }
    }

    const handleFiscalYearChange = (fyId: string) => {
        setSelectedFiscalYear(fyId);
        setPage(1);
        const newParams = new URLSearchParams(searchParams.toString());
        if (fyId) newParams.set('fiscalYearId', fyId);
        else newParams.delete('fiscalYearId');
        router.push(`?${newParams.toString()}`);
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header - Only if NOT embedded */}
            {!isEmbedded && (
                <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 flex items-center justify-between shadow-sm">
                    <div>
                        <h1 className="text-[17px] font-bold">Marketplace Order List</h1>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">View all marketplace orders</p>
                    </div>
                    <Link
                        href="/dashboard/sales/marketplace/sales-entry"
                        className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    >
                        <ArrowLeft size={12} />
                        Back to Sales Entry
                    </Link>
                </div>
            )}

            {/* Action Bar */}
            <div className={`sticky ${isEmbedded ? 'top-0' : 'top-[44px]'} z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm`}>
                <div className="flex flex-wrap items-center gap-1.5">
                    {/* Fiscal Year Selector */}
                    {urlFiscalYearId && (
                        <select
                            value={selectedFiscalYear}
                            onChange={(e) => handleFiscalYearChange(e.target.value)}
                            className="px-2 py-1 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                        >
                            {!fiscalYears ? (
                                <option>Loading FY...</option>
                            ) : (
                                fiscalYears.map(fy => (
                                    <option key={fy.id} value={fy.id}>
                                        FY {fy.name} {fy.is_active ? '(Active)' : ''}
                                    </option>
                                ))
                            )}
                        </select>
                    )}

                    {/* Search */}
                    <div className="flex-1 min-w-[200px] max-w-sm">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                            <input
                                type="text"
                                placeholder="Search orders, customer, phone..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full pl-6 pr-6 py-1 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                            />
                            {searchInput && (
                                <button
                                    onClick={handleClearSearch}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value)
                            setPage(1)
                        }}
                        className="px-2 py-1 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800"
                    >
                        <option value="all">All Status</option>
                        <option value="Pending">Pending</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Returning to Seller">Returning to Seller</option>
                        <option value="Fail Delivered">Fail Delivered</option>
                        <option value="Customer Return">Customer Return</option>
                        <option value="Return Delivered">Return Delivered</option>
                        <option value="Cancel">Cancel</option>
                        <option value="Redirected">Redirected</option>
                    </select>

                    {/* Export */}
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-1 px-2 py-1 text-sm border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors"
                    >
                        <Download size={12} />
                        Export
                    </button>
                </div>
            </div>

            {/* Orders Table */}
            <div className="flex-1 overflow-auto px-3 py-3">
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                <tr>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 w-10">S.N</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Date</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Sales ID</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Customer</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Phone</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Branch</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Products</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Total</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Status</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {!isFyReady ? (
                                    <tr>
                                        <td colSpan={10} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            Initializing Fiscal Year...
                                        </td>
                                    </tr>
                                ) : isLoading ? (
                                    <tr>
                                        <td colSpan={10} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            Loading orders for selected period...
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={10} className="px-2 py-8 text-center text-[15px] text-red-500">
                                            Error loading orders: {error.message}
                                        </td>
                                    </tr>
                                ) : !data || data.orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            No orders found for this Fiscal Year.
                                        </td>
                                    </tr>
                                ) : (
                                    data.orders.map((order: any, index: number) => (
                                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:shadow-lg hover:z-10 relative transition-all duration-200">
                                            <td className="px-2 py-1.5 text-[13px] text-gray-500">
                                                {(page - 1) * 50 + index + 1}
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px]">
                                                {new Date(order.order_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px] font-mono font-medium">
                                                <button
                                                    onClick={() => setViewingOrder(order)}
                                                    className="font-mono font-medium text-blue-600 hover:underline"
                                                >
                                                    {order.sales_id}
                                                </button>
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px]">
                                                {order.customer_name}
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px]">
                                                {order.phone_number}
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px]">
                                                {order.branch?.branch_name || '-'}
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px]">
                                                {order.items?.length || 0} item(s)
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px] font-medium">
                                                Rs {order.total_amount.toFixed(2)}
                                            </td>
                                            <td className="px-2 py-1.5">
                                                {order.order_status === 'Redirected' ? (
                                                    <span className="inline-flex px-1.5 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                                        Redirected
                                                    </span>
                                                ) : (
                                                    <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${order.order_status === 'Pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                                                        order.order_status === 'Shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                                                            order.order_status === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                                                order.order_status === 'Cancel' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                                                                    'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300'
                                                        }`}>
                                                        {order.order_status}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <div className="flex items-center justify-end gap-1">
                                                    {order.order_status === 'Pending' && (
                                                        <button
                                                            onClick={() => handleRedirectClick(order)}
                                                            className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-transparent hover:border-blue-200"
                                                            title="Redirect Order"
                                                        >
                                                            <ArrowRightLeft size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setEditingOrder(order)
                                                            setIsEditModalOpen(true)
                                                        }}
                                                        className="px-2 py-0.5 text-[13px] text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleDelete(order.id).then(() => refetch())
                                                        }}
                                                        className="px-2 py-0.5 text-[13px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {data && data.totalPages > 1 && (
                        <div className="border-t dark:border-zinc-800 px-3 py-2">
                            <div className="flex items-center justify-center gap-1.5">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-2 py-1 text-sm border dark:border-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Previous
                                </button>
                                <span className="text-sm px-3">
                                    Page {page} of {data.totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                                    disabled={page === data.totalPages}
                                    className="px-2 py-1 text-sm border dark:border-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && editingOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
                        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
                            <h2 className="text-lg font-bold">Edit Order</h2>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4">
                            <MarketplaceOrderForm
                                initialData={editingOrder}
                                onSuccess={() => {
                                    setIsEditModalOpen(false)
                                    refetch()
                                }}
                                onCancel={() => setIsEditModalOpen(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {viewingOrder && (
                <MarketplaceOrderDetailModal
                    order={viewingOrder}
                    onClose={() => setViewingOrder(null)}
                />
            )}

            {/* Redirect Modal */}
            {isRedirectModalOpen && redirectSource && (
                <RedirectOrderModal
                    sourceOrder={redirectSource}
                    initialTargetOrder={redirectTarget}
                    candidates={redirectCandidates}
                    onClose={() => setIsRedirectModalOpen(false)}
                    onSuccess={() => {
                        setIsRedirectModalOpen(false)
                        refetch()
                    }}
                />
            )}
        </div>
    )
}
