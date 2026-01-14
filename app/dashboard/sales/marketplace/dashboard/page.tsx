'use client'

import { useState, Suspense, useRef, useEffect } from 'react'
import { ArrowLeft, BarChart2, PieChart, RefreshCw, Search, X, Check, Trash2, Upload } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { useSearchParams } from 'next/navigation'
import { findMarketplaceOrder, updateMarketplaceOrderStatus, getMarketplaceOrders } from '@/features/sales/actions/marketplace-actions'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { DailySalesReport } from '@/features/sales/components/DailySalesReport'
import { OrderSummaryReport } from '@/features/sales/components/OrderSummaryReport'
import { MarketplaceOrderList } from '@/features/sales/components/MarketplaceOrderList'
import { List } from 'lucide-react'

type DashboardTab = 'update-status' | 'daily-report' | 'order-summary' | 'profit-tracker' | 'order-list'
type UpdateMode = 'manual' | 'bulk'

interface OrderInList {
    id: string
    sales_id: string
    order_date: string
    customer_name: string
    phone_number: string
    product_name: string
    order_status: string
}

function DashboardContent() {
    const [activeTab, setActiveTab] = useState<DashboardTab>('order-list')

    // Default back link to marketplace entry
    const backLink = { href: '/dashboard/sales/marketplace', label: 'Back to Sales Entry' }


    // Update Status State
    const [updateMode, setUpdateMode] = useState<UpdateMode>('bulk') // Default to bulk as requested
    const [searchBy, setSearchBy] = useState<'order_number' | 'phone_number'>('order_number')
    const [searchValue, setSearchValue] = useState('')
    const [ordersInList, setOrdersInList] = useState<OrderInList[]>([])
    const [newStatus, setNewStatus] = useState('')
    const [isUpdating, setIsUpdating] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Manual Update State
    const [manualFilterStatus, setManualFilterStatus] = useState('Pending')
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
    const [manualBulkStatus, setManualBulkStatus] = useState('')

    // Fetch orders for manual update
    // We only need this query if activeTab is 'update-status' and updateMode is 'manual', 
    // but hooks must be unconditional. We can control 'enabled'.
    const { data: manualOrdersData, isLoading: isLoadingManual, refetch: refetchManual } = useQuery({
        queryKey: ['marketplace-orders-manual', manualFilterStatus],
        queryFn: () => getMarketplaceOrders({
            limit: 500,
            status: manualFilterStatus === 'All' ? undefined : manualFilterStatus
        }),
        enabled: activeTab === 'update-status' && updateMode === 'manual'
    })


    // Helper to determine available next statuses
    const getNextStatuses = (currentStatus: string) => {
        switch (currentStatus) {
            case 'Pending': return ['Shipped', 'Cancel']
            case 'Shipped': return ['Delivered', 'Returning to Seller']
            case 'Delivered': return ['Customer Return']
            case 'Returning to Seller': return ['Fail Delivered']
            case 'Customer Return': return ['Return Delivered']
            default: return []
        }
    }

    const handleManualStatusChange = async (ids: string[], status: string) => {
        if (!ids.length || !status) return
        if (!confirm(`Update ${ids.length} orders to "${status}"?`)) return

        setIsUpdating(true)
        try {
            await updateMarketplaceOrderStatus(ids, status)
            toast.success('Status updated')
            setSelectedOrderIds([])
            setManualBulkStatus('')
            refetchManual()
        } catch (error: any) {
            toast.error('Failed to update')
        } finally {
            setIsUpdating(false)
        }
    }

    // Handle selection
    const toggleSelection = (id: string) => {
        setSelectedOrderIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const toggleAll = () => {
        if (!manualOrdersData?.orders) return
        if (selectedOrderIds.length === manualOrdersData.orders.length) {
            setSelectedOrderIds([])
        } else {
            setSelectedOrderIds(manualOrdersData.orders.map((o: any) => o.id))
        }
    }

    const handleSearch = async () => {
        if (!searchValue.trim()) {
            toast.error('Please enter a value to search')
            return
        }

        try {
            // Try searching with the selected key first
            let order = await findMarketplaceOrder(searchBy, searchValue)

            // If not found, try the other key automatically
            if (!order) {
                const otherKey = searchBy === 'order_number' ? 'phone_number' : 'order_number'
                order = await findMarketplaceOrder(otherKey, searchValue)

                // If found with other key, implicitly we could switch the dropdown, 
                // but for now just using the result is enough to be "smart"
                if (order) {
                    setSearchBy(otherKey) // Optional: switch UI to match what we found
                }
            }

            if (!order) {
                toast.error('Order not found')
                setSearchValue('')
                searchInputRef.current?.focus()
                return
            }

            // Check if already in list
            if (ordersInList.some(o => o.id === order.id)) {
                toast.error('Order already in list')
                setSearchValue('')
                searchInputRef.current?.focus()
                return
            }

            // Add to list
            const newOrder: OrderInList = {
                id: order.id,
                sales_id: order.sales_id,
                order_date: order.order_date,
                customer_name: order.customer_name,
                phone_number: order.phone_number,
                product_name: order.items?.[0]?.product_name || 'N/A' + (order.items && order.items.length > 1 ? ` +${order.items.length - 1} more` : ''),
                order_status: order.order_status
            }

            setOrdersInList([...ordersInList, newOrder])
            toast.success('Order added to list')
            setSearchValue('')
            searchInputRef.current?.focus()
        } catch (error: any) {
            toast.error('Error finding order')
        }
    }

    const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsImporting(true)
        try {
            const text = await file.text()
            const lines = text.split('\n').map(line => line.trim()).filter(line => line) // Remove empty lines

            if (lines.length < 2) {
                toast.error('Invalid CSV: No data found')
                return
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
            let searchKey: 'order_number' | 'phone_number' | null = null
            let colIndex = -1

            if (headers.includes('order number')) {
                searchKey = 'order_number'
                colIndex = headers.indexOf('order number')
            } else if (headers.includes('phone number')) {
                searchKey = 'phone_number'
                colIndex = headers.indexOf('phone number')
            }

            if (!searchKey || colIndex === -1) {
                toast.error('CSV must have "Order Number" or "Phone Number" column')
                return
            }

            let foundCount = 0
            const newOrders: OrderInList[] = []

            // Process rows
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',')
                const value = cols[colIndex]?.trim()

                if (!value) continue

                // Check if already in current list or new orders
                if (
                    ordersInList.some(o => o.sales_id === value || o.phone_number === value) ||
                    newOrders.some(o => o.sales_id === value || o.phone_number === value)
                ) continue

                // Find order
                // Note: Running sequentially to avoid slamming the server, but could be parallelized with limit
                const order = await findMarketplaceOrder(searchKey, value)

                if (order) {
                    // Check duplicates again by ID just in case
                    if (!ordersInList.some(o => o.id === order.id) && !newOrders.some(o => o.id === order.id)) {
                        newOrders.push({
                            id: order.id,
                            sales_id: order.sales_id,
                            order_date: order.order_date,
                            customer_name: order.customer_name,
                            phone_number: order.phone_number,
                            product_name: order.items?.[0]?.product_name || 'N/A' + (order.items && order.items.length > 1 ? ` +${order.items.length - 1} more` : ''),
                            order_status: order.order_status
                        })
                        foundCount++
                    }
                }
            }

            setOrdersInList(prev => [...prev, ...newOrders])
            toast.success(`Import complete. Found ${foundCount} orders.`)

        } catch (error) {
            console.error(error)
            toast.error('Failed to process CSV')
        } finally {
            setIsImporting(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleBulkUpdate = async () => {
        if (ordersInList.length === 0) return
        if (!newStatus) {
            toast.error('Please select a status')
            return
        }

        if (!confirm(`Update ${ordersInList.length} orders to "${newStatus}"?`)) return

        setIsUpdating(true)
        try {
            const ids = ordersInList.map(o => o.id)
            await updateMarketplaceOrderStatus(ids, newStatus)
            toast.success('Orders updated successfully')
            setOrdersInList([])
            setNewStatus('')
        } catch (error: any) {
            toast.error('Failed to update orders')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleRemoveFromList = (id: string) => {
        setOrdersInList(ordersInList.filter(o => o.id !== id))
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Sales Dashboard</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Marketplace Reports & Tools</p>
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

            {/* Tab Bar */}
            <div className="sticky top-[0px] md:top-[44px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm overflow-x-auto">
                <div className="flex items-center gap-1.5 min-w-max">
                    <button
                        onClick={() => setActiveTab('order-list')}
                        className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'order-list'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        <List size={12} />
                        Order List
                    </button>
                    <button
                        onClick={() => setActiveTab('update-status')}
                        className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'update-status'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        <RefreshCw size={12} />
                        Update Order Status
                    </button>
                    <button
                        onClick={() => setActiveTab('daily-report')}
                        className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'daily-report'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        <BarChart2 size={12} />
                        Daily Sales Report
                    </button>
                    <button
                        onClick={() => setActiveTab('order-summary')}
                        className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'order-summary'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        <PieChart size={12} />
                        Order Summary
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

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-3">
                {activeTab === 'order-list' && (
                    <MarketplaceOrderList isEmbedded={true} />
                )}

                {activeTab === 'update-status' && (
                    <div className="space-y-4">
                        {/* Mode Toggles */}
                        <div className="flex justify-start gap-2 mb-4">
                            <button
                                onClick={() => setUpdateMode('manual')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${updateMode === 'manual'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'
                                    }`}
                            >
                                Manual Update
                            </button>
                            <button
                                onClick={() => setUpdateMode('bulk')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${updateMode === 'bulk'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'
                                    }`}
                            >
                                Bulk Update
                            </button>
                        </div>

                        {updateMode === 'manual' ? (
                            <div className="space-y-3">
                                {/* Filter & Bulk Actions */}
                                <Card className="p-3 dark:bg-zinc-800">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">Filter Status:</span>
                                            <select
                                                value={manualFilterStatus}
                                                onChange={(e) => {
                                                    setManualFilterStatus(e.target.value)
                                                    setSelectedOrderIds([]) // Clear selection on filter change
                                                }}
                                                className="px-2 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="Shipped">Shipped</option>
                                                <option value="Delivered">Delivered</option>
                                                <option value="Returning to Seller">Returning to Seller</option>
                                                <option value="Fail Delivered">Fail Delivered</option>
                                                <option value="Customer Return">Customer Return</option>
                                                <option value="Return Delivered">Return Delivered</option>
                                                <option value="Cancel">Cancel</option>
                                                <option value="All">All Status</option>
                                            </select>
                                        </div>

                                        {selectedOrderIds.length > 0 && manualFilterStatus !== 'All' && (
                                            <div className="flex items-center gap-2 ml-auto animate-in fade-in slide-in-from-right-2">
                                                <span className="text-xs text-gray-500">{selectedOrderIds.length} selected</span>
                                                <select
                                                    value={manualBulkStatus}
                                                    onChange={(e) => handleManualStatusChange(selectedOrderIds, e.target.value)}
                                                    className="px-2 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                                                >
                                                    <option value="">Bulk Change Status...</option>
                                                    {getNextStatuses(manualFilterStatus).map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </Card>

                                {/* Table */}
                                <Card className="overflow-hidden dark:bg-zinc-800">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 dark:bg-zinc-900 border-b dark:border-zinc-700">
                                                <tr>
                                                    <th className="px-3 py-2 w-8">
                                                        <input
                                                            type="checkbox"
                                                            checked={manualOrdersData?.orders?.length > 0 && selectedOrderIds.length === manualOrdersData?.orders?.length}
                                                            onChange={toggleAll}
                                                            className="rounded border-gray-300"
                                                        />
                                                    </th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500 w-12">S.N</th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500">Date</th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500">Sales ID</th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500">Customer</th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500">Phone</th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500">Products</th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500">Status</th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500">Change Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                                                {isLoadingManual ? (
                                                    <tr><td colSpan={9} className="p-8 text-center text-gray-500">Loading orders...</td></tr>
                                                ) : !manualOrdersData?.orders?.length ? (
                                                    <tr><td colSpan={9} className="p-8 text-center text-gray-500">No orders found.</td></tr>
                                                ) : (
                                                    manualOrdersData.orders.map((order: any, index: number) => (
                                                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-zinc-700/30">
                                                            <td className="px-3 py-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedOrderIds.includes(order.id)}
                                                                    onChange={() => toggleSelection(order.id)}
                                                                    className="rounded border-gray-300"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-gray-500">{index + 1}</td>
                                                            <td className="px-3 py-2 text-sm">{new Date(order.order_date).toLocaleDateString()}</td>
                                                            <td className="px-3 py-2 text-sm font-mono">{order.sales_id}</td>
                                                            <td className="px-3 py-2 text-sm">{order.customer_name}</td>
                                                            <td className="px-3 py-2 text-sm">{order.phone_number}</td>
                                                            <td className="px-3 py-2 text-sm max-w-[200px] truncate" title={order.items?.[0]?.product_name}>
                                                                {order.items?.[0]?.product_name || '-'}
                                                                {order.items?.length > 1 && ` +${order.items.length - 1}`}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm">
                                                                <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${order.order_status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                                                    order.order_status === 'Shipped' ? 'bg-blue-100 text-blue-700' :
                                                                        order.order_status === 'Delivered' ? 'bg-green-100 text-green-700' :
                                                                            'bg-gray-100 text-gray-700'
                                                                    }`}>
                                                                    {order.order_status}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 text-sm">
                                                                {getNextStatuses(order.order_status).length > 0 && (
                                                                    <select
                                                                        value=""
                                                                        onChange={(e) => handleManualStatusChange([order.id], e.target.value)}
                                                                        className="px-2 py-1 text-xs border dark:border-zinc-700 rounded hover:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900 w-full max-w-[130px]"
                                                                    >
                                                                        <option value="">Change Status...</option>
                                                                        {getNextStatuses(order.order_status).map(s => (
                                                                            <option key={s} value={s}>{s}</option>
                                                                        ))}
                                                                    </select>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Search Section */}
                                <Card className="p-3 dark:bg-zinc-800">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <select
                                            value={searchBy}
                                            onChange={(e) => setSearchBy(e.target.value as any)}
                                            className="px-2 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                        >
                                            <option value="order_number">Order Number</option>
                                            <option value="phone_number">Phone Number</option>
                                        </select>
                                        <div className="flex-1 relative min-w-[200px]">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                            <input
                                                ref={searchInputRef}
                                                type="text"
                                                value={searchValue}
                                                onChange={(e) => setSearchValue(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                                placeholder={`Enter ${searchBy === 'order_number' ? 'Order Number' : 'Phone Number'}...`}
                                                className="w-full pl-8 pr-2 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                            />
                                        </div>
                                        <button
                                            onClick={handleSearch}
                                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                                        >
                                            Add to List
                                        </button>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isImporting}
                                            className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
                                        >
                                            <Upload size={14} />
                                            {isImporting ? 'Importing...' : 'Import CSV'}
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".csv"
                                            onChange={handleCSVImport}
                                            className="hidden"
                                        />
                                    </div>
                                </Card>

                                {/* List Section */}
                                <Card className="overflow-hidden dark:bg-zinc-800">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 dark:bg-zinc-900 border-b dark:border-zinc-700">
                                                <tr>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400 w-12">S.N</th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Date</th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Sales ID</th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Customer Name</th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Phone Number</th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Products Name</th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Status</th>
                                                    <th className="px-3 py-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400 text-center w-16">Remove</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                                                {ordersInList.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                                            No orders added yet. Search above to add orders.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    ordersInList.map((order, index) => (
                                                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-zinc-700/30">
                                                            <td className="px-3 py-2 text-sm text-gray-500">{index + 1}</td>
                                                            <td className="px-3 py-2 text-sm">{new Date(order.order_date).toLocaleDateString()}</td>
                                                            <td className="px-3 py-2 text-sm font-mono">{order.sales_id}</td>
                                                            <td className="px-3 py-2 text-sm">{order.customer_name}</td>
                                                            <td className="px-3 py-2 text-sm">{order.phone_number}</td>
                                                            <td className="px-3 py-2 text-sm max-w-[200px] truncate" title={order.product_name}>
                                                                {order.product_name}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm">
                                                                <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${order.order_status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                                                    order.order_status === 'Shipped' ? 'bg-blue-100 text-blue-700' :
                                                                        order.order_status === 'Delivered' ? 'bg-green-100 text-green-700' :
                                                                            'bg-gray-100 text-gray-700'
                                                                    }`}>
                                                                    {order.order_status}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 text-center">
                                                                <button
                                                                    onClick={() => handleRemoveFromList(order.id)}
                                                                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>

                                {/* Action Footer */}
                                <Card className="p-3 dark:bg-zinc-800">
                                    <div className="flex items-center gap-3">
                                        <select
                                            value={newStatus}
                                            onChange={(e) => setNewStatus(e.target.value)}
                                            className="flex-1 px-3 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-900"
                                            disabled={ordersInList.length === 0}
                                        >
                                            <option value="">Select New Status...</option>
                                            <option value="Shipped">Shipped</option>
                                            <option value="Delivered">Delivered</option>
                                            <option value="Returning to Seller">Returning to Seller</option>
                                            <option value="Fail Delivered">Fail Delivered</option>
                                            <option value="Customer Return">Customer Return</option>
                                            <option value="Return Delivered">Return Delivered</option>
                                            <option value="Cancel">Cancel</option>
                                        </select>
                                        <button
                                            onClick={handleBulkUpdate}
                                            disabled={ordersInList.length === 0 || !newStatus || isUpdating}
                                            className="flex items-center gap-2 px-6 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
                                        >
                                            {isUpdating ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                                            Update {ordersInList.length > 0 ? `${ordersInList.length} Orders` : ''}
                                        </button>
                                    </div>
                                </Card>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'daily-report' && (
                    <DailySalesReport />
                )}

                {activeTab === 'order-summary' && (
                    <OrderSummaryReport />
                )}

                {activeTab === 'profit-tracker' && (
                    <Card className="p-8 text-center text-gray-500">
                        <BarChart2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium">Profit Tracker</h3>
                        <p>Track profitability of orders.</p>
                    </Card>
                )}
            </div>
        </div>
    )
}

export default function MarketplaceSalesDashboardPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        }>
            <DashboardContent />
        </Suspense>
    )
}
