'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDailySalesReport } from '@/features/sales/actions/daraz-actions'
import { getUserRole } from '@/features/sales/actions/daraz-deletion-actions'
import { ArrowLeft, BarChart2, FileText, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'

type ReportTab = 'daily' | 'order'

export default function DarazSalesDashboardPage() {
    const [activeTab, setActiveTab] = useState<ReportTab>('daily')
    const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null)
    const [isCheckingRole, setIsCheckingRole] = useState(true)

    // Check user role
    useEffect(() => {
        async function checkRole() {
            try {
                const role = await getUserRole()
                setUserRole(role)
            } catch (error) {
                console.error('Failed to check role:', error)
                setUserRole('user')
            } finally {
                setIsCheckingRole(false)
            }
        }
        checkRole()
    }, [])

    // Fetch daily sales report
    const { data: dailyReport, isLoading } = useQuery({
        queryKey: ['daily-sales-report'],
        queryFn: getDailySalesReport,
        enabled: userRole === 'admin' && activeTab === 'daily',
        staleTime: 60 * 1000
    })

    // Format currency
    const formatAmount = (amount: number) => {
        return `Rs. ${amount.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }

    // Loading state
    if (isCheckingRole) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-[15px] text-gray-500">Checking permissions...</p>
                </div>
            </div>
        )
    }

    // Admin-only access
    if (userRole !== 'admin') {
        return (
            <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
                <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 flex items-center justify-between shadow-sm">
                    <div>
                        <h1 className="text-[17px] font-bold">Sales Dashboard</h1>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">Access Denied</p>
                    </div>
                    <Link
                        href="/dashboard/sales/daraz"
                        className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    >
                        <ArrowLeft size={12} />
                        Back to Dashboard
                    </Link>
                </div>
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-2xl font-semibold mb-2">Admin Access Required</h2>
                        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-[17px]">
                            Only administrators can view the Sales Dashboard. Please contact your administrator for access.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Compact Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 flex items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Sales Dashboard</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Performance Reports</p>
                </div>
                <Link
                    href="/dashboard/sales/daraz"
                    className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                >
                    <ArrowLeft size={12} />
                    Back to Dashboard
                </Link>
            </div>

            {/* Tab Bar */}
            <div className="sticky top-[44px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm">
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setActiveTab('daily')}
                        className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'daily'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        <BarChart2 size={12} />
                        Daily Sales Report
                    </button>
                    <button
                        onClick={() => setActiveTab('order')}
                        className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'order'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        <FileText size={12} />
                        Order Report
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-3">
                {activeTab === 'daily' && (
                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-zinc-800">
                                    <tr>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 w-10">S.N</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Date</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Seller Account</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Shipped Qty</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Shipped Amount</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Delivered Qty</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Delivered Amount</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Failed Delivery</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Customer Return</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={9} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                                Loading report data...
                                            </td>
                                        </tr>
                                    ) : dailyReport && dailyReport.length > 0 ? (
                                        dailyReport.map((row, index) => (
                                            <tr key={`${row.date}-${row.seller_account}`} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-2 py-1.5 text-[13px] text-gray-500">{index + 1}</td>
                                                <td className="px-2 py-1.5 text-[13px] font-medium">{formatDate(row.date)}</td>
                                                <td className="px-2 py-1.5 text-[13px]">{row.seller_account}</td>
                                                <td className="px-2 py-1.5 text-[13px] text-center">
                                                    <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                                                        {row.shipped_qty}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-right font-mono text-blue-600 dark:text-blue-400">
                                                    {formatAmount(row.shipped_amount)}
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-center">
                                                    <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                                                        {row.delivered_qty}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-right font-mono text-green-600 dark:text-green-400">
                                                    {formatAmount(row.delivered_amount)}
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-center">
                                                    <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.failed_qty > 0
                                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                            : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                        }`}>
                                                        {row.failed_qty}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-center">
                                                    <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.return_qty > 0
                                                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                            : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                        }`}>
                                                        {row.return_qty}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={9} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                                No report data available. Orders with Shipped, Delivered, Failed Delivery, or Customer Return status will appear here.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                {activeTab === 'order' && (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-800 mb-3">
                                <FileText className="w-6 h-6 text-gray-400" />
                            </div>
                            <h3 className="text-[17px] font-semibold mb-1">Order Report</h3>
                            <p className="text-[15px] text-gray-500 dark:text-gray-400">
                                This feature is under development.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

