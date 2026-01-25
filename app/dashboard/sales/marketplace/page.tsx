'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMarketplaceOrders, exportMarketplaceOrders } from '@/features/sales/actions/marketplace-actions'
import { getMarketplaceRedirectNotifications } from '@/features/sales/actions/marketplace-notification-actions'
import { getActiveFiscalYear } from '@/features/sales/actions/daraz-actions'
import { ArrowLeft, Plus, Upload, Download, Search, X, List } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { MarketplaceOrderForm } from '@/features/sales/components/MarketplaceOrderForm'
import { MarketplaceOrderDetailModal } from '@/features/sales/components/MarketplaceOrderDetailModal'
import { ImportMarketplaceOrdersModal } from '@/features/sales/components/ImportMarketplaceOrdersModal'
import { MarketplaceNotificationBell } from '@/features/sales/components/MarketplaceNotificationBell'

export default function MarketplaceSalesEntryPage() {
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [activeFiscalYearId, setActiveFiscalYearId] = useState<string | null>(null)
    const [checkingFy, setCheckingFy] = useState(true)

    // New state for actions
    const [viewingOrder, setViewingOrder] = useState<any>(null)
    const [editingOrder, setEditingOrder] = useState<any>(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)

    // Fetch active fiscal year on mount
    useEffect(() => {
        setCheckingFy(true)
        getActiveFiscalYear().then(fy => {
            if (fy) setActiveFiscalYearId(fy.id)
            else setActiveFiscalYearId('') // No active FY found
        }).finally(() => {
            setCheckingFy(false)
        })
    }, [])

    // Fetch orders
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['marketplace-orders-filtered', search, activeFiscalYearId],
        queryFn: () => getMarketplaceOrders({
            search,
            showTodayAndPending: true,
            limit: 500,
            fiscalYearId: activeFiscalYearId || undefined
        }),
        enabled: !!activeFiscalYearId
    })

    // Fetch Redirect Notifications for RDR tags
    const { data: redirectNotifications } = useQuery({
        queryKey: ['marketplace-redirect-notifications'],
        queryFn: getMarketplaceRedirectNotifications,
        staleTime: 30000,
    })

    const handleSearch = () => {
        setSearch(searchInput)
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setSearch('')
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

    const handleExport = async () => {
        try {
            const exportData = await exportMarketplaceOrders({ showTodayAndPending: true })

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

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Compact Header */}
            <div className="z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Left: Title Group & Mobile Notification */}
                    <div className="flex items-center gap-2">
                        {/* Mobile Notification (Left Aligned) */}
                        <div className="md:hidden">
                            <MarketplaceNotificationBell align="left" />
                        </div>

                        {/* Desktop Title */}
                        <div className="hidden md:block">
                            <h1 className="text-[18px] font-bold">Marketplace Sales</h1>
                            <p className="text-[14px] text-gray-500 dark:text-gray-400">Sales Entry</p>
                        </div>
                    </div>

                    {/* Right: Actions Group (Import/Export + Back) */}
                    <div className="flex items-center gap-2">
                        {/* Desktop Notification (Right Aligned) */}
                        <div className="hidden md:block">
                            <MarketplaceNotificationBell align="right" />
                        </div>
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1 text-[15px] border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors dark:text-gray-50 whitespace-nowrap hidden md:flex"
                        >
                            <Upload size={11} />
                            Import
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-3 py-1 text-[15px] border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors dark:text-gray-50 whitespace-nowrap hidden md:flex"
                        >
                            <Download size={11} />
                            Export
                        </button>

                        <Link
                            href="/dashboard/sales"
                            className="flex items-center gap-1 px-2 py-1 text-[15px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors whitespace-nowrap hidden md:flex"
                        >
                            <ArrowLeft size={11} />
                            Back to Sales
                        </Link>
                    </div>
                </div>
            </div>

            {/* Compact Action Bar */}
            <div className="z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5">

                    {/* Search Box */}
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={11} />
                        <input
                            type="text"
                            placeholder="Search orders..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full pl-6 pr-6 py-1 text-[15px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                        />
                        {searchInput && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                title="Clear search"
                            >
                                <X size={10} />
                            </button>
                        )}
                    </div>

                    {/* Action Buttons - Desktop */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="items-center gap-1 px-2 py-1 text-[15px] bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors whitespace-nowrap hidden md:flex"
                    >
                        <Plus size={11} />
                        Add
                    </button>

                    {/* Right Aligned Navigation Group - Desktop */}
                    <div className="ml-auto flex items-center gap-2">
                        <Link
                            href="/dashboard/sales/marketplace/dashboard"
                            className="items-center gap-1 px-2 py-1 text-[15px] bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors whitespace-nowrap hidden md:flex"
                        >
                            <List size={11} />
                            Sales Dashboard
                        </Link>

                    </div>
                </div>
            </div>

            {/* Orders Table / Mobile List */}
            <div className="flex-1 overflow-auto px-2 md:px-3 py-2 md:py-3 pb-24 md:pb-3">

                {/* Mobile Card List */}
                <div className="md:hidden space-y-3">
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading...</div>
                    ) : !data || data.orders.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No orders found.</div>
                    ) : (
                        data.orders.map((order: any) => (
                            <div key={order.id} className="bg-white dark:bg-zinc-900 p-3 rounded-lg border dark:border-zinc-800 shadow-sm relative" onClick={() => setViewingOrder(order)}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm text-blue-600">#{order.sales_id}</span>
                                        <span className="text-[11px] text-gray-500">{new Date(order.order_date).toLocaleDateString()}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${order.order_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {order.order_status}
                                    </span>
                                </div>
                                <div className="mb-2">
                                    <div className="font-medium text-sm text-gray-800 dark:text-gray-200">{order.customer_name}</div>
                                    <div className="text-xs text-gray-500">{order.items?.[0]?.product_name} {order.items?.length > 1 && `+${order.items.length - 1}`}</div>
                                </div>
                                <div className="flex justify-between items-center border-t dark:border-zinc-800 pt-2 mt-2">
                                    <span className="font-bold text-sm">Rs {order.total_amount.toFixed(2)}</span>
                                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => { setEditingOrder(order); setIsEditModalOpen(true); }} className="text-blue-600 text-xs px-2 py-1 bg-blue-50 rounded">Edit</button>
                                        <button onClick={() => handleDelete(order.id)} className="text-red-600 text-xs px-2 py-1 bg-red-50 rounded">Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop Table */}
                <Card className="overflow-hidden hidden md:block">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                <tr>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 w-10">S.N</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Date</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Sales ID</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Customer</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Phone</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 min-w-[250px]">Products</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Total</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Status</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Courier</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {checkingFy ? (
                                    <tr>
                                        <td colSpan={10} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            Checking Active Fiscal Year...
                                        </td>
                                    </tr>
                                ) : !activeFiscalYearId ? (
                                    <tr>
                                        <td colSpan={10} className="px-2 py-8 text-center text-[15px] text-orange-500">
                                            No Active Fiscal Year Configured. Please set one in Settings.
                                        </td>
                                    </tr>
                                ) : isLoading ? (
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
                                            No orders found for today or pending in Active FY.
                                        </td>
                                    </tr>
                                ) : (
                                    data.orders.map((order: any, index: number) => (
                                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:shadow-lg hover:z-10 relative transition-all duration-200">
                                            <td className="px-2 py-1.5 text-[13px] text-gray-500">
                                                {index + 1}
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
                                                <div className="flex flex-col cursor-pointer hover:text-blue-600"
                                                    onClick={() => setViewingOrder(order)}>
                                                    <span className="font-medium break-words whitespace-normal" title={order.items?.[0]?.product_name}>
                                                        {order.items?.[0]?.product_name || '-'}
                                                    </span>
                                                    {order.items && order.items.length > 1 && (
                                                        <span className="text-[11px] text-blue-600 font-medium">
                                                            + {order.items.length - 1} Items
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px] font-medium">
                                                Rs {order.total_amount.toFixed(2)}
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <div className="flex flex-col items-start gap-1">
                                                    <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${order.order_status === 'Pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                                                        order.order_status === 'Shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                                                            order.order_status === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                                                order.order_status === 'Cancel' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                                                                    'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300'
                                                        }`}>
                                                        {order.order_status}
                                                    </span>

                                                    {/* RDR Tag for Pending orders with Redirect opportunity */}
                                                    {order.order_status === 'Pending' && redirectNotifications?.some((n: any) => n.pendingOrder.id === order.id) && (
                                                        <span className="text-[10px] font-bold text-green-600 dark:text-green-400 px-1">
                                                            RDR
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px] text-gray-600 dark:text-gray-300">
                                                {order.courier?.courier_name || '-'}
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <div className="flex items-center justify-end gap-1">
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
                                                        onClick={() => handleDelete(order.id)}
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
                </Card>
            </div>

            {/* Mobile Footer Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-40 h-16 flex items-center justify-around pb-safe">
                <div className="flex flex-col items-center justify-center w-full h-full text-blue-600 dark:text-blue-400">
                    <List size={20} />
                    <span className="text-[10px] font-medium mt-1">Sales Entry</span>
                </div>
                <Link href="/dashboard/sales/marketplace/dashboard" className="flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-gray-900 dark:hover:text-gray-300">
                    <List size={20} />
                    <span className="text-[10px] font-medium mt-1">Dashboard</span>
                </Link>
            </div>

            {/* Mobile FAB Add Button */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="md:hidden fixed bottom-20 right-4 h-12 w-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center z-50 active:scale-95 transition-transform"
            >
                <Plus size={24} />
            </button>

            {/* Add Order Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
                        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
                            <h2 className="text-lg font-bold">Add Marketplace Order</h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4">
                            <MarketplaceOrderForm
                                onSuccess={() => {
                                    setIsModalOpen(false)
                                    refetch()
                                }}
                                onCancel={() => setIsModalOpen(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

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

            {/* Import Modal */}
            <ImportMarketplaceOrdersModal
                isOpen={isImportModalOpen}
                onClose={() => {
                    setIsImportModalOpen(false)
                    refetch()
                }}
            />

            {/* View Modal */}
            {viewingOrder && (
                <MarketplaceOrderDetailModal
                    order={viewingOrder}
                    onClose={() => setViewingOrder(null)}
                />
            )}
        </div>
    )
}
