'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDarazOrders, getDarazOrderById, deleteDarazOrder, updateDarazOrderStatus, getDarazOrderStats, syncProductInfoFromInventory } from '@/features/sales/actions/daraz-actions'
import { syncOrderStatusesFromDarazData } from '@/features/sales/actions/daraz-sync-status'
import { getUserRole, getUserDeletionStats, createDeletionRequest, softDeleteOrder } from '@/features/sales/actions/daraz-deletion-actions'
import { getOnlineStores } from '@/features/settings/actions/settingsActions'
import { Search, Plus, Upload, Download, Printer, List, X, ArrowLeft, Trash2, Clock, RefreshCw, Filter, FileX } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui-shim'
import { AddDarazOrderModal } from '@/features/sales/components/AddDarazOrderModal'
import { ImportDarazOrdersModal } from '@/features/sales/components/ImportDarazOrdersModal'
import { DeletionReasonModal } from '@/features/sales/components/DeletionReasonModal'
import { AdminDeleteConfirm } from '@/features/sales/components/AdminDeleteConfirm'
// DarazInvoice removed

import { toast } from 'sonner'

export default function DarazSalesEntryPage() {
    const router = useRouter()
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [selectedOrders, setSelectedOrders] = useState<string[]>([])
    const [searchInput, setSearchInput] = useState('')
    const [searchQuery, setSearchQuery] = useState('') // Actual search query used for fetching
    const [statusFilter, setStatusFilter] = useState('all')
    const [sellerAccountFilter, setSellerAccountFilter] = useState('all') // New filter
    const [unprintedOnly, setUnprintedOnly] = useState(false) // New filter for 'Awb Unprint'
    const [bulkStatus, setBulkStatus] = useState('')
    const [page, setPage] = useState(1)
    const [isSyncingOrders, setIsSyncingOrders] = useState(false)

    const [highlightedDuplicates, setHighlightedDuplicates] = useState<string[]>([])
    const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null)
    const [deletionModal, setDeletionModal] = useState<{ isOpen: boolean, order: any | null }>({ isOpen: false, order: null })
    const [adminDeleteModal, setAdminDeleteModal] = useState<{ isOpen: boolean, order: any | null }>({ isOpen: false, order: null })
    const [isSubmittingDeletion, setIsSubmittingDeletion] = useState(false)

    const queryClient = useQueryClient()

    // Fetch stats (Filtered by Seller Account, Shipped restricted to Today for Sales Entry context)
    const { data: stats } = useQuery({
        queryKey: ['daraz-order-stats', sellerAccountFilter],
        queryFn: () => getDarazOrderStats(sellerAccountFilter, true),
        placeholderData: { pending: 0, packed: 0, readyToShip: 0, shipped: 0 },
        staleTime: 60 * 1000 // 1 minute
    })

    // Fetch online stores for filter
    const { data: onlineStoresResult } = useQuery({
        queryKey: ['online-stores'],
        queryFn: getOnlineStores
    })
    const onlineStores = onlineStoresResult?.data || []

    // Fetch orders (Pending or Today's date + Filters)
    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['daraz-orders', page, searchQuery, statusFilter, sellerAccountFilter, unprintedOnly],
        queryFn: () => getDarazOrders({
            page,
            limit: 1000,
            status: statusFilter,
            todayOnly: true, // Show only Pending or today's orders
            sellerAccount: sellerAccountFilter,
            unprintedOnly
        }),
        placeholderData: (previousData) => previousData,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000
    })

    const orders = data?.orders || []
    const pagination = data?.pagination

    // Calculate customer frequency
    const customerCounts = orders.reduce((acc: { [key: string]: number }, order) => {
        acc[order.customer_name] = (acc[order.customer_name] || 0) + 1
        return acc
    }, {})

    // Calculate customer frequency specifically for TODAY
    const customerCountsToday = orders.reduce((acc: { [key: string]: number }, order) => {
        const today = new Date().toISOString().split('T')[0]
        const orderDate = new Date(order.order_date).toLocaleDateString('en-CA') // YYYY-MM-DD

        if (orderDate === today) {
            acc[order.customer_name] = (acc[order.customer_name] || 0) + 1
        }
        return acc
    }, {})

    // Helper to determine customer highlight class
    const getCustomerClass = (name: string, dateStr: string) => {
        const today = new Date().toISOString().split('T')[0]
        const orderDate = new Date(dateStr).toLocaleDateString('en-CA')

        // Priority 1: Duplicate ON TODAY (Green)
        if (orderDate === today && (customerCountsToday[name] || 0) > 1) {
            return 'text-green-600 dark:text-green-400 font-bold'
        }

        // Priority 2: Duplicate Global/History (Blue)
        if (customerCounts[name] > 1) {
            return 'text-blue-600 dark:text-blue-400 font-bold'
        }

        return 'text-gray-700 dark:text-gray-300'
    }

    // Memoize duplicate order number detection for performance
    const duplicateOrderNumbers = useMemo(() => {
        const counts: { [key: string]: number } = {}
        orders.forEach(order => {
            counts[order.order_number] = (counts[order.order_number] || 0) + 1
        })
        return Object.keys(counts).filter(orderNumber => counts[orderNumber] > 1)
    }, [orders])

    useEffect(() => {
        // Update highlighted duplicates when orders or duplicateOrderNumbers change
        const newHighlighted: string[] = []
        orders.forEach(order => {
            if (duplicateOrderNumbers.includes(order.order_number)) {
                newHighlighted.push(order.id)
            }
        })
        setHighlightedDuplicates(newHighlighted)
    }, [orders, duplicateOrderNumbers])

    // Fetch user role on mount
    useEffect(() => {
        getUserRole().then(role => setUserRole(role))
    }, [])

    // Handle refreshing order data from database
    const handleSyncOrders = async () => {
        setIsSyncingOrders(true)
        try {
            // Simply refetch all data from the database
            // The Order Sync page should have already updated statuses when it synced from Daraz API
            await queryClient.refetchQueries({ queryKey: ['daraz-orders'] })
            await queryClient.refetchQueries({ queryKey: ['daraz-order-stats'] })

            toast.success('Orders refreshed successfully', {
                description: 'Showing latest data from database'
            })
        } catch (error: any) {
            toast.error(error.message || 'Failed to refresh orders')
        } finally {
            setIsSyncingOrders(false)
        }
    }

    // Handle syncing product info from inventory
    const handleSyncProductInfo = async () => {
        if (!confirm('This will match seller SKUs from your orders with products in the inventory and update product names/accounts.\n\nContinue?')) {
            return
        }

        try {
            const result = await syncProductInfoFromInventory()
            alert(result.message)

            if (result.success && result.updated > 0) {
                // Refresh orders to show updated product info
                queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
            }
        } catch (error: any) {
            alert(`Sync error: ${error.message}`)
        }
    }

    // Delete handlers
    const handleDeleteClick = async (order: any) => {
        if (userRole === 'admin') {
            setAdminDeleteModal({ isOpen: true, order })
        } else {
            const stats = await getUserDeletionStats()
            if (!stats.canDelete) {
                const nextTime = stats.nextDeletionAvailable
                    ? new Date(stats.nextDeletionAvailable).toLocaleString()
                    : 'later'
                toast.error(`Feature blocked! You can delete again after ${nextTime}`)
                return
            }
            setDeletionModal({ isOpen: true, order })
        }
    }

    const handleUserDeletionSubmit = async (reason: string) => {
        if (!deletionModal.order) return

        setIsSubmittingDeletion(true)
        try {
            const result = await createDeletionRequest(
                deletionModal.order.id,
                deletionModal.order.order_number,
                reason
            )

            if (result.success) {
                toast.success('Deletion request submitted for admin approval')
                queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
                setDeletionModal({ isOpen: false, order: null })
            } else {
                toast.error(result.error || 'Failed to submit request')
            }
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsSubmittingDeletion(false)
        }
    }

    const handleAdminDeleteConfirm = async () => {
        if (!adminDeleteModal.order) return

        setIsSubmittingDeletion(true)
        try {
            const result = await softDeleteOrder(adminDeleteModal.order.id)

            if (result.success) {
                toast.success('Order deleted and moved to Restore Backup')
                queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
                setAdminDeleteModal({ isOpen: false, order: null })
            } else {
                toast.error(result.error || 'Failed to delete order')
            }
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsSubmittingDeletion(false)
        }
    }

    const handleDelete = (orderId: string, orderNumber: string) => {
        // Legacy function - redirect to new system
        const order = orders.find(o => o.id === orderId)
        if (order) handleDeleteClick(order)
    }


    const handleSearch = () => {
        setSearchQuery(searchInput)
        setPage(1)
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setSearchQuery('')
        setPage(1)
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedOrders(orders.map(o => o.id))
        } else {
            setSelectedOrders([])
        }
    }

    const handleSelectOrder = (orderId: string, checked: boolean) => {
        if (checked) {
            setSelectedOrders([...selectedOrders, orderId])
        } else {
            setSelectedOrders(selectedOrders.filter(id => id !== orderId))
        }
    }

    const handleBulkStatusUpdate = async () => {
        if (selectedOrders.length === 0 || !bulkStatus) {
            toast.error('Please select orders and a status')
            return
        }

        try {
            await updateDarazOrderStatus(selectedOrders, bulkStatus)
            toast.success(`Updated ${selectedOrders.length} orders`)
            setSelectedOrders([])
            setBulkStatus('')
            queryClient.invalidateQueries({ queryKey: ['daraz-orders'] })
        } catch (error: any) {
            toast.error(error.message || 'Failed to update status')
        }
    }

    /* handlePrint removed in favor of direct window.open */


    // Render pagination
    const renderPagination = () => {
        if (!pagination || pagination.totalPages <= 1) return null

        const pages = []
        const { page: currentPage, totalPages } = pagination

        // Smart pagination logic (same as Product List)
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i)
            }
        } else {
            if (currentPage <= 3) {
                pages.push(1, 2, 3, 4, 5, '...', totalPages)
            } else if (currentPage >= totalPages - 2) {
                pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
            }
        }

        return (
            <div className="flex items-center justify-between px-4 py-3 border-t dark:border-zinc-700">
                <div className="text-[17px] text-gray-600 dark:text-gray-400">
                    Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} orders
                </div>
                <div className="flex items-center gap-1">
                    {pages.map((p, idx) => (
                        p === '...' ? (
                            <span key={idx} className="px-2 text-gray-400">...</span>
                        ) : (
                            <button
                                key={idx}
                                onClick={() => setPage(p as number)}
                                className={`px-3 py-1 text-[17px] rounded ${p === currentPage
                                    ? 'bg-blue-600 text-white'
                                    : 'hover:bg-gray-100 dark:hover:bg-zinc-800'
                                    }`}
                            >
                                {p}
                            </button>
                        )
                    ))}
                </div>
            </div>
        )
    }

    // Grouping and Sorting Logic
    const groupedOrders = useMemo(() => {
        if (!orders.length) return []

        const storeOrder = ['Bagmati Traders', 'Balaju Shop', 'Btas', 'Cosmetic Shop']
        const statusPriority: Record<string, number> = {
            'pending': 1,
            'packed': 2,
            'ready to ship': 3,
            'shipped': 4,
            'cancel': 5,
            'cancelled': 5,
            'delivered': 6,
            'failed delivery': 7,
            'customer return': 8,
            'returned': 8
        }

        const getStatusRank = (status: string) => statusPriority[status.toLowerCase()] || 99

        // 1. Group by Seller Account
        const groups: Record<string, typeof orders> = {}
        orders.forEach(order => {
            const seller = order.seller_account || 'Unknown'
            if (!groups[seller]) groups[seller] = []
            groups[seller].push(order)
        })

        // 2. Sort Groups by Order Count (Descending) - Largest group first
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            return groups[b].length - groups[a].length
        })

        // 3. Sort Orders within Groups
        sortedKeys.forEach(key => {
            groups[key].sort((a, b) => {
                const rankA = getStatusRank(a.order_status)
                const rankB = getStatusRank(b.order_status)
                if (rankA !== rankB) return rankA - rankB

                // If same status, sort by Date (Desc)
                return new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
            })
        })

        return sortedKeys.map(key => ({
            seller: key,
            orders: groups[key]
        }))
    }, [orders])

    const getStatusColor = (status: string) => {
        const s = status.toLowerCase()
        if (s === 'pending') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        if (s === 'ready to ship') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' // Light Green as requested
        if (s === 'packed') return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
        if (s === 'shipped') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        if (s === 'delivered') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        if (s === 'cancel' || s === 'cancelled') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' // Red as requested
        if (s.includes('return')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
        if (s.includes('fail')) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }

    const getRowClass = (order: any) => {
        const status = order.order_status.toLowerCase()
        const isDuplicate = highlightedDuplicates.includes(order.id)

        if (status === 'cancel' || status === 'cancelled') return 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors'
        if (isDuplicate) return 'bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors'
        return 'hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors'
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Compact Header */}
            <div className="z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                        <h1 className="text-[17px] font-bold">Daraz Sales</h1>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">Sales Entry</p>
                    </div>

                    {/* Stats Badges */}
                    {stats && (
                        <div className="flex flex-wrap gap-1.5">
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border border-yellow-200 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-900 dark:text-yellow-400 whitespace-nowrap`}>
                                Pending: {stats.pending}
                            </span>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-900 dark:text-indigo-400 whitespace-nowrap`}>
                                Packed: {stats.packed}
                            </span>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-900 dark:text-green-400 whitespace-nowrap`}>
                                Ready: {stats.readyToShip}
                            </span>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-900 dark:text-blue-400 whitespace-nowrap`}>
                                Shipped: {stats.shipped}
                            </span>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handleSyncOrders}
                            disabled={isSyncingOrders}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Refresh orders from Order Sync page data"
                        >
                            <RefreshCw size={11} className={isSyncingOrders ? 'animate-spin' : ''} />
                            {isSyncingOrders ? 'Syncing...' : 'Refresh Orders'}
                        </button>
                        <button
                            onClick={handleSyncProductInfo}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-green-600 hover:bg-green-700 text-white rounded transition-colors whitespace-nowrap"
                            title="Sync product names from inventory by matching seller SKUs"
                        >
                            <RefreshCw size={11} />
                            Sync Products
                        </button>
                        <Link
                            href="/dashboard/sales/daraz"
                            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors whitespace-nowrap"
                        >
                            <ArrowLeft size={11} />
                            Back
                        </Link>
                    </div>
                </div>
            </div>

            {/* Compact Action Bar with Filters */}
            <div className="z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                    {/* Order List Button */}
                    <Link
                        href="/dashboard/sales/daraz/order-list"
                        className="flex items-center gap-1 px-2 py-1 text-[11px] bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors whitespace-nowrap"
                    >
                        <List size={11} />
                        Order List
                    </Link>

                    {/* Separator */}
                    <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700"></div>

                    {/* Seller Account Dropdown */}
                    <select
                        value={sellerAccountFilter}
                        onChange={(e) => setSellerAccountFilter(e.target.value)}
                        className="px-2 py-1 text-[11px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-200"
                        style={{ maxWidth: '120px' }}
                    >
                        <option value="all">All Sellers</option>
                        {onlineStores.map((store: any) => (
                            <option key={store.id} value={store.seller_account}>
                                {store.seller_account}
                            </option>
                        ))}
                    </select>

                    {/* Status Dropdown */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-2 py-1 text-[11px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-200"
                    >
                        <option value="all">All Status</option>
                        <option value="Pending">Pending</option>
                        <option value="Packed">Packed</option>
                        <option value="Ready to Ship">Ready to Ship</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="Returned">Returned</option>
                        <option value="Failed Delivery">Failed Delivery</option>
                    </select>

                    {/* Awb Unprint Button */}
                    <button
                        onClick={() => setUnprintedOnly(!unprintedOnly)}
                        className={`flex items-center gap-1 px-2 py-1 text-[11px] border rounded transition-colors whitespace-nowrap ${unprintedOnly
                            ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 font-medium'
                            : 'hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:text-gray-300'
                            }`}
                        title="Show orders with unprinted invoices/AWB only"
                    >
                        <FileX size={10} />
                        {unprintedOnly ? 'Unprinted' : 'Unprint'}
                    </button>

                    {/* Separator */}
                    <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700"></div>

                    {/* Search Box */}
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={11} />
                        <input
                            type="text"
                            placeholder="Search order#, tracking#..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full pl-6 pr-6 py-1 text-[11px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                        />
                        {searchInput && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                title="Clear search"
                            >
                                <X size={10} />
                            </button>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors whitespace-nowrap"
                    >
                        <Plus size={11} />
                        Add
                    </button>

                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors dark:text-gray-50 whitespace-nowrap"
                    >
                        <Upload size={11} />
                        Import
                    </button>
                    <button className="flex items-center gap-1 px-2 py-1 text-[11px] border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors dark:text-gray-50 whitespace-nowrap">
                        <Download size={11} />
                        Export
                    </button>

                    {/* Clear Filters Button */}
                    <button
                        onClick={() => {
                            setSellerAccountFilter('all')
                            setStatusFilter('all')
                            setUnprintedOnly(false)
                            setSearchQuery('')
                            setSearchInput('')
                            setBulkStatus('')
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 rounded transition-colors whitespace-nowrap"
                        title="Clear all filters"
                    >
                        <X size={10} strokeWidth={3} />
                        Clear
                    </button>

                    {/* Total Count */}
                    <div className="ml-auto text-[11px] font-black text-black dark:text-gray-100 whitespace-nowrap">
                        Total: {pagination?.total || 0}
                    </div>
                </div>

                {/* Compact Bulk Actions */}
                {selectedOrders.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t dark:border-zinc-700 flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">{selectedOrders.length} selected</span>
                        <button
                            onClick={() => {
                                const ids = selectedOrders.join(',')
                                window.open(`/print/daraz-invoice/bulk?ids=${ids}`, '_blank')
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 text-[13px] border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded dark:text-gray-50"
                        >
                            <Printer size={11} />
                            Print
                        </button>
                        <select
                            value={bulkStatus}
                            onChange={(e) => setBulkStatus(e.target.value)}
                            className="px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                        >
                            <option value="">Change Status...</option>
                            <option value="Pending">Pending</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Failed Delivered">Failed Delivered</option>
                            <option value="Customer Return">Customer Return</option>
                            <option value="Cancel">Cancel</option>
                        </select>
                        <button
                            onClick={handleBulkStatusUpdate}
                            disabled={!bulkStatus}
                            className="px-2 py-0.5 text-[13px] bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Update
                        </button>
                    </div>
                )}
            </div>

            {/* Orders Area - Grouped by Seller */}
            <div className="flex-1 overflow-y-auto p-2">
                {groupedOrders.map((group) => {
                    // Calculate stats for this group
                    const groupStats = group.orders.reduce((acc: any, order) => {
                        const status = order.order_status
                        acc[status] = (acc[status] || 0) + 1
                        return acc
                    }, {})

                    // Filter orders for display: Hide Cancel if !is_printed
                    const displayedOrders = group.orders.filter(order => {
                        const s = order.order_status.toLowerCase()
                        if ((s === 'cancel' || s === 'cancelled') && !order.is_printed) {
                            return false // Hide unprinted cancel orders
                        }
                        return true
                    })

                    if (displayedOrders.length === 0) return null // Skip empty groups after filter

                    return (
                        <div key={group.seller} className="mb-6">
                            {/* Group Header */}
                            <div className="flex items-center gap-2 mb-2 px-1 sticky top-0 z-10 bg-gray-50 dark:bg-zinc-900 py-1">
                                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide min-w-[150px]">
                                    {group.seller}
                                </h3>
                                <div className="flex flex-wrap gap-2 items-center">
                                    <span className="text-xs px-2 py-0.5 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-full text-gray-600 dark:text-gray-400 font-medium">
                                        Total: {group.orders.length}
                                    </span>
                                    {/* Per Status Counts */}
                                    {Object.entries(groupStats).map(([status, count]) => (
                                        <span key={status} className={`text-[11px] px-1.5 py-0.5 rounded border ${status === 'Pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                            status === 'Packed' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                status === 'Ready to Ship' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    (status === 'Cancel' || status === 'Cancelled') ? 'bg-red-50 text-red-700 border-red-200' :
                                                        'bg-gray-50 text-gray-600 border-gray-200'
                                            }`}>
                                            {status}: {count as number}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <Card className="dark:bg-zinc-900 dark:border-zinc-700">
                                <div className="overflow-x-auto">
                                    <table className="w-full table-fixed border-collapse">
                                        <thead className="bg-gray-50 dark:bg-zinc-800 border-b dark:border-zinc-700">
                                            <tr>
                                                <th className="px-1.5 py-1 text-left w-8">
                                                    {/* Select All for Group could go here */}
                                                </th>
                                                <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-10">SN</th>
                                                <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-22">Date</th>
                                                <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-28">Invoice</th>
                                                <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-32">Order#</th>
                                                <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-45">Customer</th>
                                                <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-64">Product</th>
                                                <th className="px-1.5 py-1 text-right text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-16">Qty</th>
                                                <th className="px-1.5 py-1 text-right text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-24">Amount</th>
                                                <th className="px-1.5 py-1 text-left text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-24">Status</th>
                                                <th className="px-1.5 py-1 text-center text-xs font-bold uppercase text-gray-900 dark:text-gray-100 w-29">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                                            {displayedOrders.map((order, idx) => (
                                                <tr
                                                    key={order.id}
                                                    className={getRowClass(order)}
                                                >
                                                    <td className="px-1.5 py-0.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedOrders.includes(order.id)}
                                                            onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                                                            className="rounded text-blue-600 focus:ring-blue-500 dark:bg-zinc-700 dark:border-zinc-600 w-3.5 h-3.5"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-sm text-gray-700 dark:text-gray-300">{idx + 1}</td>
                                                    <td className="px-1.5 py-0.5 text-sm text-gray-700 dark:text-gray-300">{new Date(order.order_date).toLocaleDateString('en-GB')}</td>
                                                    <td className="px-1.5 py-0.5">
                                                        <button
                                                            onClick={() => router.push(`/dashboard/sales/daraz/order/${order.id}`)}
                                                            onMouseEnter={() => queryClient.prefetchQuery({
                                                                queryKey: ['daraz-order', order.id],
                                                                queryFn: () => getDarazOrderById(order.id)
                                                            })}
                                                            className="text-[13px] font-mono text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer"
                                                        >
                                                            {order.invoice_number}
                                                        </button>
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-sm text-gray-700 dark:text-gray-300">
                                                        {order.order_number}
                                                        {highlightedDuplicates.includes(order.id) && (
                                                            <span className="ml-1 text-red-600 text-xs font-bold" title="Duplicate">⚠️</span>
                                                        )}
                                                    </td>
                                                    <td className={`px-1.5 py-0.5 text-sm truncate ${getCustomerClass(order.customer_name, order.order_date)}`} title={order.customer_name}>{order.customer_name}</td>
                                                    <td className={`px-1.5 py-0.5 text-sm truncate ${order.first_product_name === 'Product Not Found' ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`} title={order.first_product_name}>
                                                        {order.first_product_name}
                                                        {order.item_count > 1 && <span className="text-gray-500 dark:text-gray-400 text-xs"> +{order.item_count - 1} Product{order.item_count - 1 > 1 ? 's' : ''}</span>}
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-sm text-right text-gray-700 dark:text-gray-300">{order.total_quantity}</td>
                                                    <td className="px-1.5 py-0.5 text-sm text-right font-medium text-gray-700 dark:text-gray-300">Rs. {order.grand_total?.toLocaleString()}</td>
                                                    <td className="px-1.5 py-0.5">
                                                        <span className={`px-1 py-0.5 text-xs font-medium rounded ${getStatusColor(order.order_status)}`}>
                                                            {order.order_status}
                                                        </span>
                                                    </td>
                                                    <td className="px-1.5 py-0.5">
                                                        <div className="flex items-center justify-center gap-0.5">
                                                            <button
                                                                onClick={() => window.open(`/print/daraz-invoice/${order.id}`, '_blank')}
                                                                className={`p-0.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded ${order.is_printed ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}
                                                                title={order.is_printed ? "Printed" : "Print"}
                                                            >
                                                                <Printer size={12} />
                                                            </button>
                                                            <button
                                                                onClick={() => router.push(`/dashboard/sales/daraz/order/${order.id}`)}
                                                                onMouseEnter={() => queryClient.prefetchQuery({
                                                                    queryKey: ['daraz-order', order.id],
                                                                    queryFn: () => getDarazOrderById(order.id)
                                                                })}
                                                                className="px-1 py-0.5 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                                            >
                                                                View
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(order.id, order.order_number)}
                                                                className="px-1 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                                disabled={order.pending_deletion}
                                                            >
                                                                {order.pending_deletion ? (
                                                                    <span className="flex items-center gap-0.5 text-yellow-600">
                                                                        <Clock size={9} />
                                                                        Pending
                                                                    </span>
                                                                ) : (
                                                                    'Del'
                                                                )}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>
                    )
                })}

                {orders.length === 0 && !isLoading && !isFetching && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        No orders found. Click "Add New Order" to create one.
                    </div>
                )}

                {isLoading || isFetching && orders.length === 0 && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        Loading...
                    </div>
                )}

                {/* Global Pagination */}
                {renderPagination()}
            </div>

            {/* Modals */}
            {
                isAddModalOpen && (
                    <AddDarazOrderModal
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                    />
                )
            }

            {
                isImportModalOpen && (
                    <ImportDarazOrdersModal
                        isOpen={isImportModalOpen}
                        onClose={() => setIsImportModalOpen(false)}
                    />
                )
            }

            {/* Deletion Modals */}
            <DeletionReasonModal
                isOpen={deletionModal.isOpen}
                orderNumber={deletionModal.order?.order_number || ''}
                onClose={() => setDeletionModal({ isOpen: false, order: null })}
                onSubmit={handleUserDeletionSubmit}
                isSubmitting={isSubmittingDeletion}
            />

            <AdminDeleteConfirm
                isOpen={adminDeleteModal.isOpen}
                orderNumber={adminDeleteModal.order?.order_number || ''}
                onClose={() => setAdminDeleteModal({ isOpen: false, order: null })}
                onConfirm={handleAdminDeleteConfirm}
                isDeleting={isSubmittingDeletion}
            />




        </div >
    )
}

