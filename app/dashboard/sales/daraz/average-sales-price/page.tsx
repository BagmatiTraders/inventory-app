'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, Button } from '@/components/ui-shim'
import { Search, ChevronLeft, ChevronRight, Edit2, Check, X, Loader2, RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { getDarazAvgPrices, updateDarazAvgPrice, syncDarazAvgPricesGoogleSheets, pullDarazAvgPricesFromGoogleSheets, syncLiveSellerPrices, pushPriceToDaraz, DarazAvgPriceItem } from '@/features/sales/actions/avg-price-actions'

export default function DarazAverageSalesPricePage() {
    const [data, setData] = useState<DarazAvgPriceItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSyncing, setIsSyncing] = useState(false)
    const [isPulling, setIsPulling] = useState(false)
    const [isSyncingLive, setIsSyncingLive] = useState(false)
    const [pushingId, setPushingId] = useState<string | null>(null)
    const [isUpdatingStock, setIsUpdatingStock] = useState(false)
    const [showOnlyStockOut, setShowOnlyStockOut] = useState(false)
    const [stockModalProduct, setStockModalProduct] = useState<DarazAvgPriceItem | null>(null)
    const [stockEdits, setStockEdits] = useState<Record<string, number>>({}) // key: store_id:sku
    const [showLivePriceColumns, setShowLivePriceColumns] = useState(true)

    // Drag to scroll
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [startX, setStartX] = useState(0)
    const [scrollLeft, setScrollLeft] = useState(0)

    const startDrag = (e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return
        setIsDragging(true)
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft)
        setScrollLeft(scrollContainerRef.current.scrollLeft)
    }
    const stopDrag = () => setIsDragging(false)
    const onDrag = (e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return
        e.preventDefault()
        const x = e.pageX - scrollContainerRef.current.offsetLeft
        const walk = (x - startX)
        scrollContainerRef.current.scrollLeft = scrollLeft - walk
    }

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 50

    // Search
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    // Regular price profit-percent dropdown (15 / 20 / 25)
    const [regularPct, setRegularPct] = useState<15 | 20 | 25>(15)

    // Editing State (we can edit market_price and campaign_price)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editMarketPrice, setEditMarketPrice] = useState<string>('')
    const [editCampaignPrice, setEditCampaignPrice] = useState<string>('')
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500)
        return () => clearTimeout(timer)
    }, [search])

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setIsLoading(true)
        try {
            const result = await getDarazAvgPrices()
            setData(result)
        } catch (error) {
            console.error('Failed to load data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSync = async () => {
        setIsSyncing(true)
        try {
            const res = await syncDarazAvgPricesGoogleSheets()
            if (res.success) {
                alert('Successfully synced with Google Sheets!')
                loadData()
            } else {
                alert(`Sync failed: ${res.message}`)
            }
        } catch (err: any) {
            alert(`Sync error: ${err.message}`)
        } finally {
            setIsSyncing(false)
        }
    }

    const handlePull = async () => {
        setIsPulling(true)
        try {
            const res = await pullDarazAvgPricesFromGoogleSheets()
            if (res.success) {
                alert('Successfully updated data from Google Sheets!')
                loadData()
            } else {
                alert(`Pull failed: ${res.message}`)
            }
        } catch (err: any) {
            alert(`Pull error: ${err.message}`)
        } finally {
            setIsPulling(false)
        }
    }

    const handleSyncLive = async () => {
        setIsSyncingLive(true)
        try {
            const res = await syncLiveSellerPrices()
            if (res.success) {
                alert(`Successfully synced ${res.count} items from Daraz!`)
                loadData()
            } else {
                alert(`Sync failed: ${res.message}`)
            }
        } catch (err: any) {
            alert(`Sync error: ${err.message}`)
        } finally {
            setIsSyncingLive(false)
        }
    }

    const handlePushPrice = async (productId: string, productName: string) => {
        if (!confirm(`Push Daraz Price to Daraz account for "${productName}"?\nThis will set the Special Price on all linked SKUs.`)) return
        setPushingId(productId)
        try {
            const res = await pushPriceToDaraz(productId)
            if (res.success) {
                alert(`✓ Price pushed!\n${res.message}`)
            } else {
                alert(`✗ Push failed:\n${res.message}`)
            }
        } catch (err: any) {
            alert(`Push error: ${err.message}`)
        } finally {
            setPushingId(null)
        }
    }
    const openStockModal = (item: DarazAvgPriceItem) => {
        setStockModalProduct(item)
        setStockEdits({}) 
    }

    const handleUpdateStock = async (isOutOfStock: boolean) => {
        if (!stockModalProduct) return
        
        const updates: Array<{ sku: string, quantity: number, store_id: string }> = []
        
        Object.keys(stockModalProduct.live_prices || {}).forEach(sku => {
            const lp = stockModalProduct.live_prices![sku]
            const quantity = isOutOfStock ? 0 : (stockEdits[sku] ?? lp.quantity ?? 0)
            updates.push({ sku, quantity, store_id: lp.store_id })
        })
        
        if (updates.length === 0) return
        
        setIsUpdatingStock(true)
        try {
            const { pushStockToDaraz } = await import('@/features/sales/actions/avg-price-actions')
            const res = await pushStockToDaraz(stockModalProduct.product_id, updates)
            if (res.success) {
                alert(`✓ Stock updated!\n${res.message}`)
                setStockModalProduct(null)
                loadData() // Refresh to show new stock
            } else {
                alert(`✗ Update failed:\n${res.message}`)
            }
        } catch (err: any) {
            alert(`Stock update failed: ${err.message}`)
        } finally {
            setIsUpdatingStock(false)
        }
    }

    const startEditing = (item: DarazAvgPriceItem) => {
        setEditingId(item.product_id)
        setEditMarketPrice(item.market_price ? item.market_price.toString() : '')
        setEditCampaignPrice(item.campaign_price ? item.campaign_price.toString() : '')
    }

    const cancelEditing = () => {
        setEditingId(null)
    }

    const savePrices = async (productId: string) => {
        setIsSaving(true)
        try {
            const mPrice = editMarketPrice.trim() !== '' ? parseFloat(editMarketPrice) : null
            const cPrice = editCampaignPrice.trim() !== '' ? parseFloat(editCampaignPrice) : null

            if ((editMarketPrice !== '' && isNaN(mPrice as number)) || (editCampaignPrice !== '' && isNaN(cPrice as number))) {
                alert('Please enter valid numbers')
                return
            }

            await updateDarazAvgPrice(productId, { market_price: mPrice, campaign_price: cPrice })

            // Optimistic update
            setData(prev => prev.map(item => {
                if (item.product_id === productId) {
                    const commissionFactor = (item.commission_percent !== null ? item.commission_percent : 25) / 100
                    return {
                        ...item,
                        market_price: mPrice,
                        market_price_profit: mPrice ? (mPrice - (mPrice * commissionFactor) - item.purchasing_price) : null,
                        campaign_price: cPrice,
                        campaign_price_profit: cPrice ? (cPrice - (cPrice * commissionFactor) - item.purchasing_price) : null
                    }
                }
                return item
            }))

            setEditingId(null)
        } catch (error: any) {
            console.error('Failed to save prices:', error)
            alert(`Save failed: ${error.message}`)
        } finally {
            setIsSaving(false)
        }
    }

    const filteredData = data.filter(item => {
        let matches = true;
        if (debouncedSearch) {
            const s = debouncedSearch.toLowerCase()
            matches = (item.product_name?.toLowerCase().includes(s) || item.seller_skus.some(sku => sku?.toLowerCase().includes(s)))
        }
        
        if (showOnlyStockOut && matches) {
            // A product is "Stock Out" if ALL linked SKUs across all stores have 0 quantity
            const totalStock = Object.values(item.live_prices || {}).reduce((sum, lp) => sum + (lp.quantity || 0), 0)
            matches = totalStock === 0
        }
        
        return matches;
    })

    const totalPages = Math.ceil(filteredData.length / itemsPerPage)
    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 shadow-sm">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Link href="/dashboard/sales/daraz" className="p-1 hover:bg-gray-100 rounded md:hidden">
                            <ArrowLeft size={20} />
                        </Link>
                        Average Sales Price
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Calculate Breakeven and sync with Google Sheets ({data.length} items)</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative w-full md:w-64 flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by Product or SKU..."
                            className="w-full pl-9 pr-4 py-2 text-sm border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        />
                    </div>

                    <a
                        href="https://docs.google.com/spreadsheets/d/1ztKJH0rrE1Od2lXJA2f8AoQ_FQ3fmnpqQietx2ZulZE/edit"
                        target="_blank"
                        rel="noreferrer"
                        className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                    >
                        View Sheet
                    </a>

                    <Button
                        onClick={handlePull}
                        disabled={isPulling}
                        className="hidden md:flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 h-9 px-3 text-xs border border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-zinc-700 dark:text-gray-300"
                    >
                        {isPulling ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Sync by Sheet
                    </Button>

                    <Button
                        onClick={handleSyncLive}
                        disabled={isSyncingLive}
                        className="hidden md:flex items-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 h-9 px-3 text-xs border border-purple-200 transition-colors dark:bg-purple-900/20 dark:hover:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800"
                    >
                        {isSyncingLive ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Sync Live Prices
                    </Button>

                    <Button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white h-9 px-3 text-xs whitespace-nowrap"
                    >
                        {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        <span>Sync with Sheets</span>
                    </Button>

                    <Button
                        onClick={() => setShowOnlyStockOut(!showOnlyStockOut)}
                        className={`flex items-center gap-2 h-9 px-3 text-xs transition-all ${showOnlyStockOut ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300'}`}
                        title={showOnlyStockOut ? "Show All Products" : "Show Only Out of Stock"}
                    >
                        <AlertTriangle size={14} className={showOnlyStockOut ? "animate-pulse" : ""} />
                        <span className="hidden md:inline">{showOnlyStockOut ? "Showing Out of Stock" : "Filter Stock Out"}</span>
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 px-4 md:px-6 py-4 pb-0 flex flex-col overflow-hidden">
                <Card className="flex-1 border-none shadow-md overflow-hidden bg-white dark:bg-zinc-900 flex flex-col">
                    <div
                        ref={scrollContainerRef}
                        className={`flex-1 overflow-auto relative z-0 ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
                        onMouseDown={startDrag}
                        onMouseLeave={stopDrag}
                        onMouseUp={stopDrag}
                        onMouseMove={onDrag}
                    >
                        <table className="w-full text-sm min-w-[1200px] border-collapse relative">
                            <thead className="text-xs uppercase tracking-wider text-gray-500">
                                <tr className="border-b dark:border-zinc-800">
                                    <th className="w-12 text-center p-3 font-medium align-middle sticky left-0 top-0 z-40 bg-gray-50 dark:bg-zinc-800 shadow-[1px_1px_0_0_#e5e7eb] dark:shadow-[1px_1px_0_0_#27272a]">S.N</th>
                                    <th className="w-16 text-center p-3 font-medium align-middle sticky left-[48px] top-0 z-40 bg-gray-50 dark:bg-zinc-800 shadow-[1px_1px_0_0_#e5e7eb] dark:shadow-[1px_1px_0_0_#27272a]">Img</th>
                                    <th className="w-64 p-3 text-left font-medium align-middle sticky left-[112px] top-0 z-40 bg-gray-50 dark:bg-zinc-800 shadow-[1px_1px_0_0_#e5e7eb] dark:shadow-[1px_1px_0_0_#27272a]">Product</th>
                                    <th className="w-48 p-3 text-left font-medium align-middle sticky top-0 z-30 bg-gray-50 dark:bg-zinc-800 shadow-[0_1px_0_0_#e5e7eb] dark:shadow-[0_1px_0_0_#27272a]">SKUs</th>
                                    <th className="text-right p-3 text-left font-medium align-middle sticky top-0 z-30 bg-gray-50 dark:bg-zinc-800 shadow-[0_1px_0_0_#e5e7eb] dark:shadow-[0_1px_0_0_#27272a]">Purchasing</th>
                                    <th className="text-right p-3 text-left font-medium align-middle sticky top-0 z-30 bg-gray-50 dark:bg-zinc-800 shadow-[0_1px_0_0_#e5e7eb] dark:shadow-[0_1px_0_0_#27272a]">Commission</th>
                                    <th className="text-right text-orange-600 p-3 text-left font-medium align-middle sticky top-0 z-30 bg-gray-50 dark:bg-zinc-800 shadow-[0_1px_0_0_#e5e7eb] dark:shadow-[0_1px_0_0_#27272a]">Breakeven</th>

                                    {/* Toggle Live Prices Button */}
                                    <th className="p-3 bg-gray-50 dark:bg-zinc-800 sticky top-0 z-30 align-middle w-10">
                                        <button 
                                            onClick={() => setShowLivePriceColumns(!showLivePriceColumns)}
                                            className={`p-1.5 rounded-full transition-all ${showLivePriceColumns ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}
                                            title={showLivePriceColumns ? "Hide Store Prices" : "Show Store Prices"}
                                        >
                                            {showLivePriceColumns ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                                        </button>
                                    </th>

                                    {/* 4 Fixed Live Price Columns */}
                                    {showLivePriceColumns && [1, 2, 3, 4].map(idx => (
                                        <th key={idx} className="text-right text-purple-600 whitespace-nowrap min-w-[120px] border-l border-gray-200 dark:border-gray-700 bg-purple-50/50 dark:bg-purple-900/20 p-3 font-medium align-middle sticky top-0 z-30 bg-gray-50 dark:bg-zinc-800 shadow-sm border-b dark:border-zinc-800">
                                            Live Price {idx}
                                        </th>
                                    ))}

                                    <th className="text-right text-blue-600 min-w-[140px] p-3 text-left font-medium align-middle sticky top-0 z-30 bg-gray-50 dark:bg-zinc-800 shadow-[0_1px_0_0_#e5e7eb] dark:shadow-[0_1px_0_0_#27272a]">
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Regular</span>
                                            <select
                                                value={regularPct}
                                                onChange={(e) => setRegularPct(Number(e.target.value) as 15 | 20 | 25)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="ml-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-300"
                                            >
                                                <option value={15}>15%</option>
                                                <option value={20}>20%</option>
                                                <option value={25}>25%</option>
                                            </select>
                                        </div>
                                    </th>
                                    <th className="text-right w-32 border-l border-gray-200 dark:border-gray-700 p-3 text-left font-medium align-middle sticky top-0 z-30 bg-gray-50 dark:bg-zinc-800 shadow-[0_1px_0_0_#e5e7eb] dark:shadow-[0_1px_0_0_#27272a]">Daraz Price</th>
                                    <th className="text-right w-32 p-3 text-left font-medium align-middle sticky top-0 z-30 bg-gray-50 dark:bg-zinc-800 shadow-[0_1px_0_0_#e5e7eb] dark:shadow-[0_1px_0_0_#27272a]">Campaign</th>
                                    <th className="text-center w-24 p-3 text-left font-medium align-middle sticky top-0 z-30 bg-gray-50 dark:bg-zinc-800 shadow-[0_1px_0_0_#e5e7eb] dark:shadow-[0_1px_0_0_#27272a]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr className="border-b dark:border-zinc-800">
                                        <td colSpan={12} className="h-48 text-center text-gray-500 p-4 align-middle">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                                            Evaluating metrics...
                                        </td>
                                    </tr>
                                ) : paginatedData.length === 0 ? (
                                    <tr className="border-b dark:border-zinc-800">
                                        <td colSpan={12} className="h-24 text-center text-gray-500 p-4 align-middle">
                                            No products found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((item, index) => {
                                        const isHighlight = (() => {
                                            if (!item.market_price) return false;
                                            const liveSkus = [item.seller_sku1, item.seller_sku2, item.seller_sku3, item.seller_sku4];
                                            for (const sku of liveSkus) {
                                                if (!sku) continue;
                                                const liveDet = item.live_prices?.[sku];
                                                if (liveDet) {
                                                    const activePrice = liveDet.special_price || liveDet.price;
                                                    const diff = Math.abs(activePrice - item.market_price) / item.market_price;
                                                    if (diff > 0.05) return true;
                                                }
                                            }
                                            return false;
                                        })();

                                        return (
                                            <tr key={item.product_id} className={`transition-colors group ${isHighlight ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 border-l-4 border-l-red-500' : 'hover:bg-gray-50 dark:hover:bg-zinc-800'}`}>
                                                <td className="text-center text-gray-500 p-4 align-middle sticky left-0 z-20 bg-white dark:bg-zinc-900 border-r dark:border-zinc-800">{((currentPage - 1) * itemsPerPage) + index + 1}</td>
                                                <td className="text-center p-4 align-middle sticky left-[48px] z-20 bg-white dark:bg-zinc-900 border-r dark:border-zinc-800">
                                                    <div className="w-10 h-10 relative bg-gray-100 dark:bg-zinc-800 rounded overflow-hidden mx-auto">
                                                        {item.image_url ? (
                                                            <Image src={item.image_url} alt="img" fill className="object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                                <div className="w-4 h-4 rounded-full border-2 border-current opacity-50" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle sticky left-[112px] z-20 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 border-r dark:border-zinc-800 group-hover:bg-gray-50 dark:group-hover:bg-zinc-800 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]">
                                                    {(() => {
                                                        const totalStock = Object.values(item.live_prices || {}).reduce((sum, lp) => sum + (lp.quantity || 0), 0)
                                                        const isOutOfStock = totalStock === 0 && Object.keys(item.live_prices || {}).length > 0;
                                                        return (
                                                            <div className={`font-medium truncate w-60 ${isOutOfStock ? 'text-red-800 dark:text-red-400 font-bold' : 'text-gray-900 dark:text-gray-100'}`} title={item.product_name}>
                                                                {item.product_name}
                                                                {isOutOfStock && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">OUT</span>}
                                                            </div>
                                                        )
                                                    })()}
                                                </td>
                                                <td className="p-4 align-middle">
                                                    <div className="text-xs text-gray-500 font-mono flex flex-col gap-1">
                                                        {item.seller_skus.length > 0 ? (
                                                            item.seller_skus.map((sku, i) => (
                                                                <span key={i} className="truncate w-40 block" title={sku}>{sku}</span>
                                                            ))
                                                        ) : (
                                                            <span className="text-gray-400 italic">No SKUs</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-right font-medium text-gray-700 dark:text-gray-300 p-4 align-middle">
                                                    <div className="flex flex-col items-end">
                                                        <span>Rs. {item.purchasing_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                                        {item.purchasing_remark && (
                                                            <span className="text-[10px] text-amber-600 dark:text-amber-500 italic font-medium">
                                                                {item.purchasing_remark}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-right p-4 align-middle">
                                                    {item.is_default_commission ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium border border-amber-200 text-xs" title="Estimated Default Commission">
                                                            {item.commission_percent?.toFixed(2)}% (Default)
                                                        </span>
                                                    ) : item.commission_percent !== null ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-50 text-red-700 font-medium border border-red-100 text-xs">
                                                            {item.commission_percent.toFixed(2)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs italic">No orders</span>
                                                    )}
                                                </td>
                                                <td className="text-right font-bold text-orange-600 dark:text-orange-400 bg-orange-50/30 dark:bg-orange-950/20 p-4 align-middle">
                                                    Rs. {item.breakeven_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </td>

                                                {/* Filler for Toggle Column */}
                                                <td className="w-10 bg-white dark:bg-zinc-900 border-r dark:border-zinc-800"></td>

                                                {/* 4 Fixed Live Price Cells */}
                                                {showLivePriceColumns && [item.seller_sku1, item.seller_sku2, item.seller_sku3, item.seller_sku4].map((sku, idx) => {
                                                    const liveDetails = sku ? item.live_prices?.[sku] : null;
                                                    if (!liveDetails) {
                                                        return <td key={idx} className="text-right border-l border-gray-100 dark:border-zinc-800 pt-3 bg-purple-50/10 dark:bg-purple-900/10 text-gray-300 dark:text-gray-600 p-4 align-middle">-</td>
                                                    }
                                                    const sellingPrice = liveDetails.special_price || liveDetails.price;
                                                    const regularPrice = liveDetails.special_price ? liveDetails.price : null;

                                                    return (
                                                        <td key={idx} className="text-right border-l border-gray-100 dark:border-zinc-800 align-top pt-3 bg-purple-50/10 dark:bg-purple-900/10 p-4 align-middle">
                                                            <div className="flex flex-col items-end gap-0.5">
                                                                <span className="font-bold text-purple-900 dark:text-purple-100 whitespace-nowrap">
                                                                    Rs. {sellingPrice.toLocaleString()}
                                                                </span>
                                                                {regularPrice && (
                                                                    <span className="text-[10px] text-gray-500 line-through font-medium whitespace-nowrap">
                                                                        Rs. {regularPrice.toLocaleString()}
                                                                    </span>
                                                                )}

                                                                {(() => {
                                                                    const storeAlias = { 'Bagmati Online': 'Bagmati', 'Ram': 'Balaju', 'Lamichhane Suppliers': 'Cosmetics', 'Bagmati Traders': 'BTAS' }[liveDetails.store_name] || liveDetails.store_name;
                                                                    const colorClass = {
                                                                        'Bagmati': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800',
                                                                        'Balaju': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
                                                                        'Cosmetics': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-400 dark:border-fuchsia-800',
                                                                        'BTAS': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                                                                    }[storeAlias] || 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-gray-400 dark:border-gray-700';
                                                                    return (
                                                                        <span className={`text-[9.5px] font-bold uppercase tracking-wider mt-1 border px-1.5 py-0.5 rounded shadow-sm ${colorClass}`} title={sku || ''}>
                                                                            {storeAlias}
                                                                        </span>
                                                                    );
                                                                })()}

                                                            </div>
                                                        </td>
                                                    )
                                                })}

                                                <td className="text-right font-bold text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/20 p-4 align-middle">
                                                    {(() => {
                                                        const commPct = item.commission_percent !== null ? item.commission_percent : 25
                                                        const breakeven = item.purchasing_price / (1 - commPct / 100)
                                                        const rawReg = breakeven * (1 + regularPct / 100)
                                                        const reg = Math.ceil(rawReg / 5) * 5
                                                        return `Rs. ${reg.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                                                    })()}
                                                </td>

                                                {/* Editable Daraz Price with Profit */}
                                                <td className="text-right border-l border-gray-100 dark:border-zinc-800 align-top pt-3 p-4 align-middle">
                                                    {editingId === item.product_id ? (
                                                        <input
                                                            type="number"
                                                            value={editMarketPrice}
                                                            onChange={(e) => setEditMarketPrice(e.target.value)}
                                                            className="w-20 px-2 py-1 text-right text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <span className="font-bold text-gray-900 dark:text-gray-100">
                                                                {item.market_price ? `Rs. ${item.market_price.toLocaleString()}` : '-'}
                                                            </span>
                                                            {item.market_price_profit !== null && (
                                                                <span className={`text-[11px] font-semibold tracking-wide ${item.market_price_profit > 0 ? "text-green-600" : "text-red-500"}`}>
                                                                    {item.market_price_profit > 0 ? '+' : ''}Rs. {item.market_price_profit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Editable Campaign Price with Profit */}
                                                <td className="text-right align-top pt-3 w-32 p-4 align-middle">
                                                    {editingId === item.product_id ? (
                                                        <input
                                                            type="number"
                                                            value={editCampaignPrice}
                                                            onChange={(e) => setEditCampaignPrice(e.target.value)}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') savePrices(item.product_id) }}
                                                            className="w-20 px-2 py-1 text-right text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <span className="font-bold text-gray-900 dark:text-gray-100">
                                                                {item.campaign_price ? `Rs. ${item.campaign_price.toLocaleString()}` : '-'}
                                                            </span>
                                                            {item.campaign_price_profit !== null && (
                                                                <span className={`text-[11px] font-semibold tracking-wide ${item.campaign_price_profit > 0 ? "text-green-600" : "text-red-500"}`}>
                                                                    {item.campaign_price_profit > 0 ? '+' : ''}Rs. {item.campaign_price_profit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="text-center p-4 align-middle">
                                                    {editingId === item.product_id ? (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => savePrices(item.product_id)} disabled={isSaving} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                                                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                            </button>
                                                            <button onClick={cancelEditing} disabled={isSaving} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => startEditing(item)} className="p-1.5 text-gray-400 group-hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit Prices">
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handlePushPrice(item.product_id, item.product_name)}
                                                                disabled={pushingId === item.product_id}
                                                                className="p-1.5 text-gray-400 group-hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                                                                title={item.market_price && item.market_price > 0 ? `Push Rs. ${item.market_price.toLocaleString()} to Daraz` : 'Set a Daraz Price first'}
                                                            >
                                                                {pushingId === item.product_id ? <Loader2 size={16} className="animate-spin text-green-600" /> : <RefreshCw size={16} />}
                                                            </button>
                                                            <button
                                                                onClick={() => openStockModal(item)}
                                                                className="p-1.5 text-gray-400 group-hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                                                title="Manage Stock"
                                                            >
                                                                <AlertTriangle size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* Pagination controls */}
            {!isLoading && filteredData.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 px-4 py-3 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sticky bottom-0 z-20">
                    <div className="text-sm text-gray-500">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline" size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft size={16} />
                        </Button>
                        <span className="text-sm px-2">Page {currentPage} of {totalPages}</span>
                        <Button
                            variant="outline" size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight size={16} />
                        </Button>
                    </div>
                </div>
            )}

            {/* Stock Management Modal */}
            {stockModalProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-lg bg-white dark:bg-zinc-900 shadow-2xl border-none">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        <AlertTriangle className="text-amber-500" size={24} />
                                        Stock Management
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stockModalProduct.product_name}</p>
                                </div>
                                <button onClick={() => setStockModalProduct(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                {Object.keys(stockModalProduct.live_prices || {}).length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 italic bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-dashed border-gray-200 dark:border-zinc-700">
                                        No live SKUs found for this product. Sync live prices first.
                                    </div>
                                ) : (
                                    Object.keys(stockModalProduct.live_prices!).map(sku => {
                                        const lp = stockModalProduct.live_prices![sku];
                                        return (
                                            <div key={sku} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-800 group hover:border-blue-200 dark:hover:border-blue-900 transition-colors">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                            {lp.store_name}
                                                        </span>
                                                        <span className="text-xs font-mono text-gray-400 truncate" title={sku}>{sku}</span>
                                                    </div>
                                                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                        Current: <span className={lp.quantity === 0 ? "text-red-500" : "text-green-600"}>{lp.quantity || 0}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={stockEdits[sku] ?? (lp.quantity || 0)}
                                                        onChange={(e) => setStockEdits(prev => ({ ...prev, [sku]: parseInt(e.target.value) || 0 }))}
                                                        className="w-20 px-3 py-2 text-right bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="mt-8 flex flex-col gap-3">
                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => handleUpdateStock(true)}
                                        disabled={isUpdatingStock || Object.keys(stockModalProduct.live_prices || {}).length === 0}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-11"
                                    >
                                        {isUpdatingStock ? <Loader2 size={18} className="animate-spin" /> : "Out of Stock (Zero All)"}
                                    </Button>
                                    <Button
                                        onClick={() => handleUpdateStock(false)}
                                        disabled={isUpdatingStock || Object.keys(stockModalProduct.live_prices || {}).length === 0}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-11"
                                    >
                                        {isUpdatingStock ? <Loader2 size={18} className="animate-spin" /> : "Apply Stock"}
                                    </Button>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => setStockModalProduct(null)}
                                    className="w-full border-gray-200 dark:border-zinc-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    )
}
