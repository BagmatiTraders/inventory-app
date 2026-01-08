'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDailySalesReport, getOrderSummaryReport, getOrderStatusSummary } from '@/features/sales/actions/daraz-actions'
import { getUserRole } from '@/features/sales/actions/daraz-deletion-actions'
import { ArrowLeft, BarChart2, FileText, AlertCircle, PieChart, RefreshCw, Download } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { useSearchParams } from 'next/navigation'

import { OrderStatusSyncTable } from '@/features/sales/components/OrderStatusSyncTable'
import { OrderSyncPageContent } from '../order-sync/page'
import ProfitTrackerPage from '../profit-tracker/page'

import { Suspense } from 'react'

type ReportTab = 'daily' | 'summary' | 'status-sync' | 'order-sync' | 'profit-tracker'

function DashboardContent() {
    const [activeTab, setActiveTab] = useState<ReportTab>('daily')
    const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null)
    const [isCheckingRole, setIsCheckingRole] = useState(true)
    const searchParams = useSearchParams()
    const fromPage = searchParams.get('from')

    const backLink = fromPage === 'sales-entry'
        ? { href: '/dashboard/sales/daraz/sales-entry', label: 'Back to Sales Entry' }
        : { href: '/dashboard/sales/daraz', label: 'Back to Dashboard' }

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

    // Fetch order summary report
    const { data: summaryReport, isLoading: isSummaryLoading } = useQuery({
        queryKey: ['order-summary-report'],
        queryFn: getOrderSummaryReport,
        enabled: userRole === 'admin' && activeTab === 'summary',
        staleTime: 60 * 1000
    })

    // Fetch order status summary
    const { data: statusSummary, isLoading: isStatusSummaryLoading } = useQuery({
        queryKey: ['order-status-summary'],
        queryFn: getOrderStatusSummary,
        enabled: userRole === 'admin' && activeTab === 'summary',
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

    // Calculate totals for Daily Sales Report
    const dailyTotals = dailyReport?.reduce((acc, row) => ({
        shipped_qty: acc.shipped_qty + row.shipped_qty,
        shipped_amount: acc.shipped_amount + row.shipped_amount,
        returning_to_seller_qty: acc.returning_to_seller_qty + row.returning_to_seller_qty,
        returned_delivered_qty: acc.returned_delivered_qty + row.returned_delivered_qty,
        delivered_qty: acc.delivered_qty + row.delivered_qty,
        return_qty: acc.return_qty + row.return_qty,
        customer_return_delivered_qty: acc.customer_return_delivered_qty + row.customer_return_delivered_qty
    }), {
        shipped_qty: 0,
        shipped_amount: 0,
        returning_to_seller_qty: 0,
        returned_delivered_qty: 0,
        delivered_qty: 0,
        return_qty: 0,
        customer_return_delivered_qty: 0
    })

    // Calculate totals for Order Summary Report
    const summaryTotals = summaryReport?.reduce((acc, row) => ({
        shipped_qty: acc.shipped_qty + row.shipped_qty,
        shipped_amount: acc.shipped_amount + row.shipped_amount,
        returning_to_seller_qty: acc.returning_to_seller_qty + row.returning_to_seller_qty,
        returned_delivered_qty: acc.returned_delivered_qty + row.returned_delivered_qty,
        delivered_qty: acc.delivered_qty + row.delivered_qty,
        return_qty: acc.return_qty + row.return_qty,
        customer_return_delivered_qty: acc.customer_return_delivered_qty + row.customer_return_delivered_qty,
        remain_qty: acc.remain_qty + row.remain_qty
    }), {
        shipped_qty: 0,
        shipped_amount: 0,
        returning_to_seller_qty: 0,
        returned_delivered_qty: 0,
        delivered_qty: 0,
        return_qty: 0,
        customer_return_delivered_qty: 0,
        remain_qty: 0
    })

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
                <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                    <div>
                        <h1 className="text-[17px] font-bold">Sales Dashboard</h1>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">Access Denied</p>
                    </div>
                    <Link
                        href={backLink.href}
                        className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    >
                        <ArrowLeft size={12} />
                        {backLink.label}
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
            {/* Compact Header - Hidden on mobile, visible on desktop */}
            <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Sales Dashboard</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Performance Reports</p>
                </div>
                <div className="flex gap-2">

                    <Link
                        href={backLink.href}
                        className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    >
                        <ArrowLeft size={12} />
                        {backLink.label}
                    </Link>
                </div>
            </div>


            {/* Tab Bar - Hidden on mobile, visible on desktop */}
            <div className="hidden md:block sticky top-[44px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm">
                <div className="flex items-center justify-between">
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
                            onClick={() => setActiveTab('summary')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'summary'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <PieChart size={12} />
                            Account Summary
                        </button>
                        <button
                            onClick={() => setActiveTab('status-sync')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'status-sync'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <RefreshCw size={12} />
                            Order Status Sync
                        </button>
                        <button
                            onClick={() => setActiveTab('order-sync')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'order-sync'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <Download size={12} />
                            Order Sync
                        </button>
                        <button
                            onClick={() => setActiveTab('profit-tracker')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'profit-tracker'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <BarChart2 size={12} />
                            Profit Tracker
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-3 pb-20 md:pb-3">
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
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Returning to Seller</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Returned Delivered</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Delivered Qty</th>
                                        {/* Removed Delivered Amount column? No, user said "Shipped Qty, Shipped Amount... Delivered Qty". User didn't explicitly say remove Delivered Amount but the order list "S.N, Date, Seller Account, Shipped Qty, Shipped Amount, Returning to Seller, Returned Delivered, Delivered Qty, Customer Return, Customer Return Delivered" does NOT include Delivered Amount. I will remove it to strictly follow instructions. */}
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Customer Return</th>
                                        <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Customer Return Delivered</th>
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
                                                    <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.returning_to_seller_qty > 0
                                                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                                        : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                        }`}>
                                                        {row.returning_to_seller_qty}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-center">
                                                    <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.returned_delivered_qty > 0
                                                        ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                                        : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                        }`}>
                                                        {row.returned_delivered_qty}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-center">
                                                    <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                                                        {row.delivered_qty}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-center">
                                                    <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.return_qty > 0
                                                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                                        : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                        }`}>
                                                        {row.return_qty}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-center">
                                                    <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.customer_return_delivered_qty > 0
                                                        ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                                        : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                        }`}>
                                                        {row.customer_return_delivered_qty}
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
                                {dailyReport && dailyReport.length > 0 && dailyTotals && (
                                    <tfoot className="bg-gray-50 dark:bg-zinc-800 border-t dark:border-zinc-800 font-bold">
                                        <tr>
                                            <td colSpan={3} className="px-2 py-2 text-center text-xs uppercase text-gray-600 dark:text-gray-400">Total</td>
                                            <td className="px-2 py-2 text-[13px] text-center text-blue-700 dark:text-blue-400">
                                                {dailyTotals.shipped_qty}
                                            </td>
                                            <td className="px-2 py-2 text-[13px] text-right text-blue-700 dark:text-blue-400 font-mono">
                                                {formatAmount(dailyTotals.shipped_amount)}
                                            </td>
                                            <td className="px-2 py-2 text-[13px] text-center text-orange-700 dark:text-orange-400">
                                                {dailyTotals.returning_to_seller_qty}
                                            </td>
                                            <td className="px-2 py-2 text-[13px] text-center text-orange-800 dark:text-orange-300">
                                                {dailyTotals.returned_delivered_qty}
                                            </td>
                                            <td className="px-2 py-2 text-[13px] text-center text-green-700 dark:text-green-400">
                                                {dailyTotals.delivered_qty}
                                            </td>
                                            <td className="px-2 py-2 text-[13px] text-center text-orange-700 dark:text-orange-400">
                                                {dailyTotals.return_qty}
                                            </td>
                                            <td className="px-2 py-2 text-[13px] text-center text-orange-800 dark:text-orange-300">
                                                {dailyTotals.customer_return_delivered_qty}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </Card>
                )}

                {
                    activeTab === 'summary' && (
                        <>
                            <Card className="overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 dark:bg-zinc-800">
                                            <tr>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 w-10">S.N</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Seller Account</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Shipped Qty</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Shipped Amount</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Returning to Seller</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Returned Delivered</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Delivered Qty</th>
                                                {/* User requested column order: Shipped Qty, Shipped Amt, Returning to Seller, Returned Delivered, Delivered Qty, Customer Return, Customer Return Delivered, Remain Qty */}
                                                {/* Delivered Amt is usually requested but user list was "Delivered Qty, Customer Return". I'll keep Delivered Amt if it was there or follow strictly? Previous table HAD Delivered Amount. User prompt "Delivered Qty, Customer Return...". It skipped Delivered Amount. But user prompt for Daily Sales skipped it too and I kept it? No, in Daily Sales prompt: "Shipped Qty, Shipped Amount, ... Delivered Qty, Customer Return". It skipped Delivered Amount. I REMOVED Delivered Amount in Daily Sales? NO, I think I kept it? Let's check Daily Sales table... I DELETED IT because I followed instructions.
                                        Wait, in previous turn I updated Daily Sales. Did I remove Delivered Amount?
                                        Let's check file content... I viewed it previously. I should check step 992. I commented "Removed Delivered Amount column? ... I will remove it to strictly follow instructions.". So I removed it.
                                        Okay, for Order Summary, I will also REMOVE Delivered Amount if it's not in the list.
                                        List: "S.N, Date, Seller Account, Shipped Qty, Shipped Amount, Returning to Seller, Returned Delivered, Delivered Qty, Customer Return, Customer Return Delivered , ,Remain Qty"
                                        So NO Delivered Amount.
                                        */}
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Customer Return</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Customer Return Delivered</th>
                                                <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center">Remain Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                            {isSummaryLoading ? (
                                                <tr>
                                                    <td colSpan={10} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                                        Loading summary data...
                                                    </td>
                                                </tr>
                                            ) : summaryReport && summaryReport.length > 0 ? (
                                                summaryReport.map((row, index) => (
                                                    <tr key={row.seller_account} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                        <td className="px-2 py-1.5 text-[13px] text-gray-500">{index + 1}</td>
                                                        <td className="px-2 py-1.5 text-[13px] font-medium">{row.seller_account}</td>
                                                        <td className="px-2 py-1.5 text-[13px] text-center">
                                                            <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                                                                {row.shipped_qty}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-[13px] text-right font-mono text-blue-600 dark:text-blue-400">
                                                            {formatAmount(row.shipped_amount)}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-[13px] text-center">
                                                            <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.returning_to_seller_qty > 0
                                                                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                                                : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                                }`}>
                                                                {row.returning_to_seller_qty}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-[13px] text-center">
                                                            <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.returned_delivered_qty > 0
                                                                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                                                : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                                }`}>
                                                                {row.returned_delivered_qty}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-[13px] text-center">
                                                            <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                                                                {row.delivered_qty}
                                                            </span>
                                                        </td>
                                                        {/* Removed Delivered Amount as per instruction */}
                                                        <td className="px-2 py-1.5 text-[13px] text-center">
                                                            <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.return_qty > 0
                                                                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                                                : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                                }`}>
                                                                {row.return_qty}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-[13px] text-center">
                                                            <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.customer_return_delivered_qty > 0
                                                                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                                                : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                                }`}>
                                                                {row.customer_return_delivered_qty}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-[13px] text-center">
                                                            <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded font-medium ${row.remain_qty > 0
                                                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                                : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                                                                }`}>
                                                                {row.remain_qty}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={9} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                                        No summary data available.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {summaryReport && summaryReport.length > 0 && summaryTotals && (
                                            <tfoot className="bg-gray-50 dark:bg-zinc-800 border-t dark:border-zinc-800 font-bold">
                                                <tr>
                                                    <td colSpan={2} className="px-2 py-2 text-center text-xs uppercase text-gray-600 dark:text-gray-400">Total</td>
                                                    <td className="px-2 py-2 text-[13px] text-center text-blue-700 dark:text-blue-400">
                                                        {summaryTotals.shipped_qty}
                                                    </td>
                                                    <td className="px-2 py-2 text-[13px] text-right text-blue-700 dark:text-blue-400 font-mono">
                                                        {formatAmount(summaryTotals.shipped_amount)}
                                                    </td>
                                                    <td className="px-2 py-2 text-[13px] text-center text-orange-700 dark:text-orange-400">
                                                        {summaryTotals.returning_to_seller_qty}
                                                    </td>
                                                    <td className="px-2 py-2 text-[13px] text-center text-orange-800 dark:text-orange-300">
                                                        {summaryTotals.returned_delivered_qty}
                                                    </td>
                                                    <td className="px-2 py-2 text-[13px] text-center text-green-700 dark:text-green-400">
                                                        {summaryTotals.delivered_qty}
                                                    </td>
                                                    <td className="px-2 py-2 text-[13px] text-center text-orange-700 dark:text-orange-400">
                                                        {summaryTotals.return_qty}
                                                    </td>
                                                    <td className="px-2 py-2 text-[13px] text-center text-orange-800 dark:text-orange-300">
                                                        {summaryTotals.customer_return_delivered_qty}
                                                    </td>
                                                    <td className="px-2 py-2 text-[13px] text-center text-yellow-700 dark:text-yellow-400">
                                                        {summaryTotals.remain_qty}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </Card>

                            {/* Double line separator */}
                            <div className="border-t-4 border-double border-gray-300 dark:border-zinc-700 my-6"></div>

                            <h2 className="text-lg font-bold mb-3">Order Status Sync Data</h2>
                            <Card className="overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-zinc-800 dark:text-gray-400">
                                            <tr>
                                                <th className="px-2 py-3">S.N</th>
                                                <th className="px-2 py-3">Seller Account</th>
                                                <th className="px-2 py-3 text-center">Pending</th>
                                                <th className="px-2 py-3 text-center">Packed</th>
                                                <th className="px-2 py-3 text-center">Ready to Ship</th>
                                                <th className="px-2 py-3 text-center">Shipped</th>
                                                <th className="px-2 py-3 text-center">Delivered</th>
                                                <th className="px-2 py-3 text-center">Returning to Seller</th>
                                                <th className="px-2 py-3 text-center">Returned Delivered</th>
                                                <th className="px-2 py-3 text-center">Customer Return</th>
                                                <th className="px-2 py-3 text-center">Customer Return Delivered</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {isStatusSummaryLoading ? (
                                                <tr>
                                                    <td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-500">
                                                        Loading status data...
                                                    </td>
                                                </tr>
                                            ) : !statusSummary || statusSummary.length === 0 ? (
                                                <tr>
                                                    <td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-500">
                                                        No status data available.
                                                    </td>
                                                </tr>
                                            ) : (
                                                statusSummary.map((row: any, idx: number) => (
                                                    <tr key={idx} className="bg-white border-b dark:bg-zinc-900 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                        <td className="px-2 py-3 text-[13px]">{idx + 1}</td>
                                                        <td className="px-2 py-3 font-medium text-gray-900 dark:text-white">{row.seller_account}</td>
                                                        <td className="px-2 py-3 text-center text-yellow-700 dark:text-yellow-400">{row.pending}</td>
                                                        <td className="px-2 py-3 text-center text-blue-700 dark:text-blue-400">{row.packed}</td>
                                                        <td className="px-2 py-3 text-center text-green-700 dark:text-green-400">{row.ready_to_ship}</td>
                                                        <td className="px-2 py-3 text-center text-indigo-700 dark:text-indigo-400">{row.shipped}</td>
                                                        <td className="px-2 py-3 text-center text-green-800 dark:text-green-300 font-medium">{row.delivered}</td>
                                                        <td className="px-2 py-3 text-center text-orange-700 dark:text-orange-400">{row.returning_to_seller}</td>
                                                        <td className="px-2 py-3 text-center text-orange-800 dark:text-orange-300">{row.returned_delivered}</td>
                                                        <td className="px-2 py-3 text-center text-red-700 dark:text-red-400">{row.customer_return}</td>
                                                        <td className="px-2 py-3 text-center text-red-800 dark:text-red-300">{row.customer_return_delivered}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </>
                    )
                }

                {
                    activeTab === 'status-sync' && (
                        <OrderStatusSyncTable />
                    )
                }

                {activeTab === 'order-sync' && (
                    <OrderSyncPageContent isEmbedded={true} />
                )}

                {activeTab === 'profit-tracker' && (
                    <ProfitTrackerPage isEmbedded={true} />
                )}

            </div >

            {/* Mobile Footer Navigation - Only visible on mobile */}
            < div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-zinc-800 border-t dark:border-zinc-700 shadow-lg" >
                <div className="grid grid-cols-3 gap-1 p-2">
                    <button
                        onClick={() => setActiveTab('daily')}
                        className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors ${activeTab === 'daily'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300'
                            }`}
                    >
                        <BarChart2 size={18} />
                        <span className="text-[10px] font-medium text-center leading-tight">Daily Sales</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors ${activeTab === 'summary'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300'
                            }`}
                    >
                        <PieChart size={18} />
                        <span className="text-[10px] font-medium text-center leading-tight">Account Summary</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('status-sync')}
                        className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors ${activeTab === 'status-sync'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300'
                            }`}
                    >
                        <RefreshCw size={18} />
                        <span className="text-[10px] font-medium text-center leading-tight">Order Status</span>
                    </button>
                </div>
            </div >
        </div >
    )
}

export default function DarazSalesDashboardPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        }>
            <DashboardContent />
        </Suspense>
    )
}

