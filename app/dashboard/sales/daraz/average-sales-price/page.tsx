'use client'

import React, { useState, useEffect } from 'react'
import { Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button } from '@/components/ui-shim'
import { Search, ChevronLeft, ChevronRight, Edit2, Check, X, Loader2, RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { getDarazAvgPrices, updateDarazAvgPrice, syncDarazAvgPricesGoogleSheets, pullDarazAvgPricesFromGoogleSheets, DarazAvgPriceItem } from '@/features/sales/actions/avg-price-actions'

export default function DarazAverageSalesPricePage() {
    const [data, setData] = useState<DarazAvgPriceItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSyncing, setIsSyncing] = useState(false)
    const [isPulling, setIsPulling] = useState(false)
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 50
    
    // Search
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

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
                    const commissionFactor = (item.commission_percent !== null ? item.commission_percent : 20) / 100
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
        if (!debouncedSearch) return true;
        const s = debouncedSearch.toLowerCase()
        return (item.product_name?.toLowerCase().includes(s) || item.seller_skus.some(sku => sku?.toLowerCase().includes(s)))
    })

    const totalPages = Math.ceil(filteredData.length / itemsPerPage)
    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
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
                        onClick={handleSync} 
                        disabled={isSyncing}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white h-9 px-3 text-xs whitespace-nowrap"
                    >
                        {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        <span>Sync with Sheets</span>
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 md:p-6 pb-24 md:pb-6">
                <Card className="min-h-full border-none shadow-md overflow-hidden bg-white dark:bg-zinc-900">
                    <div className="overflow-x-auto">
                        <Table className="w-full text-sm min-w-[1200px]">
                            <TableHeader className="bg-gray-50 dark:bg-zinc-800 sticky top-0 z-10 shadow-sm text-xs uppercase tracking-wider text-gray-500">
                                <TableRow>
                                    <TableHead className="w-12 text-center">S.N</TableHead>
                                    <TableHead className="w-16 text-center">Img</TableHead>
                                    <TableHead className="w-64">Product</TableHead>
                                    <TableHead className="w-48">SKUs</TableHead>
                                    <TableHead className="text-right">Purchasing</TableHead>
                                    <TableHead className="text-right">Commission</TableHead>
                                    <TableHead className="text-right text-orange-600">Breakeven</TableHead>
                                    <TableHead className="text-right text-blue-600">Regular (15%)</TableHead>
                                    <TableHead className="text-right w-32 border-l border-gray-200 dark:border-gray-700">Market Price</TableHead>
                                    <TableHead className="text-right w-32">Campaign</TableHead>
                                    <TableHead className="text-center w-24">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={12} className="h-48 text-center text-gray-500">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                                            Evaluating metrics...
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={12} className="h-24 text-center text-gray-500">
                                            No products found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((item, index) => (
                                        <TableRow key={item.product_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors group">
                                            <TableCell className="text-center text-gray-500">{((currentPage - 1) * itemsPerPage) + index + 1}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="w-10 h-10 relative bg-gray-100 dark:bg-zinc-800 rounded overflow-hidden mx-auto">
                                                    {item.image_url ? (
                                                        <Image src={item.image_url} alt="img" fill className="object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                            <div className="w-4 h-4 rounded-full border-2 border-current opacity-50" />
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-gray-900 dark:text-gray-100 truncate w-60" title={item.product_name}>{item.product_name}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs text-gray-500 font-mono flex flex-col gap-1">
                                                    {item.seller_skus.length > 0 ? (
                                                        item.seller_skus.map((sku, i) => (
                                                            <span key={i} className="truncate w-40 block" title={sku}>{sku}</span>
                                                        ))
                                                    ) : (
                                                        <span className="text-gray-400 italic">No SKUs</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-gray-700 dark:text-gray-300">
                                                <div className="flex flex-col items-end">
                                                    <span>Rs. {item.purchasing_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                                    {item.purchasing_remark && (
                                                        <span className="text-[10px] text-amber-600 dark:text-amber-500 italic font-medium">
                                                            {item.purchasing_remark}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
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
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-orange-600 dark:text-orange-400 bg-orange-50/30 dark:bg-orange-950/20">
                                                Rs. {item.breakeven_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/20">
                                                Rs. {item.regular_sales_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                            </TableCell>
                                            
                                            {/* Editable Market Price with Profit */}
                                            <TableCell className="text-right border-l border-gray-100 dark:border-zinc-800 align-top pt-3">
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
                                            </TableCell>
                                            
                                            {/* Editable Campaign Price with Profit */}
                                            <TableCell className="text-right align-top pt-3 w-32">
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
                                            </TableCell>
                                            
                                            {/* Actions */}
                                            <TableCell className="text-center">
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
                                                    <button onClick={() => startEditing(item)} className="p-1.5 text-gray-400 group-hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit Prices">
                                                        <Edit2 size={16} />
                                                    </button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
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
        </div>
    )
}
