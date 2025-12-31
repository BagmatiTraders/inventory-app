'use client'

import { X } from 'lucide-react'
import { MarketplaceOrder } from '@/features/sales/actions/marketplace-actions'

interface MarketplaceOrderDetailModalProps {
    order: MarketplaceOrder & { items: any[], created_user?: any, updated_user?: any }
    onClose: () => void
}

export function MarketplaceOrderDetailModal({ order, onClose }: MarketplaceOrderDetailModalProps) {
    if (!order) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold">Order Details</h2>
                        <p className="text-sm text-gray-500">Sales ID: <span className="font-mono text-gray-900 dark:text-gray-100">{order.sales_id}</span></p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded text-gray-500"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status Badge */}
                    <div className="flex justify-between items-start">
                        <div>
                            <span className={`inline-flex px-2.5 py-1 text-sm font-medium rounded-full ${order.order_status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                order.order_status === 'Shipped' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                    order.order_status === 'Delivered' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                        order.order_status === 'Cancel' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                            'bg-gray-100 text-gray-800'
                                }`}>
                                {order.order_status}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                                Ordered on {new Date(order.order_date).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                            <p>Created by: {order.created_user?.full_name || 'Unknown'}</p>
                            {order.updated_user && <p>Last updated by: {order.updated_user.full_name}</p>}
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border dark:border-zinc-800">
                        <div>
                            <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">Customer Details</h3>
                            <div className="space-y-1 text-sm">
                                <p><span className="font-medium">Name:</span> {order.customer_name}</p>
                                <p><span className="font-medium">Phone:</span> {order.phone_number}</p>
                                <p><span className="font-medium">Address:</span> {order.address || '-'}</p>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">Delivery Details</h3>
                            <div className="space-y-1 text-sm">
                                <p><span className="font-medium">Branch:</span> {(order as any).branch?.branch_name || '-'}</p>
                                <p><span className="font-medium">Branch Charge:</span> Rs {order.branch_charge}</p>
                                <p><span className="font-medium">Delivery Charge:</span> Rs {order.delivery_charge}</p>
                            </div>
                        </div>
                    </div>

                    {/* Order Items */}
                    <div>
                        <h3 className="text-sm font-bold mb-3 border-b pb-2 dark:border-zinc-800">Order Items</h3>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-800 text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-3 py-2">Product</th>
                                    <th className="px-3 py-2 text-center">Qty</th>
                                    <th className="px-3 py-2 text-right">Price</th>
                                    <th className="px-3 py-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-zinc-800">
                                {order.items?.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="px-3 py-2">{item.product_name}</td>
                                        <td className="px-3 py-2 text-center">{item.quantity}</td>
                                        <td className="px-3 py-2 text-right">Rs {item.amount}</td>
                                        <td className="px-3 py-2 text-right font-medium">Rs {(item.quantity * item.amount).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-gray-200 dark:border-zinc-700">
                                <tr>
                                    <td colSpan={3} className="px-3 py-2 text-right font-bold">Subtotal</td>
                                    <td className="px-3 py-2 text-right font-bold">
                                        Rs {order.items?.reduce((sum, item) => sum + (item.quantity * item.amount), 0).toFixed(2)}
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={3} className="px-3 py-2 text-right text-gray-500">Delivery Charge</td>
                                    <td className="px-3 py-2 text-right text-gray-500">
                                        + Rs {order.delivery_charge.toFixed(2)}
                                    </td>
                                </tr>
                                <tr className="text-lg">
                                    <td colSpan={3} className="px-3 py-2 text-right font-bold">Grand Total</td>
                                    <td className="px-3 py-2 text-right font-bold text-blue-600">
                                        Rs {order.total_amount.toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Remarks */}
                    {order.remarks && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded border border-yellow-200 dark:border-yellow-800/30">
                            <h4 className="text-xs font-bold text-yellow-700 dark:text-yellow-500 uppercase mb-1">Remarks</h4>
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">{order.remarks}</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t dark:border-zinc-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded text-sm font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
