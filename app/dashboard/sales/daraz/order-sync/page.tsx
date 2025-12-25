'use client'

import { useState, useEffect, useMemo } from 'react'
import { useOnlineStores } from '@/features/settings/hooks/useStores'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui-shim'
import { RefreshCw, ArrowLeft, Store, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

function OrderSyncPageContent() {
    const { data: stores, isLoading } = useOnlineStores()
    const searchParams = useSearchParams()
    const router = useRouter()
    const [syncedOrders, setSyncedOrders] = useState<any[]>([])
    const [isAutoSync, setIsAutoSync] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [isSyncingGlobal, setIsSyncingGlobal] = useState(false)

    // Load initial data (Local Storage & DB Orders)
    useEffect(() => {
        const savedAutoSync = localStorage.getItem('daraz_auto_sync')
        if (savedAutoSync === 'true') {
            setIsAutoSync(true)
        }

        // Initialize lastUpdated from localStorage if available
        const lastSyncTime = localStorage.getItem('daraz_last_sync_time')
        if (lastSyncTime) {
            setLastUpdated(new Date(parseInt(lastSyncTime)))
        }

        if (stores && stores.length > 0) {
            syncAllStores('db')
        }
    }, [stores])

    // Save auto-sync preference
    useEffect(() => {
        localStorage.setItem('daraz_auto_sync', String(isAutoSync))
    }, [isAutoSync])

    useEffect(() => {
        if (searchParams.get('status') === 'success') {
            toast.success('Daraz store connected successfully!', { description: 'You can now sync orders.' })
            router.replace('/dashboard/sales/daraz/order-sync')
        }
    }, [searchParams, router])

    const mergeOrders = (newOrders: any[]) => {
        setSyncedOrders(prev => {
            // Force string ID to prevent duplicate (number vs string)
            const orderMap = new Map(prev.map(o => [String(o.order_id), o]))
            newOrders.forEach(order => {
                orderMap.set(String(order.order_id), order)
            })
            // Initial sort by date desc for raw list
            return Array.from(orderMap.values()).sort((a: any, b: any) => {
                const dateA = new Date(a.daraz_created_at || a.created_at).getTime()
                const dateB = new Date(b.daraz_created_at || b.created_at).getTime()
                return dateB - dateA
            })
        })
    }

    const syncAllStores = async (source: 'api' | 'db' = 'api') => {
        if (!stores || stores.length === 0) return

        setIsSyncingGlobal(true)
        let totalNewOrders = 0

        for (const store of stores) {
            try {
                const url = `/api/daraz/orders?storeId=${store.id}${source === 'db' ? '&source=db' : ''}`
                const response = await fetch(url)
                if (response.ok) {
                    const data = await response.json()

                    if (data.dbSave && !data.dbSave.success && data.dbSave.error) {
                        toast.error('Failed to save orders to database', {
                            description: `Error: ${data.dbSave.error.message || JSON.stringify(data.dbSave.error)}`
                        })
                    }

                    const orders = data.orders || []
                    mergeOrders(orders)
                    totalNewOrders += orders.length
                }
            } catch (error) {
                console.error(`Failed to sync store ${store.seller_account}:`, error)
            }
        }

        // Only update lastUpdated and localStorage for actual API syncs, not DB loads
        if (source === 'api') {
            setLastUpdated(new Date())
            localStorage.setItem('daraz_last_sync_time', String(Date.now()))
        }

        setIsSyncingGlobal(false)
        return totalNewOrders
    }

    // Auto-sync effect
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (isAutoSync && stores && stores.length > 0) {
            // Rule: Only auto-sync if last sync was > 5 minutes ago
            const lastSync = localStorage.getItem('daraz_last_sync_time')
            const now = Date.now()
            const fiveMinutes = 5 * 60 * 1000

            const timeSinceLastSync = lastSync ? (now - parseInt(lastSync)) : Infinity
            const shouldAutoSync = timeSinceLastSync > fiveMinutes

            if (shouldAutoSync) {
                console.log('Auto-sync triggered on page load (last sync was', Math.round(timeSinceLastSync / 60000), 'minutes ago)')
                syncAllStores('api')
                localStorage.setItem('daraz_last_sync_time', String(now))
            } else {
                const minutesRemaining = Math.ceil((fiveMinutes - timeSinceLastSync) / 60000)
                console.log(`Auto-sync skipped: Last sync was ${Math.round(timeSinceLastSync / 60000)} minutes ago. Next auto-sync in ${minutesRemaining} minutes.`)
            }

            // Set up interval for future syncs (every 5 minutes)
            interval = setInterval(() => {
                const currentNow = Date.now()
                const currentLastSync = localStorage.getItem('daraz_last_sync_time')
                const currentTimeSince = currentLastSync ? (currentNow - parseInt(currentLastSync)) : Infinity

                if (currentTimeSince > fiveMinutes) {
                    console.log('Interval auto-sync triggered')
                    syncAllStores('api')
                    localStorage.setItem('daraz_last_sync_time', String(currentNow))
                }
            }, fiveMinutes) // Check every 5 minutes
        }

        return () => { if (interval) clearInterval(interval) }
    }, [isAutoSync, stores])

    // Grouping and Sorting Logic
    const groupedOrders = useMemo(() => {
        if (!syncedOrders.length) return {}

        // 1. Sort by Status Priority (Pending > Packed > Shipped > Delivered > Cancelled)
        const statusPriority: Record<string, number> = {
            'pending': 1,
            'packed': 2,
            'ready_to_ship': 2, // Map to packed equivalent
            'shipped': 3,
            'delivered': 4,
            'canceled': 5,
            'failed': 5,
            'returned': 5
        }

        const getStatusRank = (o: any) => {
            const s = (o.statuses?.[0] || o.status || 'pending').toLowerCase()
            return statusPriority[s] || 6
        }

        // 2. Group by Date
        const groups: Record<string, any[]> = {}

        syncedOrders.forEach(order => {
            const dateObj = new Date(order.daraz_created_at || order.created_at)
            const dateKey = dateObj.toLocaleDateString('en-CA') // YYYY-MM-DD
            if (!groups[dateKey]) groups[dateKey] = []
            groups[dateKey].push(order)
        })

        // 3. Sort within groups by Status Priority
        Object.keys(groups).forEach(date => {
            groups[date].sort((a, b) => getStatusRank(a) - getStatusRank(b))
        })

        // 4. Return stored sorted by Date Key Descending
        return Object.keys(groups)
            .sort((a, b) => b.localeCompare(a))
            .reduce((obj, key) => {
                obj[key] = groups[key]
                return obj
            }, {} as Record<string, any[]>)
    }, [syncedOrders])

    // Helper to get store name
    const getStoreName = (storeId: string) => {
        const store = stores?.find((s: any) => s.id === storeId)
        return store?.seller_account || 'Unknown Store'
    }

    // 5. Compute Status Summary for Top Bar
    const statusSummary = useMemo(() => {
        const summary: Record<string, number> = {
            'Pending': 0,
            'Packed': 0,
            'Ready to Ship': 0,
            'Shipped': 0
        }

        const byStore: Record<string, Record<string, number>> = {}

        syncedOrders.forEach(o => {
            const rawStatus = o.statuses?.[0] || o.status || 'pending'
            let statusKey = ''
            if (rawStatus.toLowerCase() === 'pending') statusKey = 'Pending'
            else if (rawStatus.toLowerCase() === 'packed') statusKey = 'Packed'
            else if (rawStatus.toLowerCase() === 'ready_to_ship') statusKey = 'Ready to Ship'
            else if (rawStatus.toLowerCase() === 'shipped') statusKey = 'Shipped'

            if (statusKey) {
                summary[statusKey] = (summary[statusKey] || 0) + 1
                const storeName = getStoreName(o.store_id)
                if (!byStore[storeName]) byStore[storeName] = {}
                byStore[storeName][statusKey] = (byStore[storeName][statusKey] || 0) + 1
            }
        })

        return { total: summary, byStore }
    }, [syncedOrders, stores])

    return (
        <div className="space-y-6">
            {/* Compact Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-[17px] font-bold">Daraz Order sync</h1>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">Sync orders from your connected Daraz stores</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Auto Sync Toggle */}
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 px-2 py-1 rounded border border-gray-200 dark:border-zinc-700">
                            <div className="flex items-center gap-1.5">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isAutoSync ? 'bg-green-400' : 'hidden'}`}></span>
                                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isAutoSync ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                                </span>
                                <span className="text-[13px] font-medium">Auto Sync (5m)</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={isAutoSync}
                                    onChange={(e) => setIsAutoSync(e.target.checked)}
                                />
                                <div className="w-7 h-3.5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                            </label>
                        </div>

                        <Link
                            href="/dashboard/sales/daraz"
                            className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                        >
                            <ArrowLeft size={12} />
                            Back to Menu
                        </Link>
                    </div>
                </div>

                {/* Status Summary Bar */}
                {Object.keys(statusSummary.byStore).length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] pt-1 border-t dark:border-zinc-800">
                        {Object.entries(statusSummary.byStore).map(([storeName, counts]) => (
                            <div key={storeName} className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800/50 px-2 py-0.5 rounded border border-gray-100 dark:border-zinc-800">
                                <span className="font-bold text-gray-700 dark:text-gray-300">{storeName}:</span>
                                <div className="flex gap-2 text-gray-500 dark:text-gray-400">
                                    {counts['Pending'] > 0 && <span className="text-yellow-600 dark:text-yellow-500">Pending: {counts['Pending']}</span>}
                                    {counts['Ready to Ship'] > 0 && <span className="text-blue-600 dark:text-blue-500">RTS: {counts['Ready to Ship']}</span>}
                                    {counts['Packed'] > 0 && <span className="text-indigo-600 dark:text-indigo-500">Packed: {counts['Packed']}</span>}
                                    {counts['Shipped'] > 0 && <span className="text-green-600 dark:text-green-500">Shipped: {counts['Shipped']}</span>}
                                    {!counts['Pending'] && !counts['Ready to Ship'] && !counts['Packed'] && !counts['Shipped'] && <span>No active orders</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-2 space-y-4">
                {/* Store Cards */}
                <Card>
                    <CardHeader className="px-4 py-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-[17px]">Available Stores</CardTitle>
                            {lastUpdated && (
                                <span className="text-[13px] text-muted-foreground">
                                    Last synced: {lastUpdated.toLocaleTimeString()}
                                </span>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        {isLoading ? (
                            <div className="flex justify-center p-4">
                                <RefreshCw className="animate-spin text-gray-400" size={24} />
                            </div>
                        ) : stores && stores.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {stores.map((store: any) => (
                                    <StoreCard key={store.id} store={store} onSyncSuccess={mergeOrders} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground text-[15px]">
                                <p>No online stores found.</p>
                                <Link href="/dashboard/settings/store-settings" className="text-blue-600 hover:underline mt-1 inline-block">
                                    Add a store in Settings
                                </Link>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Orders Table - Grouped by Date */}
                {Object.keys(groupedOrders).length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-[15px] font-bold text-gray-500 uppercase tracking-wider">Synced Orders</h2>

                        {Object.entries(groupedOrders).map(([date, orders]: [string, any[]], groupIndex) => (
                            <Card key={date} className="overflow-hidden border border-gray-200 dark:border-zinc-800">
                                <div className="bg-gray-50 dark:bg-zinc-800/50 px-3 py-1.5 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                                    <span className="font-bold text-sm">{date}</span>
                                    <span className="text-[13px] text-muted-foreground">{orders.length} Orders</span>
                                </div>

                                <div className="relative overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 dark:bg-zinc-800">
                                            <tr>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600 w-8">S.N</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600">Order #</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600">Store</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600">Date</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600">Receiver</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600">Tracking</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600">SKUs</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600 text-right">Amount</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600 text-center">Qty</th>
                                                <th className="px-2 py-1 text-xs font-bold uppercase text-gray-600 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                            {orders.map((order: any, index: number) => {
                                                const rawStatus = (order.statuses?.[0] || order.status || 'pending').toLowerCase()
                                                const skus = order.items_detail?.map((i: any) => i.sku || i.shop_sku || 'N/A').join(', ') || '-'

                                                let displayStatus = 'Pending'
                                                let statusColor = 'bg-gray-100 text-gray-800'

                                                if (['pending'].includes(rawStatus)) {
                                                    displayStatus = 'Pending'
                                                    statusColor = 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                                }
                                                else if (['packed'].includes(rawStatus)) {
                                                    displayStatus = 'Packed'
                                                    statusColor = 'bg-blue-50 text-blue-700 border border-blue-200'
                                                }
                                                else if (['ready_to_ship'].includes(rawStatus)) {
                                                    displayStatus = 'Ready to Ship'
                                                    statusColor = 'bg-green-50 text-green-700 border border-green-200' // Visual match to Sales Entry (Green)
                                                }
                                                else if (['shipped'].includes(rawStatus)) {
                                                    displayStatus = 'Shipped'
                                                    statusColor = 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                }
                                                else if (['delivered', 'completed'].includes(rawStatus)) {
                                                    displayStatus = 'Delivered'
                                                    statusColor = 'bg-green-50 text-green-700 border border-green-200'
                                                }
                                                else if (['canceled', 'cancelled'].includes(rawStatus)) {
                                                    displayStatus = 'Cancel'
                                                    statusColor = 'bg-red-50 text-red-700 border border-red-200'
                                                }
                                                else if (['failed', 'failed delivery'].includes(rawStatus)) {
                                                    displayStatus = 'Failed Delivery'
                                                    statusColor = 'bg-red-50 text-red-700 border border-red-200'
                                                }
                                                else if (['returned', 'customer return'].includes(rawStatus)) {
                                                    displayStatus = 'Returned'
                                                    statusColor = 'bg-orange-50 text-orange-700 border border-orange-200'
                                                }

                                                return (
                                                    <tr key={order.order_id} className="bg-white hover:bg-gray-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/50">
                                                        <td className="px-2 py-1 text-[13px] text-gray-500">
                                                            {index + 1}
                                                        </td>
                                                        <td className={`px-2 py-1 text-[13px] font-medium ${order.invoice_number ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'text-blue-600'}`}>
                                                            <Link href={`/dashboard/sales/daraz/order-sync/${order.order_number}`} className="hover:underline flex items-center gap-1">
                                                                {order.order_number}
                                                                {order.invoice_number && <span className="text-[11px] px-1 bg-green-200 dark:bg-green-800 rounded">SYNCED</span>}
                                                            </Link>
                                                        </td>
                                                        <td className="px-2 py-1 text-[13px]">
                                                            {getStoreName(order.store_id)}
                                                        </td>
                                                        <td className="px-2 py-1 text-[13px] text-gray-500">
                                                            {new Date(order.daraz_created_at || order.created_at).toLocaleString()}
                                                        </td>
                                                        <td className="px-2 py-1 text-[13px] font-medium">
                                                            {order.shipping_name || `${order.customer_first_name} ${order.customer_last_name}`}
                                                        </td>
                                                        <td className="px-2 py-1 text-[13px] font-mono text-gray-500">
                                                            {order.tracking_code || '-'}
                                                        </td>
                                                        <td className="px-2 py-1 text-[13px] text-gray-500 max-w-[150px] truncate" title={skus}>
                                                            {skus}
                                                        </td>
                                                        <td className="px-2 py-1 text-[13px] text-right font-mono">
                                                            {order.price}
                                                        </td>
                                                        <td className="px-2 py-1 text-[13px] text-center">
                                                            {order.items_count}
                                                        </td>
                                                        <td className="px-2 py-1 text-center">
                                                            <span className={`px-1.5 py-0.5 rounded text-xs uppercase font-bold tracking-wider ${statusColor}`}>
                                                                {displayStatus}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>

    )
}

export default function OrderSyncPage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
            <OrderSyncPageContent />
        </Suspense>
    )
}

function StoreCard({ store, onSyncSuccess }: { store: any, onSyncSuccess: (orders: any[]) => void }) {
    const [status, setStatus] = useState<'idle' | 'linking' | 'syncing' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState('')

    const handleConnect = async () => {
        try {
            setStatus('linking')
            const response = await fetch(`/api/daraz/auth/url?storeId=${store.id}`)
            const data = await response.json()
            if (data.url) {
                window.location.href = data.url
            } else {
                throw new Error('Failed to get auth URL')
            }
        } catch (error) {
            console.error(error)
            setStatus('error')
            setMessage('Failed to initiate connection')
        }
    }

    const handleSync = async () => {
        try {
            setStatus('syncing')
            setMessage('')
            const response = await fetch(`/api/daraz/orders?storeId=${store.id}`)

            if (response.status === 401) {
                setMessage('Please connect first')
                setStatus('error')
                return
            }

            const data = await response.json()

            if (data.error) {
                throw new Error(data.error)
            }

            console.log('Orders:', data)

            // Check for DB Save Error
            if (data.dbSave && !data.dbSave.success && data.dbSave.error) {
                toast.error('Sync partly failed', {
                    description: 'Orders fetched but failed to save to database.'
                })
            }

            const orders = data.orders || []
            onSyncSuccess(orders)

            setStatus('success')
            setMessage(`Fetched ${data.count || orders.length} orders`)
        } catch (error: any) {
            console.error(error)
            setStatus('error')
            setMessage(error.message || 'Sync failed')
        }
    }

    return (
        <div className="flex flex-col gap-3 p-4 border rounded-lg bg-white dark:bg-zinc-900 shadow-sm border-gray-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                    <Store size={24} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[17px] truncate" title={store.seller_account}>{store.seller_account}</div>
                    <div className="text-[15px] text-muted-foreground truncate">{store.company_name}</div>
                </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
                <Button
                    onClick={handleConnect}
                    variant="outline"
                    size="sm"
                    className="w-full text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50"
                    disabled={status === 'linking'}
                >
                    {status === 'linking' ? 'Redirecting...' : 'Connect / Re-Auth'}
                </Button>

                <Button
                    onClick={handleSync}
                    variant="default"
                    size="sm"
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                    disabled={status === 'syncing' || status === 'linking'}
                >
                    {status === 'syncing' ? (
                        <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                    ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync Orders
                </Button>
            </div>

            {message && (
                <div className={`text-[15px] text-center mt-1 ${status === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                    {message}
                </div>
            )}
        </div>
    )
}

