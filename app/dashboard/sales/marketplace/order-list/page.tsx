'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMarketplaceOrders, exportMarketplaceOrders } from '@/features/sales/actions/marketplace-actions'
import { ArrowLeft, Download, Search, X } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'

export default function MarketplaceOrderListPage() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')

    // Fetch ALL orders (no date filtering)
    const { data, isLoading, error } = useQuery({
        queryKey: ['marketplace-orders-all', page, search, statusFilter],
        queryFn: () => getMarketplaceOrders({
            page,
            search,
            status: statusFilter,
            limit: 50
        })
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

    const handleExport = async () => {
        try {
            const exportData = await exportMarketplaceOrders({ status: statusFilter })

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
            link.download = `marketplace_all_orders_${new Date().toISOString().split('T')[0]}.csv`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)

            alert('Orders exported successfully!')
        } catch (error: any) {
            alert(`Export error: ${error.message}`)
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
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

            {/* Action Bar */}
            <div className="sticky top-[44px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5">
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
                        <option value="Fail Delivered">Fail Delivered</option>
                        <option value="Cancel">Cancel</option>
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
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={10} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            Loading orders...
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
                                            No orders found.
                                        </td>
                                    </tr>
                                ) : (
                                    data.orders.map((order, index) => (
                                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:shadow-lg hover:z-10 relative transition-all duration-200">
                                            <td className="px-2 py-1.5 text-[13px] text-gray-500">
                                                {(page - 1) * 50 + index + 1}
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px]">
                                                {new Date(order.order_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px] font-mono font-medium">
                                                {order.sales_id}
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
                                                <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${order.order_status === 'Pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                                                        order.order_status === 'Shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                                                            order.order_status === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                                                order.order_status === 'Cancel' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                                                                    'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300'
                                                    }`}>
                                                    {order.order_status}
                                                </span>
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button className="px-2 py-0.5 text-[13px] text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded">
                                                        View
                                                    </button>
                                                    <button className="px-2 py-0.5 text-[13px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
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
        </div>
    )
}
