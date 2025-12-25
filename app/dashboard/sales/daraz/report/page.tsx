'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    getAllFiscalYears,
    getActiveFiscalYear,
    getDarazSalesByFiscalYear,
    getMonthlySalesByFiscalYear,
    getSalesBySellerAccount
} from '@/features/sales/actions/daraz-actions'
import { ArrowLeft, TrendingUp, Package, DollarSign, Store, List } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'

export default function DarazSalesReportPage() {
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('')

    // Fetch fiscal years
    const { data: fiscalYears } = useQuery({
        queryKey: ['fiscal-years'],
        queryFn: getAllFiscalYears,
    })

    // Set active fiscal year on mount
    useEffect(() => {
        if (!selectedFiscalYear) {
            getActiveFiscalYear().then(fy => {
                if (fy) setSelectedFiscalYear(fy.id)
            })
        }
    }, [selectedFiscalYear])

    // Fetch sales summary
    const { data: salesSummary, isLoading: loadingSummary } = useQuery({
        queryKey: ['daraz-sales-summary', selectedFiscalYear],
        queryFn: () => getDarazSalesByFiscalYear(selectedFiscalYear),
        enabled: !!selectedFiscalYear
    })

    // Fetch monthly breakdown
    const { data: monthlyData, isLoading: loadingMonthly } = useQuery({
        queryKey: ['daraz-monthly-sales', selectedFiscalYear],
        queryFn: () => getMonthlySalesByFiscalYear(selectedFiscalYear),
        enabled: !!selectedFiscalYear
    })

    // Fetch seller account breakdown
    const { data: sellerData, isLoading: loadingSellers } = useQuery({
        queryKey: ['daraz-seller-sales', selectedFiscalYear],
        queryFn: () => getSalesBySellerAccount(selectedFiscalYear),
        enabled: !!selectedFiscalYear
    })

    const selectedFY = fiscalYears?.find(fy => fy.id === selectedFiscalYear)

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 flex items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-sm font-bold">Daraz Sales Report</h1>
                    {selectedFY && (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            FY: {new Date(selectedFY.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - {new Date(selectedFY.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href={`/dashboard/sales/daraz/order-list${selectedFiscalYear ? `?fiscalYear=${selectedFiscalYear}` : ''}`}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                        <List size={12} />
                        Order List
                    </Link>
                    <Link
                        href="/dashboard/sales/daraz"
                        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    >
                        <ArrowLeft size={12} />
                        Back to Sales
                    </Link>
                </div>
            </div>

            {/* Fiscal Year Selector Bar */}
            <div className="sticky top-[44px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm">
                <select
                    value={selectedFiscalYear}
                    onChange={(e) => setSelectedFiscalYear(e.target.value)}
                    className="w-full md:w-auto px-2 py-1 text-[11px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                    disabled={!fiscalYears || fiscalYears.length === 0}
                >
                    {!fiscalYears || fiscalYears.length === 0 ? (
                        <option>Loading...</option>
                    ) : (
                        fiscalYears.map(fy => {
                            const startDate = new Date(fy.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                            const endDate = new Date(fy.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                            return (
                                <option key={fy.id} value={fy.id}>
                                    {fy.name} ({startDate} - {endDate})
                                </option>
                            )
                        })
                    )}
                </select>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {loadingSummary ? (
                    <div className="text-center py-8 text-sm text-gray-500">Loading...</div>
                ) : salesSummary ? (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Card className="p-3 dark:bg-zinc-900 dark:border-zinc-700">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                                        <Package size={16} className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400">Total Orders</p>
                                        <p className="text-sm font-bold">{salesSummary.totalOrders}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-3 dark:bg-zinc-900 dark:border-zinc-700">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
                                        <TrendingUp size={16} className="text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400">Total Quantity</p>
                                        <p className="text-sm font-bold">{salesSummary.totalQuantity}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-3 dark:bg-zinc-900 dark:border-zinc-700">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded">
                                        <DollarSign size={16} className="text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400">Total Amount</p>
                                        <p className="text-sm font-bold">Rs {salesSummary.totalAmount.toLocaleString()}</p>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-3 dark:bg-zinc-900 dark:border-zinc-700">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded">
                                        <Store size={16} className="text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400">Active Accounts</p>
                                        <p className="text-sm font-bold">{salesSummary.activeSellerAccounts}</p>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Monthly Progress Chart */}
                        {monthlyData && monthlyData.length > 0 && (
                            <Card className="dark:bg-zinc-900 dark:border-zinc-700 mb-3">
                                <div className="p-3">
                                    <h3 className="text-[11px] font-bold uppercase text-gray-900 dark:text-gray-100 mb-3">
                                        📊 Monthly Order Trends
                                    </h3>
                                    <div className="space-y-2">
                                        {monthlyData.map((month, idx) => {
                                            const monthDate = new Date(month.month + '-01')
                                            const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                            const maxOrders = Math.max(...monthlyData.map(m => m.orderCount))
                                            const percentage = maxOrders > 0 ? (month.orderCount / maxOrders) * 100 : 0

                                            return (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <div className="w-16 text-[10px] text-gray-600 dark:text-gray-400 shrink-0">
                                                        {monthName}
                                                    </div>
                                                    <div className="flex-1 h-5 bg-gray-100 dark:bg-zinc-800 rounded-sm overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 flex items-center justify-end pr-1"
                                                            style={{ width: `${percentage}%` }}
                                                        >
                                                            {percentage > 20 && (
                                                                <span className="text-[9px] font-bold text-white">
                                                                    {month.orderCount}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {percentage <= 20 && (
                                                        <div className="w-8 text-[10px] font-medium text-gray-700 dark:text-gray-300">
                                                            {month.orderCount}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Seller Account Chart */}
                        {sellerData && sellerData.length > 0 && (
                            <Card className="dark:bg-zinc-900 dark:border-zinc-700 mb-3">
                                <div className="p-3">
                                    <h3 className="text-[11px] font-bold uppercase text-gray-900 dark:text-gray-100 mb-3">
                                        🏪 Sales by Seller Account
                                    </h3>
                                    <div className="space-y-2">
                                        {sellerData.map((seller, idx) => {
                                            const maxQty = Math.max(...sellerData.map(s => s.quantity))
                                            const percentage = maxQty > 0 ? (seller.quantity / maxQty) * 100 : 0

                                            return (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <div className="w-24 text-[10px] text-gray-600 dark:text-gray-400 shrink-0 truncate" title={seller.sellerAccount}>
                                                        {seller.sellerAccount}
                                                    </div>
                                                    <div className="flex-1 h-5 bg-gray-100 dark:bg-zinc-800 rounded-sm overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300 flex items-center justify-end pr-1"
                                                            style={{ width: `${percentage}%` }}
                                                        >
                                                            {percentage > 20 && (
                                                                <span className="text-[9px] font-bold text-white">
                                                                    {seller.quantity} qty
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {percentage <= 20 && (
                                                        <div className="w-12 text-[10px] font-medium text-gray-700 dark:text-gray-300">
                                                            {seller.quantity} qty
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Sales by Seller Account */}
                        <Card className="dark:bg-zinc-900 dark:border-zinc-700">
                            <div className="p-3">
                                <h3 className="text-[11px] font-bold uppercase text-gray-900 dark:text-gray-100 mb-2">
                                    Sales by Seller Account
                                </h3>
                                {loadingSellers ? (
                                    <div className="text-center py-4 text-xs text-gray-500">Loading sellers...</div>
                                ) : sellerData && sellerData.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full table-auto border-collapse">
                                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                                <tr>
                                                    <th className="px-2 py-1 text-left text-[9px] font-bold uppercase text-gray-900 dark:text-gray-100">Seller Account</th>
                                                    <th className="px-2 py-1 text-left text-[9px] font-bold uppercase text-gray-900 dark:text-gray-100">Company</th>
                                                    <th className="px-2 py-1 text-right text-[9px] font-bold uppercase text-gray-900 dark:text-gray-100">Orders</th>
                                                    <th className="px-2 py-1 text-right text-[9px] font-bold uppercase text-gray-900 dark:text-gray-100">Qty</th>
                                                    <th className="px-2 py-1 text-right text-[9px] font-bold uppercase text-gray-900 dark:text-gray-100">Total Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                                                {sellerData.map((seller, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                        <td className="px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300">{seller.sellerAccount}</td>
                                                        <td className="px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300">{seller.companyName}</td>
                                                        <td className="px-2 py-1 text-right text-[11px] text-gray-700 dark:text-gray-300">{seller.orders}</td>
                                                        <td className="px-2 py-1 text-right text-[11px] text-gray-700 dark:text-gray-300">{seller.quantity}</td>
                                                        <td className="px-2 py-1 text-right text-[11px] font-medium text-gray-900 dark:text-gray-100">
                                                            Rs {seller.totalAmount.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-xs text-gray-500">No seller data available</div>
                                )}
                            </div>
                        </Card>

                        {/* Monthly Breakdown */}
                        <Card className="dark:bg-zinc-900 dark:border-zinc-700">
                            <div className="p-3">
                                <h3 className="text-[11px] font-bold uppercase text-gray-900 dark:text-gray-100 mb-2">
                                    Month-by-Month Progress
                                </h3>
                                {loadingMonthly ? (
                                    <div className="text-center py-4 text-xs text-gray-500">Loading monthly data...</div>
                                ) : monthlyData && monthlyData.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full table-auto border-collapse">
                                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                                <tr>
                                                    <th className="px-2 py-1 text-left text-[9px] font-bold uppercase text-gray-900 dark:text-gray-100">Month</th>
                                                    <th className="px-2 py-1 text-right text-[9px] font-bold uppercase text-gray-900 dark:text-gray-100">Orders</th>
                                                    <th className="px-2 py-1 text-right text-[9px] font-bold uppercase text-gray-900 dark:text-gray-100">Total Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                                                {monthlyData.map((month, idx) => {
                                                    const monthDate = new Date(month.month + '-01')
                                                    const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                                    return (
                                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                            <td className="px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300">{monthName}</td>
                                                            <td className="px-2 py-1 text-right text-[11px] text-gray-700 dark:text-gray-300">{month.orderCount}</td>
                                                            <td className="px-2 py-1 text-right text-[11px] font-medium text-gray-900 dark:text-gray-100">
                                                                Rs {month.totalAmount.toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-xs text-gray-500">No monthly data available</div>
                                )}
                            </div>
                        </Card>
                    </>
                ) : (
                    <div className="text-center py-8 text-sm text-gray-500">Select a fiscal year to view report</div>
                )}
            </div>
        </div>
    )
}
