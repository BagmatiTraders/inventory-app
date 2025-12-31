'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-shim'
import { BarChart3, TrendingUp, ShoppingCart, Package, ArrowLeft, Menu } from 'lucide-react'
import Link from 'next/link'
import { useDashboard } from '../../layout'
import {
    getFiscalYears,
    getActiveFiscalYear,
    getPurchasesByFiscalYear,
    getPurchaseStatsByMonth,
    getPurchasesLast30Days,
    getPurchasesByProduct
} from '@/features/purchase/actions/purchase-analytics-actions'

export default function PurchaseAnalyticsPage() {
    const { setIsMobileMenuOpen } = useDashboard()
    const [selectedFYId, setSelectedFYId] = useState<string>('')

    // Fetch fiscal years
    const { data: fiscalYearsData } = useQuery({
        queryKey: ['fiscal-years'],
        queryFn: () => getFiscalYears()
    })

    // Fetch active fiscal year
    const { data: activeFYData } = useQuery({
        queryKey: ['active-fiscal-year'],
        queryFn: () => getActiveFiscalYear()
    })

    // Set default selected fiscal year to active one
    useEffect(() => {
        if (activeFYData?.data && !selectedFYId) {
            setSelectedFYId(activeFYData.data.id)
        }
    }, [activeFYData, selectedFYId])

    // Fetch purchase stats for selected fiscal year
    const { data: purchaseData, isLoading } = useQuery({
        queryKey: ['purchases-by-fiscal-year', selectedFYId],
        queryFn: () => getPurchasesByFiscalYear(selectedFYId),
        enabled: !!selectedFYId
    })

    // Fetch monthly stats
    const { data: monthlyData } = useQuery({
        queryKey: ['monthly-stats', selectedFYId],
        queryFn: () => getPurchaseStatsByMonth(selectedFYId),
        enabled: !!selectedFYId
    })

    // Fetch last 30 days data
    const { data: last30DaysData } = useQuery({
        queryKey: ['last-30-days'],
        queryFn: () => getPurchasesLast30Days()
    })

    // Fetch product stats
    const { data: productData } = useQuery({
        queryKey: ['products-by-fiscal-year', selectedFYId],
        queryFn: () => getPurchasesByProduct(selectedFYId),
        enabled: !!selectedFYId
    })

    const fiscalYears = fiscalYearsData?.data || []
    const stats = purchaseData?.stats || { totalPurchases: 0, totalAmount: 0, totalQuantity: 0 }
    const fiscalYear = purchaseData?.fiscalYear
    const monthlyStats = monthlyData?.monthlyStats || []
    const dailyStats = last30DaysData?.dailyStats || []
    const productStats = productData?.productStats || []

    return (
        <div className="bg-gray-50 dark:bg-zinc-900 min-h-screen">
            <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6 pb-20 md:pb-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 fixed md:static top-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 p-4 md:p-0 border-b md:border-0 dark:border-zinc-800 shadow-sm md:shadow-none">
                    <div className="flex items-center justify-between w-full md:w-auto">
                        <div className="flex items-center gap-3 md:gap-4">
                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setIsMobileMenuOpen(true)}
                                className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md"
                            >
                                <Menu size={24} />
                            </button>

                            {/* Back Button - Hidden on Mobile */}
                            <Link href="/dashboard/purchase" className="hidden md:flex p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded">
                                <ArrowLeft className="h-5 w-5" />
                            </Link>

                            {/* Title - Centered on Mobile via flex hacks or just standard */}
                            <div>
                                <h1 className="text-xl md:text-3xl font-bold">Purchase Analytics</h1>
                                <p className="text-sm text-gray-500 hidden md:block">Analyze purchases by fiscal year</p>
                            </div>
                        </div>
                    </div>

                    {/* Fiscal Year Selector */}
                    <div className="w-full md:w-64">
                        <select
                            value={selectedFYId}
                            onChange={(e) => setSelectedFYId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                        >
                            <option value="">Select Fiscal Year</option>
                            {fiscalYears.map(fy => (
                                <option key={fy.id} value={fy.id}>
                                    {fy.name} {fy.is_active && '(Active)'}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Spacer for mobile fixed header */}
                <div className="md:hidden h-28"></div>

                {isLoading ? (
                    <div className="text-center py-12">Loading...</div>
                ) : (
                    <>
                        {/* Info Banner */}
                        {fiscalYear && (
                            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                                <CardContent className="p-4">
                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                        Showing data for <strong>{fiscalYear.name}</strong>
                                        {' '}({new Date(fiscalYear.start_date).toLocaleDateString()} - {new Date(fiscalYear.end_date).toLocaleDateString()})
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between p-3 md:p-6 pb-1 md:pb-2">
                                    <CardTitle className="text-xs md:text-sm font-medium text-gray-500">Total Purchases</CardTitle>
                                    <ShoppingCart className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
                                </CardHeader>
                                <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                                    <div className="text-lg md:text-3xl font-bold">{stats.totalPurchases}</div>
                                    <Link href="/dashboard/purchase/all-purchase-list" className="text-[10px] md:text-sm text-blue-600 hover:underline">
                                        View all
                                    </Link>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between p-3 md:p-6 pb-1 md:pb-2">
                                    <CardTitle className="text-xs md:text-sm font-medium text-gray-500">Total Amount</CardTitle>
                                    <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
                                </CardHeader>
                                <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                                    <div className="text-lg md:text-3xl font-bold">Rs {stats.totalAmount.toLocaleString()}</div>
                                </CardContent>
                            </Card>

                            <Card className="col-span-2 md:col-span-1">
                                <CardHeader className="flex flex-row items-center justify-between p-3 md:p-6 pb-1 md:pb-2">
                                    <CardTitle className="text-xs md:text-sm font-medium text-gray-500">Total Quantity</CardTitle>
                                    <Package className="h-3 w-3 md:h-4 md:w-4 text-gray-500" />
                                </CardHeader>
                                <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                                    <div className="text-lg md:text-3xl font-bold">{stats.totalQuantity.toLocaleString()}</div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Monthly Data Table */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5" />
                                    Monthly Purchase Breakdown
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {monthlyStats.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                                <tr>
                                                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase">Month</th>
                                                    <th className="px-2 md:px-4 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Purchases</th>
                                                    <th className="px-2 md:px-4 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Qty</th>
                                                    <th className="px-2 md:px-4 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                                {monthlyStats.map((stat, i) => (
                                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                                        <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm font-medium">{stat.month}</td>
                                                        <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm text-right">{stat.purchases}</td>
                                                        <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm text-right">{stat.quantity}</td>
                                                        <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm text-right font-medium">Rs {stat.amount.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50 dark:bg-zinc-800 font-bold">
                                                <tr>
                                                    <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm">Total</td>
                                                    <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm text-right">{stats.totalPurchases}</td>
                                                    <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm text-right">{stats.totalQuantity}</td>
                                                    <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm text-right">Rs {stats.totalAmount.toLocaleString()}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500 py-12">No data available</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Last 30 Days Daily Table */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5" />
                                    Last 30 Days - Daily Purchases
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {dailyStats.length > 0 ? (
                                    <div className="overflow-x-auto max-h-96">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0">
                                                <tr>
                                                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase">Date</th>
                                                    <th className="px-2 md:px-4 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Purchases</th>
                                                    <th className="px-2 md:px-4 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Qty</th>
                                                    <th className="px-2 md:px-4 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                                {dailyStats.slice().reverse().map((stat, i) => (
                                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                                        <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm">{new Date(stat.date).toLocaleDateString()}</td>
                                                        <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm text-right">{stat.purchases}</td>
                                                        <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm text-right">{stat.quantity}</td>
                                                        <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm text-right">Rs {stat.amount.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500 py-12">No data available</p>
                                )}
                            </CardContent>
                        </Card>

                        {/*  Top Products Table */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Top 10 Products This Fiscal Year</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {productStats.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                                <tr>
                                                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase">#</th>
                                                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase">Product</th>
                                                    <th className="px-2 md:px-4 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Qty</th>
                                                    <th className="px-2 md:px-4 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Amount</th>
                                                    <th className="px-2 md:px-4 py-2 md:py-3 text-right text-[10px] md:text-xs font-medium text-gray-500 uppercase">Orders</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                                {productStats.map((product, index) => (
                                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                                        <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm">{index + 1}</td>
                                                        <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm font-medium">{product.productName}</td>
                                                        <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm text-right">{product.totalQuantity}</td>
                                                        <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm text-right font-medium">
                                                            Rs {product.totalAmount.toLocaleString()}
                                                        </td>
                                                        <td className="px-2 md:px-4 py-1.5 md:py-3 text-xs md:text-sm text-right">{product.purchaseCount}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500 py-12">No products found</p>
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div >
    )
}
