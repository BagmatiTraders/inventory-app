'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMarketplaceOrders } from '@/features/sales/actions/marketplace-actions'
import { Search, X, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui-shim'
import { MarketplaceOrderDetailModal } from '@/features/sales/components/MarketplaceOrderDetailModal'
import { MarketplaceOrderForm } from '@/features/sales/components/MarketplaceOrderForm'

export default function MessengerOrdersPage() {
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [viewingOrder, setViewingOrder] = useState<any>(null)
    const [editingOrder, setEditingOrder] = useState<any>(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)

    // Fetch Messenger orders
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['messenger-orders', search],
        queryFn: () => getMarketplaceOrders({
            search,
            userType: 'Messenger',
            limit: 100
        })
    })

    const handleSearch = () => {
        setSearch(searchInput)
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setSearch('')
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-sm flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-blue-600">Messenger Orders</h1>
                    <p className="text-sm text-gray-500">Orders synced from Messenger App</p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-600"
                    title="Refresh"
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Action Bar */}
            <div className="z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-2 shadow-sm">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search orders..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="w-full pl-10 pr-10 py-2 text-sm border dark:border-zinc-700 rounded-md focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800"
                    />
                    {searchInput && (
                        <button
                            onClick={handleClearSearch}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Orders List */}
            <div className="flex-1 overflow-auto p-4">
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600">Date</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600">Order ID</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600">Customer</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600">Products</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600">Total</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600">Status</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {isLoading ? (
                                    <tr><td colSpan={7} className="text-center py-8 text-gray-500">Loading...</td></tr>
                                ) : error ? (
                                    <tr><td colSpan={7} className="text-center py-8 text-red-500">Error: {(error as any).message}</td></tr>
                                ) : !data || data.orders.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-8 text-gray-500">No Messenger orders found</td></tr>
                                ) : (
                                    data.orders.map((order: any) => (
                                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-4 py-3 text-sm">{new Date(order.order_date).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-sm font-mono">{order.sales_id}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="font-medium">{order.customer_name}</div>
                                                <div className="text-xs text-gray-500">{order.phone_number}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div>
                                                    <div className="font-medium">{order.items?.[0]?.product_name}</div>
                                                    <div className="text-xs text-gray-500">ID: {order.items?.[0]?.product_id}</div>
                                                    {order.items?.length > 1 && <div className="text-xs text-gray-500 mt-1">+{order.items.length - 1} more items</div>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium">Rs {order.total_amount.toFixed(2)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${order.order_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {order.order_status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => setViewingOrder(order)}
                                                    className="text-blue-600 hover:underline text-sm mr-3"
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingOrder(order)
                                                        setIsEditModalOpen(true)
                                                    }}
                                                    className="text-gray-600 hover:underline text-sm"
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* View Modal */}
            {viewingOrder && (
                <MarketplaceOrderDetailModal
                    order={viewingOrder}
                    onClose={() => setViewingOrder(null)}
                />
            )}

            {/* Edit Modal (Reuse existing form) */}
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
        </div>
    )
}
