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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-4 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-bold">Order Details</h2>
                        <p className="text-sm text-gray-500">Sales ID: <span className="font-mono text-gray-900 dark:text-gray-100 font-medium">{order.sales_id}</span></p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${order.order_status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            order.order_status === 'Confirmed' || order.order_status === 'Confirmed Order' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' :
                                order.order_status === 'Shipped' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                    order.order_status === 'Delivered' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                        order.order_status === 'Cancel' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                            'bg-gray-100 text-gray-800'
                            }`}>
                            {order.order_status}
                        </span>

                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded text-gray-500 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-zinc-950">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* LEFT COLUMN - Main Info */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* Customer & Delivery Card */}
                            <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 overflow-hidden shadow-sm">
                                <div className="px-4 py-3 border-b dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Customer & Delivery</h3>
                                </div>
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="text-xs font-bold uppercase text-gray-500 mb-3">Customer Details</h4>
                                        <div className="space-y-2 text-sm">
                                            <div>
                                                <span className="block text-xs text-gray-500">Name</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">{order.customer_name}</span>
                                            </div>
                                            <div>
                                                <span className="block text-xs text-gray-500">Phone</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">{order.phone_number}</span>
                                            </div>
                                            {order.alternative_phone && (
                                                <div>
                                                    <span className="block text-xs text-gray-500">Alternative Phone</span>
                                                    <span className="font-medium text-gray-900 dark:text-gray-100">{order.alternative_phone}</span>
                                                </div>
                                            )}
                                            <div>
                                                <span className="block text-xs text-gray-500">Address</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">{order.address || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold uppercase text-gray-500 mb-3">Delivery Details</h4>
                                        <div className="space-y-2 text-sm">
                                            <div>
                                                <span className="block text-xs text-gray-500">Courier Provider</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">{order.courier_provider || '-'}</span>
                                            </div>
                                            <div>
                                                <span className="block text-xs text-gray-500">Branch</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                                    {order.courier_provider === 'pathao' 
                                                        ? (order.city || '-') 
                                                        : (order.delivery_branch || (order as any).branch?.branch_name || '-')
                                                    }
                                                </span>
                                            </div>
                                            <div className="flex gap-4">
                                                <div>
                                                    <span className="block text-xs text-gray-500">Branch Charge</span>
                                                    <span className="font-medium text-gray-900 dark:text-gray-100">Rs {order.branch_charge}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-xs text-gray-500">Delivery Charge</span>
                                                    <span className="font-medium text-gray-900 dark:text-gray-100">Rs {order.delivery_charge}</span>
                                                </div>
                                            </div>
                                            {order.courier_consignment_id && (
                                                <div>
                                                    <span className="block text-xs text-gray-500">Consignment ID</span>
                                                    <span className="font-medium text-gray-900 dark:text-gray-100 font-mono">{order.courier_consignment_id}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Order Items Card */}
                            <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 overflow-hidden shadow-sm">
                                <div className="px-4 py-3 border-b dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Order Items</h3>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 dark:bg-zinc-800/50 text-xs uppercase text-gray-500">
                                            <tr>
                                                <th className="px-4 py-2">Product</th>
                                                <th className="px-4 py-2 text-center">Qty</th>
                                                <th className="px-4 py-2 text-right">Price</th>
                                                <th className="px-4 py-2 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-zinc-800">
                                            {order.items?.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-900 dark:text-gray-100">{item.product_name}</div>
                                                        <div className="text-xs text-gray-500">ID: {item.product_id}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">{item.quantity}</td>
                                                    <td className="px-4 py-3 text-right">Rs {item.amount}</td>
                                                    <td className="px-4 py-3 text-right font-medium">Rs {(item.quantity * item.amount).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50/50 dark:bg-zinc-800/20 border-t dark:border-zinc-800">
                                            <tr>
                                                <td colSpan={3} className="px-4 py-2 text-right text-gray-500 text-xs uppercase font-medium">Subtotal</td>
                                                <td className="px-4 py-2 text-right font-medium">Rs {order.items?.reduce((sum, item) => sum + (item.quantity * item.amount), 0).toFixed(2)}</td>
                                            </tr>
                                            <tr>
                                                <td colSpan={3} className="px-4 py-2 text-right text-gray-500 text-xs uppercase font-medium">Delivery Charge</td>
                                                <td className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">+ Rs {order.delivery_charge.toFixed(2)}</td>
                                            </tr>
                                            <tr className="bg-gray-100 dark:bg-zinc-800/50">
                                                <td colSpan={3} className="px-4 py-3 text-right font-bold text-gray-900 dark:text-gray-100">Grand Total</td>
                                                <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400 text-base">Rs {order.total_amount.toFixed(2)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Remarks */}
                            {order.remarks && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded border border-yellow-200 dark:border-yellow-800/30">
                                    <h4 className="text-xs font-bold text-yellow-700 dark:text-yellow-500 uppercase mb-1">Remarks</h4>
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">{order.remarks}</p>
                                </div>
                            )}

                        </div>

                        {/* RIGHT COLUMN - Sidebar Info */}
                        <div className="lg:col-span-1 space-y-6">

                            {/* Platform Information (Synced) */}
                            {(order.platform || order.page_name || (order as any).messaging_app_order_id || order.order_type === 'Import') && (
                                <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 overflow-hidden shadow-sm">
                                    <div className="px-4 py-3 border-b dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                            Platform Info <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">Synced</span>
                                        </h3>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div>
                                            <span className="block text-xs text-gray-500 mb-0.5">Order Type</span>
                                            <span className="font-medium text-gray-900 dark:text-gray-100">{order.order_type}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs text-gray-500 mb-0.5">User Type</span>
                                            <span className="font-medium text-gray-900 dark:text-gray-100">{order.user_type}</span>
                                        </div>
                                        {order.platform && (
                                            <div>
                                                <span className="block text-xs text-gray-500 mb-0.5">Platform</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">{order.platform}</span>
                                            </div>
                                        )}
                                        {order.page_name && (
                                            <div>
                                                <span className="block text-xs text-gray-500 mb-0.5">Page/Account</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">{order.page_name}</span>
                                            </div>
                                        )}
                                        {(order as any).messaging_app_order_id && (
                                            <div>
                                                <span className="block text-xs text-gray-500 mb-0.5">Internal Order ID</span>
                                                <span className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all">{(order as any).messaging_app_order_id}</span>
                                            </div>
                                        )}
                                        <div>
                                            <span className="block text-xs text-gray-500 mb-0.5">Logistic / Courier</span>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900 dark:text-gray-100">{order.logistic_name || order.courier_provider || 'N/A'}</span>
                                                {order.courier_consignment_id && (
                                                    <span className="text-xs text-gray-500 font-mono mt-0.5">{order.courier_consignment_id}</span>
                                                )}
                                            </div>
                                        </div>
                                        {order.confirmed_at && (
                                            <div>
                                                <span className="block text-xs text-gray-500 mb-0.5">Confirmed At</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">{new Date(order.confirmed_at).toLocaleString()}</span>
                                                {order.confirmed_by && (
                                                    <span className="block text-xs text-gray-500 mt-0.5">by {order.confirmed_by}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Audit Trail */}
                            <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 overflow-hidden shadow-sm">
                                <div className="px-4 py-3 border-b dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Audit Trail</h3>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div className="relative pl-4 border-l-2 border-gray-100 dark:border-zinc-800 space-y-4">

                                        {/* Created */}
                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-zinc-900"></div>
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Order Created</div>
                                            <div className="text-xs text-gray-500">{(order.created_user as any)?.full_name || 'System'}</div>
                                            <div className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString()}</div>
                                        </div>

                                        {/* Confirmed (Synced) */}
                                        {((order as any).confirmed_at) && (
                                            <div className="relative">
                                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-zinc-900"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Confirmed</div>
                                                <div className="text-xs text-gray-500">{(order as any).confirmed_by || 'System'}</div>
                                                <div className="text-xs text-gray-400">{new Date((order as any).confirmed_at).toLocaleString()}</div>
                                            </div>
                                        )}

                                        {/* Shipped */}
                                        {order.shipped_at && (
                                            <div className="relative">
                                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-purple-500 border-2 border-white dark:border-zinc-900"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Shipped</div>
                                                <div className="text-xs text-gray-500">{(order as any).shipped_user?.full_name || 'Unknown'}</div>
                                                <div className="text-xs text-gray-400">{new Date(order.shipped_at).toLocaleString()}</div>
                                            </div>
                                        )}

                                        {/* Delivered */}
                                        {order.delivered_at && (
                                            <div className="relative">
                                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-green-600 border-2 border-white dark:border-zinc-900"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Delivered</div>
                                                <div className="text-xs text-gray-500">{(order as any).delivered_user?.full_name || 'Unknown'}</div>
                                                <div className="text-xs text-gray-400">{new Date(order.delivered_at).toLocaleString()}</div>
                                            </div>
                                        )}

                                        {/* Cancelled */}
                                        {order.cancelled_at && (
                                            <div className="relative">
                                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white dark:border-zinc-900"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Cancelled</div>
                                                <div className="text-xs text-gray-500">{(order as any).cancelled_user?.full_name || 'Unknown'}</div>
                                                <div className="text-xs text-gray-400">{new Date(order.cancelled_at).toLocaleString()}</div>
                                            </div>
                                        )}

                                        {/* Last Updated */}
                                        {order.updated_at && (
                                            <div className="relative pt-2">
                                                <div className="absolute -left-[21px] top-3 w-3 h-3 rounded-full bg-gray-400 border-2 border-white dark:border-zinc-900"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Last Updated</div>
                                                <div className="text-xs text-gray-500">{order.updated_user?.full_name || 'System'}</div>
                                                <div className="text-xs text-gray-400">{new Date(order.updated_at).toLocaleString()}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
