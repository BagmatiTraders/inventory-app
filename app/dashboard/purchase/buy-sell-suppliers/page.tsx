'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSuppliers } from '@/features/suppliers/actions/supplier-actions'
import { ArrowLeft, Search, Plus } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import PurchaseForm from '@/features/purchase/components/PurchaseForm'

// ... imports
import { getPurchases } from '@/features/purchase/actions/purchase-actions'

export default function BuySellSuppliersPage() {
    const [search, setSearch] = useState('')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)

    // Fetch Suppliers
    const { data, isLoading } = useQuery({
        queryKey: ['suppliers-list', search],
        queryFn: () => getSuppliers({ limit: 1000, search: search })
    })

    // Fetch Buy/Sell Transactions (Recent)
    const { data: transactionsData, isLoading: isTransactionsLoading } = useQuery({
        queryKey: ['buy-sell-transactions'],
        queryFn: () => getPurchases({ limit: 50 })
    })

    const suppliers = data?.suppliers || []

    // Filter for Buy/Sell transactions (client-side for now as per instructions to show what is saved)
    // We look for purchase_name == 'Buy / Sell'
    const transactions = transactionsData?.purchases.filter((p: any) => p.purchase_name === 'Buy / Sell') || []

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Suppliers Buy / Sell Reports</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">View supplier reports and history</p>
                </div>
                <Link
                    href="/dashboard/purchase"
                    className="flex items-center gap-1 px-2 py-1 text-[13px] text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800 rounded transition-colors"
                >
                    <ArrowLeft size={14} />
                    Back to Dashboard
                </Link>
            </div>

            {/* Mobile Header - Removed as Global Header is used */}
            {/* <div className="md:hidden flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <Link href="/dashboard/purchase">
                        <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
                    </Link>
                    <h1 className="text-base font-bold">Suppliers Buy / Sell Reports</h1>
                </div>
            </div> */}

            {/* Controls */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-2 shadow-sm">
                <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search suppliers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800"
                        />
                    </div>

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="hidden md:flex items-center justify-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors whitespace-nowrap"
                    >
                        <Plus size={16} />
                        Add New Purchase
                    </button>
                </div>
            </div>

            {/* Mobile Floating Action Button */}
            <div className="md:hidden fixed bottom-24 right-4 z-40">
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="h-12 w-12 bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all"
                >
                    <Plus size={24} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-1 space-y-2">

                {/* Recent Transactions Table */}
                <Card className="flex flex-col flex-1 overflow-hidden">
                    <div className="hidden md:block px-4 py-3 border-b dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                        <h3 className="font-semibold text-gray-700 dark:text-gray-300">Recent Buy / Sell Transactions</h3>
                    </div>
                    <div className="overflow-auto relative flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-black dark:text-white">Date</th>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-black dark:text-white">Product</th>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-black dark:text-white">Supplier</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {isTransactionsLoading ? (
                                    <tr><td colSpan={3} className="p-4 text-center text-sm text-gray-500">Loading transactions...</td></tr>
                                ) : transactions.length === 0 ? (
                                    <tr><td colSpan={3} className="p-4 text-center text-sm text-gray-500">No recent Buy / Sell transactions.</td></tr>
                                ) : (
                                    transactions.map((t: any) => (
                                        <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-3 py-2 text-sm align-top">{t.purchase_date}</td>
                                            <td className="px-3 py-2 text-sm font-medium align-top">
                                                <div>{t.product?.product_name}</div>
                                                <div className="mt-1">
                                                    <span className={`px-2 py-0.5 rounded textxs font-medium ${t.purchase_type === 'Sell' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {t.purchase_type || 'Buy'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-500 align-top">
                                                <div className="font-medium text-gray-900 dark:text-gray-100">{t.supplier?.supplier_name}</div>
                                                <div className="text-xs mt-1">Qty: {t.quantity}</div>
                                                <div className="text-xs font-bold text-gray-700 dark:text-gray-300">Rs {t.total_amount.toLocaleString()}</div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* Add Purchase Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 md:p-4">
                    <div className="w-full max-w-3xl h-full md:h-[80vh] bg-white dark:bg-zinc-900 md:rounded-lg shadow-xl overflow-hidden">
                        <PurchaseForm
                            onClose={() => setIsAddModalOpen(false)}
                            onSuccess={() => { setIsAddModalOpen(false) }}
                            showExtraFields={true}
                            fixedPurchaseName="Buy / Sell"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
