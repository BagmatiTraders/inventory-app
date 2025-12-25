'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTodayPurchases } from '@/features/purchase/actions/purchase-actions'
import { getActiveFiscalYear } from '@/features/purchase/actions/purchase-analytics-actions'
import { Plus, List, Search, ArrowLeft, Info } from 'lucide-react'
import Link from 'next/link'
import PurchaseForm from '@/features/purchase/components/PurchaseForm'
import { Card } from '@/components/ui-shim'

export default function PurchaseEntryPage() {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [search, setSearch] = useState('')

    // Fetch Today's Purchases
    const { data, isLoading } = useQuery({
        queryKey: ['today-purchases'],
        queryFn: getTodayPurchases
    })

    // Fetch Active Fiscal Year
    const { data: fiscalYearData } = useQuery({
        queryKey: ['active-fiscal-year'],
        queryFn: getActiveFiscalYear
    })

    const activeFY = fiscalYearData?.data

    const filteredPurchases = data?.purchases.filter(p =>
        p.product?.product_name.toLowerCase().includes(search.toLowerCase()) ||
        p.supplier?.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
        p.remarks?.toLowerCase().includes(search.toLowerCase())
    ) || []

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 flex items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Purchase Entry</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Add and view today&apos;s purchases</p>
                </div>
                <Link
                    href="/dashboard/purchase"
                    className="flex items-center gap-1 px-2 py-1 text-[13px] text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800 rounded transition-colors"
                >
                    <ArrowLeft size={14} />
                    Back to Dashboard
                </Link>
            </div>

            {/* Action Bar */}
            <div className="sticky top-[44px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-2 shadow-sm flex flex-wrap items-center justify-start gap-4">
                {/* Left: Purchase List */}
                <Link
                    href="/dashboard/purchase/daily-purchase-list"
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                >
                    <List size={16} />
                    Purchase List
                </Link>

                {/* Right: Search & Add Button */}
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800"
                        />
                    </div>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors whitespace-nowrap"
                    >
                        <Plus size={16} />
                        Add Purchase
                    </button>
                </div>
            </div>

            {/* Content: Today's Purchases Table */}
            <div className="flex-1 overflow-auto p-3">
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                <tr>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Date</th>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Product</th>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Supplier</th>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Qty</th>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Rate</th>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Total</th>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Type</th>
                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {isLoading ? (
                                    <tr><td colSpan={8} className="p-4 text-center text-sm text-gray-500">Loading...</td></tr>
                                ) : filteredPurchases.length === 0 ? (
                                    <tr><td colSpan={8} className="p-4 text-center text-sm text-gray-500">No purchases added today.</td></tr>
                                ) : (
                                    filteredPurchases.map((purchase) => (
                                        <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-3 py-2 text-sm">{purchase.purchase_date}</td>
                                            <td className="px-3 py-2 text-sm font-medium">{purchase.product?.product_name}</td>
                                            <td className="px-3 py-2 text-sm">{purchase.supplier?.supplier_name}</td>
                                            <td className="px-3 py-2 text-sm text-right">{purchase.quantity}</td>
                                            <td className="px-3 py-2 text-sm text-right">{purchase.unit_amount.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-sm text-right font-medium text-green-600">Rs {purchase.total_amount.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-sm">
                                                <span className={`px-2 py-0.5 rounded textxs font-medium ${purchase.payment_type === 'Due' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                    }`}>
                                                    {purchase.payment_type}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-500 truncate max-w-[200px]" title={purchase.remarks}>{purchase.remarks}</td>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-3xl h-[80vh] bg-white dark:bg-zinc-900 rounded-lg shadow-xl overflow-hidden">
                        <PurchaseForm
                            onClose={() => setIsAddModalOpen(false)}
                            onSuccess={() => { }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
