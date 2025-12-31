'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getStoreSales, createStoreSale, deleteStoreSale } from '@/features/sales/actions/store-sales-actions'
import { getProducts } from '@/features/inventory/actions/product-actions'
import { Search, Plus, TrendingUp, ArrowLeft, X, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { Card, Button } from '@/components/ui-shim'
import { toast } from 'sonner'

interface SaleItem {
    product_id: string
    product_name: string
    product_code: string
    qty: number
    amount: number
}

export default function StoreSalesPage() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [viewSaleId, setViewSaleId] = useState<string | null>(null)

    const queryClient = useQueryClient()

    // Fetch sales
    const { data, isLoading } = useQuery({
        queryKey: ['store-sales', page, search],
        queryFn: () => getStoreSales({ page, limit: 20, search })
    })

    const sales = (data as any)?.sales || []
    const pagination = (data as any)?.pagination

    const handleSearch = () => {
        setSearch(searchInput)
        setPage(1)
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setSearch('')
        setPage(1)
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-NP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const formatCurrency = (amount: number) => {
        return `Rs. ${amount.toLocaleString('en-IN')}`
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-gray-100 dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 flex items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Store Sales</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Manage retail store sales</p>
                </div>
                <Link
                    href="/dashboard/sales"
                    className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 rounded transition-colors"
                >
                    <ArrowLeft size={12} />
                    Back to Sales
                </Link>
            </div>

            {/* Action Bar */}
            <div className="sticky top-[44px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px] max-w-sm">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                            <input
                                type="text"
                                placeholder="Search customer name..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full pl-6 pr-6 py-1 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-50"
                            />
                            {searchInput && (
                                <button
                                    onClick={handleClearSearch}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                        <Plus size={12} />
                        Add Sales
                    </button>
                    <Link
                        href="/dashboard/sales/store-sales/report"
                        className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                        <TrendingUp size={12} />
                        Sales Report
                    </Link>
                </div>
            </div>

            {/* Sales Table */}
            <div className="flex-1 overflow-auto px-3 py-3">
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-800 dark:bg-zinc-800 text-white shadow-md">
                                <tr>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase w-10">S.N</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase">Date</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase">Customer</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase">Product Name</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-right">Qty</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-right">Amount</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-right">Total</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase">Payment</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            Loading sales...
                                        </td>
                                    </tr>
                                ) : sales.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            No sales found. {search && 'Try a different search term or '}
                                            <button className="text-blue-600 hover:underline" onClick={() => setIsAddModalOpen(true)}>add your first sale</button>.
                                        </td>
                                    </tr>
                                ) : (
                                    sales.map((sale: any, index: number) => {
                                        // Flatten items for display (show first item, or combined)
                                        const items = sale.items || []
                                        const totalQty = items.reduce((sum: number, i: any) => sum + i.qty, 0)
                                        const productNames = items.map((i: any) => i.product_name).join(', ')

                                        return (
                                            <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-2 py-1.5 text-[13px] text-gray-500">
                                                    {(page - 1) * 20 + index + 1}
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px]">
                                                    {formatDate(sale.sale_date)}
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px]">
                                                    {sale.customer_name}
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px]">
                                                    <div className="max-w-[200px] truncate" title={productNames}>
                                                        {productNames || '-'}
                                                    </div>
                                                    {items.length > 1 && (
                                                        <span className="text-[11px] text-gray-400">+{items.length - 1} more</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-right">
                                                    {totalQty}
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-right">
                                                    {formatCurrency(items[0]?.amount || 0)}
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px] text-right font-medium">
                                                    {formatCurrency(sale.total_amount)}
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px]">
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border ${sale.payment_type === 'Due'
                                                        ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
                                                        : sale.payment_type === 'Online Payment'
                                                            ? 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/30'
                                                            : 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30'
                                                        }`}>
                                                        {sale.payment_type || 'Cash'}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => setViewSaleId(sale.id)}
                                                            className="px-2 py-0.5 text-[13px] text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                                        >
                                                            View
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="border-t dark:border-zinc-800 px-3 py-2">
                            <div className="flex items-center justify-center gap-1.5">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Previous
                                </button>

                                {/* Smart Pagination */}
                                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
                                    .map((p, i, arr) => (
                                        <div key={p} className="flex items-center gap-1.5">
                                            {i > 0 && arr[i - 1] !== p - 1 && (
                                                <span className="px-1 text-[13px] text-gray-400">...</span>
                                            )}
                                            <button
                                                onClick={() => setPage(p)}
                                                className={`px-2 py-0.5 text-[13px] rounded ${p === page
                                                    ? 'bg-blue-600 text-white'
                                                    : 'border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        </div>
                                    ))}

                                <button
                                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                    disabled={page === pagination.totalPages}
                                    className="px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="text-center text-xs text-gray-500 mt-1">
                                Page {page} of {pagination.totalPages} ({pagination.total} total sales)
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            {/* Add Sale Modal */}
            {isAddModalOpen && (
                <AddStoreSaleModal
                    onClose={() => setIsAddModalOpen(false)}
                    onSuccess={() => {
                        setIsAddModalOpen(false)
                        queryClient.invalidateQueries({ queryKey: ['store-sales'] })
                    }}
                />
            )}

            {/* View Sale Modal */}
            {viewSaleId && (
                <ViewStoreSaleModal
                    saleId={viewSaleId}
                    onClose={() => setViewSaleId(null)}
                />
            )}
        </div>
    )
}

// Add Store Sale Modal Component
function AddStoreSaleModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
    const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
    const [customerName, setCustomerName] = useState('')
    const [paymentType, setPaymentType] = useState('Cash')
    const [remarks, setRemarks] = useState('')
    const [items, setItems] = useState<SaleItem[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Product search state
    const [productSearch, setProductSearch] = useState('')
    const [selectedProduct, setSelectedProduct] = useState<any>(null)
    const [qty, setQty] = useState(1)
    const [amount, setAmount] = useState(0)
    const [showProductDropdown, setShowProductDropdown] = useState(false)

    const dropdownRef = useRef<HTMLDivElement>(null)

    // Click outside dropdown to close it
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowProductDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    // Fetch products for dropdown
    const { data: productsData, isLoading: isLoadingProducts } = useQuery({
        queryKey: ['products-for-sale', productSearch],
        queryFn: () => getProducts({ page: 1, search: productSearch, limit: 50 }),
        enabled: showProductDropdown
    })

    const products = (productsData as any)?.products || []

    const handleSelectProduct = (product: any) => {
        setSelectedProduct(product)
        setProductSearch(product.product_name)
        setShowProductDropdown(false)
    }

    const handleAddItem = () => {
        if (!selectedProduct || qty <= 0 || amount <= 0) {
            toast.error('Please select product and enter qty/amount')
            return
        }

        const newItem: SaleItem = {
            product_id: selectedProduct.id,
            product_name: selectedProduct.product_name,
            product_code: selectedProduct.product_id,
            qty,
            amount
        }

        setItems([...items, newItem])

        // Reset for next item
        setSelectedProduct(null)
        setProductSearch('')
        setQty(1)
        setAmount(0)
    }

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index))
    }

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + (item.qty * item.amount), 0)
    }

    const handleSubmit = async () => {
        if (items.length === 0) {
            toast.error('Please add at least one product')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await createStoreSale({
                sale_date: saleDate,
                customer_name: customerName || undefined,
                payment_type: paymentType,
                remarks: remarks || undefined,
                items
            })

            if ((result as any).error) {
                toast.error((result as any).error)
            } else {
                toast.success('Sale added successfully!')
                onSuccess()
            }
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        // Check for unsaved changes
        const hasUnsavedChanges = items.length > 0 || customerName.trim() !== '' || remarks.trim() !== ''

        if (hasUnsavedChanges) {
            if (window.confirm('Are you sure you want to cancel? You have unsaved changes.')) {
                onClose()
            }
        } else {
            onClose()
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={handleClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-800">
                    <h2 className="text-lg font-semibold">Add New Sale</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
                    {/* Row 1: Date, Customer Name */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Date</label>
                            <input
                                type="date"
                                value={saleDate}
                                onChange={(e) => setSaleDate(e.target.value)}
                                className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md text-sm dark:bg-zinc-800"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Customer Name (Optional)</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Default: User"
                                className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md text-sm dark:bg-zinc-800"
                            />
                        </div>
                    </div>

                    {/* Row 2: Product selection */}
                    <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-7 relative" ref={dropdownRef}>
                            <label className="block text-sm font-medium mb-1">Product Name</label>
                            <input
                                type="text"
                                value={productSearch}
                                onChange={(e) => {
                                    setProductSearch(e.target.value)
                                    setShowProductDropdown(true)
                                    setSelectedProduct(null)
                                }}
                                onClick={() => setShowProductDropdown(true)}
                                placeholder="Search product..."
                                className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md text-sm dark:bg-zinc-800"
                            />
                            {/* Product Dropdown */}
                            {showProductDropdown && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {isLoadingProducts ? (
                                        <div className="px-3 py-2 text-sm text-gray-500 text-center">Loading products...</div>
                                    ) : products.length > 0 ? (
                                        products.map((product: any) => (
                                            <button
                                                key={product.id}
                                                onClick={() => handleSelectProduct(product)}
                                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 border-b dark:border-zinc-700 last:border-0"
                                            >
                                                <div className="font-medium text-gray-900 dark:text-gray-100">{product.product_name}</div>
                                                <div className="flex items-center justify-between text-xs text-gray-500 mt-0.5">
                                                    <span>Code: {product.product_id}</span>
                                                    {product.seller_sku1 && <span>SKU: {product.seller_sku1}</span>}
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                            No products found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium mb-1">Qty</label>
                            <input
                                type="number"
                                value={qty}
                                onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                                min={1}
                                className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md text-sm dark:bg-zinc-800"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">Amount</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                min={0}
                                className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md text-sm dark:bg-zinc-800"
                            />
                        </div>
                        <div className="col-span-2">
                            <button
                                onClick={handleAddItem}
                                className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
                            >
                                + Add
                            </button>
                        </div>
                    </div>

                    {/* Row 3: Payment Type */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Payment Type</label>
                        <select
                            value={paymentType}
                            onChange={(e) => setPaymentType(e.target.value)}
                            className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md text-sm dark:bg-zinc-800"
                        >
                            <option value="Cash">Cash</option>
                            <option value="Online Payment">Online Payment</option>
                            <option value="Due">Due</option>
                        </select>
                    </div>

                    {/* Items List */}
                    {items.length > 0 && (
                        <div className="border dark:border-zinc-700 rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-zinc-800">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Product</th>
                                        <th className="px-3 py-2 text-right">Qty</th>
                                        <th className="px-3 py-2 text-right">Amount</th>
                                        <th className="px-3 py-2 text-right">Total</th>
                                        <th className="px-3 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                                    {items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="px-3 py-2">{item.product_name}</td>
                                            <td className="px-3 py-2 text-right">{item.qty}</td>
                                            <td className="px-3 py-2 text-right">Rs. {item.amount.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-medium">Rs. {(item.qty * item.amount).toLocaleString()}</td>
                                            <td className="px-3 py-2">
                                                <button
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-50 dark:bg-zinc-800 font-semibold">
                                        <td className="px-3 py-2" colSpan={3}>Total</td>
                                        <td className="px-3 py-2 text-right">Rs. {calculateTotal().toLocaleString()}</td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Remarks */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Remarks (Optional)</label>
                        <textarea
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md text-sm dark:bg-zinc-800"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t dark:border-zinc-800">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm border dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || items.length === 0}
                        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
                    >
                        {isSubmitting ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// View Store Sale Modal Component
function ViewStoreSaleModal({ saleId, onClose }: { saleId: string, onClose: () => void }) {
    const { data, isLoading } = useQuery({
        queryKey: ['store-sale', saleId],
        queryFn: async () => {
            const { getStoreSaleById } = await import('@/features/sales/actions/store-sales-actions')
            return getStoreSaleById(saleId)
        }
    })

    const sale = (data as any)?.data

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-800">
                    <h2 className="text-lg font-semibold">Sale Details</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading...</div>
                    ) : sale ? (
                        <>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500">Date:</span>
                                    <span className="ml-2 font-medium">{new Date(sale.sale_date).toLocaleDateString()}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Customer:</span>
                                    <span className="ml-2 font-medium">{sale.customer_name}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Payment:</span>
                                    <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border ${sale.payment_type === 'Due'
                                        ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
                                        : sale.payment_type === 'Online Payment'
                                            ? 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/30'
                                            : 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30'
                                        }`}>
                                        {sale.payment_type || 'Cash'}
                                    </span>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="border dark:border-zinc-700 rounded-md overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-zinc-800">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Product</th>
                                            <th className="px-3 py-2 text-right">Qty</th>
                                            <th className="px-3 py-2 text-right">Amount</th>
                                            <th className="px-3 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                                        {sale.items?.map((item: any, index: number) => (
                                            <tr key={index}>
                                                <td className="px-3 py-2">{item.product_name}</td>
                                                <td className="px-3 py-2 text-right">{item.qty}</td>
                                                <td className="px-3 py-2 text-right">Rs. {item.amount?.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-right font-medium">Rs. {item.total_amount?.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-gray-50 dark:bg-zinc-800 font-semibold">
                                            <td className="px-3 py-2" colSpan={3}>Total</td>
                                            <td className="px-3 py-2 text-right">Rs. {sale.total_amount?.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {sale.remarks && (
                                <div>
                                    <span className="text-sm text-gray-500">Remarks:</span>
                                    <p className="text-sm mt-1">{sale.remarks}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-8 text-gray-500">Sale not found</div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end px-4 py-3 border-t dark:border-zinc-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm border dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
