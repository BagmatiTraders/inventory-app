'use client'

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getDarazOrderById } from '@/features/sales/actions/daraz-actions'
import { ArrowLeft, Edit, Calendar, Printer } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { EditDarazOrderModal } from '@/features/sales/components/EditDarazOrderModal'
// DarazInvoice removed


export default function DarazOrderViewPage() {
    const params = useParams()
    const router = useRouter()
    const orderId = params.orderId as string
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)


    const { data: order, isLoading } = useQuery({
        queryKey: ['daraz-order', orderId],
        queryFn: () => getDarazOrderById(orderId),
        enabled: !!orderId,
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000
    })

    const formatTimestamp = (timestamp: string | null, userName: string | null, userEmail: string | null) => {
        if (!timestamp) return null
        // If no user is associated, it's likely from the auto-sync process
        return `${new Date(timestamp).toLocaleString()} by ${userName || userEmail || 'Daraz sync'}`
    }

    const searchParams = useSearchParams()
    const fromPage = searchParams.get('from')
    const backLink = fromPage === 'status-sync'
        ? '/dashboard/sales/daraz/status-sync'
        : fromPage === 'order-list'
            ? '/dashboard/sales/daraz/dashboard'
            : '/dashboard/sales/daraz/sales-entry'

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href={backLink}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold">Order Details</h1>
                            {order && <p className="text-sm text-gray-500">{order.invoice_number}</p>}
                        </div>
                    </div>
                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                        <Edit size={16} />
                        Edit Order
                    </button>
                    <button
                        onClick={() => window.open(`/print/daraz-invoice/${orderId}`, '_blank')}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                    >
                        <Printer size={16} />
                        Print Invoice
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                {isLoading ? (
                    <Card className="p-8 text-center text-gray-500">Loading...</Card>
                ) : order ? (
                    <div className="space-y-6">
                        {/* Order Information Card */}
                        <Card className="p-6">
                            <h2 className="text-lg font-semibold mb-4">Order Information</h2>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Invoice Number</p>
                                    <p className="font-medium">{order.invoice_number}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Order Number</p>
                                    <p className="font-medium">{order.order_number}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Tracking Number</p>
                                    <p className="font-medium">{order.tracking_number}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Order Date</p>
                                    <p className="font-medium">{new Date(order.order_date).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </Card>

                        {/* Customer & Status Card */}
                        <Card className="p-6">
                            <h2 className="text-lg font-semibold mb-4">Customer & Status</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Customer Name</p>
                                    <p className="font-medium">{order.customer_name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Order Date</p>
                                    <p className="font-medium">
                                        {new Date(order.daraz_created_at || order.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Status</p>
                                    <span className={`inline-block px-3 py-1 text-sm font-medium rounded ${order.order_status === 'Pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' :
                                        order.order_status === 'Shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' :
                                            order.order_status === 'Delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' :
                                                'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                                        }`}>
                                        {order.order_status}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Remarks</p>
                                    <p className="font-medium">{order.remarks || '-'}</p>
                                </div>
                            </div>
                        </Card>

                        {/* Order Items Card */}
                        <Card className="p-6">
                            <h2 className="text-lg font-semibold mb-4">Order Items</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-zinc-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 dark:text-gray-100">#</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 dark:text-gray-100">Seller SKU</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 dark:text-gray-100">Product Name</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 dark:text-gray-100">Seller Account</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 dark:text-gray-100">Qty</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 dark:text-gray-100">Amount</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 dark:text-gray-100">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-zinc-700">
                                        {order.items?.map((item: any, idx: number) => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-3 text-sm">{idx + 1}</td>
                                                <td className="px-4 py-3 text-sm font-mono">{item.seller_sku}</td>
                                                <td className="px-4 py-3 text-sm">{item.product_name}</td>
                                                <td className="px-4 py-3 text-sm">{item.seller_account}</td>
                                                <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                                                <td className="px-4 py-3 text-sm text-right">Rs. {item.amount.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-sm text-right font-medium">Rs. {item.total_amount.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 dark:bg-zinc-800">
                                        <tr>
                                            <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-right">Total:</td>
                                            <td className="px-4 py-3 text-sm font-semibold text-right">{order.total_quantity}</td>
                                            <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-right">Rs. {order.grand_total?.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </Card>

                        {/* Audit Trail Card */}
                        <Card className="p-6">
                            <h2 className="text-lg font-semibold mb-4">Audit Trail</h2>
                            <div className="space-y-3">
                                {order.created_at && (
                                    <div className="flex items-start gap-3">
                                        <Calendar size={16} className="mt-0.5 text-gray-400" />
                                        <div className="text-sm">
                                            <span className="font-medium">Created: </span>
                                            {formatTimestamp(order.created_at, order.created_by_name, order.created_by_email)}
                                            {order.import_source === 'csv' && <span className="text-gray-500 ml-1">import csv</span>}
                                        </div>
                                    </div>
                                )}

                                {order.edited_at && (
                                    <div className="flex items-start gap-3">
                                        <Calendar size={16} className="mt-0.5 text-gray-400" />
                                        <div className="text-sm">
                                            <span className="font-medium">Edited: </span>
                                            {formatTimestamp(order.edited_at, order.edited_by_name, order.edited_by_email)}
                                        </div>
                                    </div>
                                )}

                                {order.shipped_at && (
                                    <div className="flex items-start gap-3">
                                        <Calendar size={16} className="mt-0.5 text-blue-400" />
                                        <div className="text-sm">
                                            <span className="font-medium text-blue-600">Shipped: </span>
                                            {formatTimestamp(order.shipped_at, order.shipped_by_name, order.shipped_by_email)}
                                        </div>
                                    </div>
                                )}

                                {order.delivered_at && (
                                    <div className="flex items-start gap-3">
                                        <Calendar size={16} className="mt-0.5 text-green-400" />
                                        <div className="text-sm">
                                            <span className="font-medium text-green-600">Delivered: </span>
                                            {formatTimestamp(order.delivered_at, order.delivered_by_name, order.delivered_by_email)}
                                        </div>
                                    </div>
                                )}

                                {order.delivery_failed_at && (
                                    <div className="flex items-start gap-3">
                                        <Calendar size={16} className="mt-0.5 text-red-400" />
                                        <div className="text-sm">
                                            <span className="font-medium text-red-600">Delivery Failed: </span>
                                            {formatTimestamp(order.delivery_failed_at, order.delivery_failed_by_name, order.delivery_failed_by_email)}
                                        </div>
                                    </div>
                                )}

                                {order.failed_delivered_at && (
                                    <div className="flex items-start gap-3">
                                        <Calendar size={16} className="mt-0.5 text-red-400" />
                                        <div className="text-sm">
                                            <span className="font-medium text-red-600">Failed Delivered: </span>
                                            {formatTimestamp(order.failed_delivered_at, order.fail_delivered_by_name, order.fail_delivered_by_email)}
                                        </div>
                                    </div>
                                )}

                                {order.returning_to_seller_at && (
                                    <div className="flex items-start gap-3">
                                        <Calendar size={16} className="mt-0.5 text-orange-400" />
                                        <div className="text-sm">
                                            <span className="font-medium text-orange-600">Returning to Seller: </span>
                                            {formatTimestamp(order.returning_to_seller_at, order.returning_to_seller_by_name, order.returning_to_seller_by_email)}
                                        </div>
                                    </div>
                                )}

                                {order.customer_return_at && (
                                    <div className="flex items-start gap-3">
                                        <Calendar size={16} className="mt-0.5 text-purple-400" />
                                        <div className="text-sm">
                                            <span className="font-medium text-purple-600">Customer Return: </span>
                                            {formatTimestamp(order.customer_return_at, order.customer_return_by_name, order.customer_return_by_email)}
                                        </div>
                                    </div>
                                )}

                                {order.customer_return_delivered_at && (
                                    <div className="flex items-start gap-3">
                                        <Calendar size={16} className="mt-0.5 text-purple-400" />
                                        <div className="text-sm">
                                            <span className="font-medium text-purple-600">Customer Return Delivered: </span>
                                            {formatTimestamp(order.customer_return_delivered_at, order.customer_return_delivered_by_name, order.customer_return_delivered_by_email)}
                                        </div>
                                    </div>
                                )}

                                {order.customer_returned_at && (
                                    <div className="flex items-start gap-3">
                                        <Calendar size={16} className="mt-0.5 text-orange-400" />
                                        <div className="text-sm">
                                            <span className="font-medium text-orange-600">Customer Returned: </span>
                                            {formatTimestamp(order.customer_returned_at, order.customer_returned_by_name, order.customer_returned_by_email)}
                                        </div>
                                    </div>
                                )}

                                {order.cancelled_at && (
                                    <div className="flex items-start gap-3">
                                        <Calendar size={16} className="mt-0.5 text-gray-400" />
                                        <div className="text-sm">
                                            <span className="font-medium text-gray-600">Cancelled: </span>
                                            {formatTimestamp(order.cancelled_at, order.cancelled_by_name, order.cancelled_by_email)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                ) : (
                    <Card className="p-8 text-center text-gray-500">Order not found</Card>
                )}
            </div>

            {/* Edit Modal */}
            {
                order && (
                    <EditDarazOrderModal
                        isOpen={isEditModalOpen}
                        onClose={() => setIsEditModalOpen(false)}
                        orderId={orderId}
                        orderData={order}
                    />
                )
            }

        </div>
    )
}
