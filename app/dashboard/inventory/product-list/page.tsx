'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getProducts, exportProducts, toggleProductStatus, updateProduct } from '@/features/inventory/actions/product-actions'
import { ArrowLeft, Plus, Upload, Download, Search, X, Package, Trash2, Box, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { Card } from '@/components/ui-shim'
import { AddProductModal } from '@/features/inventory/components/AddProductModal'
import { ViewProductModal } from '@/features/inventory/components/ViewProductModal'
import { EditProductModal } from '@/features/inventory/components/EditProductModal'
import { DeleteProductButton } from '@/features/inventory/components/DeleteProductButton'
import { ImportCSVModal } from '@/features/inventory/components/ImportCSVModal'
import { usePermissions } from '@/lib/permissions/PermissionContext'

export default function ProductListPage() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [viewProductId, setViewProductId] = useState<string | null>(null)
    const [editProductId, setEditProductId] = useState<string | null>(null)

    // Priority and More menu states
    const [priorityEditId, setPriorityEditId] = useState<string | null>(null)
    const [moreMenuId, setMoreMenuId] = useState<string | null>(null)
    const [isSavingPriority, setIsSavingPriority] = useState(false)

    // Get real user role from permission context
    const { userRole } = usePermissions()
    const queryClient = useQueryClient()

    const handleSetPriority = async (product: any, priority: boolean) => {
        setIsSavingPriority(true)
        try {
            let prioritySellerAccount = product.priority_seller_account;
            if (priority) {
                // Find configured seller accounts
                const accounts = [
                    product.seller_account1,
                    product.seller_account2,
                    product.seller_account3,
                    product.seller_account4
                ].filter(Boolean);

                if (accounts.length === 0) {
                    alert('Please configure seller accounts for this product first by editing it.');
                    setIsSavingPriority(false);
                    setPriorityEditId(null);
                    return;
                }
                if (!prioritySellerAccount) {
                    prioritySellerAccount = accounts[0];
                }
            } else {
                prioritySellerAccount = null;
            }

            await updateProduct(product.id, {
                sales_priority: priority,
                priority_seller_account: prioritySellerAccount
            });

            queryClient.invalidateQueries({ queryKey: ['products'] });
        } catch (err: any) {
            alert(`Failed to save priority: ${err.message}`);
        } finally {
            setIsSavingPriority(false);
            setPriorityEditId(null);
        }
    }

    // Fetch products with pagination and search
    const { data, isLoading, error } = useQuery({
        queryKey: ['products', page, search],
        queryFn: () => getProducts({ page, search, limit: 50 })
    })

    const handleSearch = () => {
        setSearch(searchInput)
        setPage(1) // Reset to first page on new search
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setSearch('')
        setPage(1)
    }

    const handleExport = async () => {
        try {
            const csvData = await exportProducts()

            // Convert to CSV string
            const headers = Object.keys(csvData[0] || {})
            const csvRows = [
                headers.join(','),
                ...csvData.map(row =>
                    headers.map(header => {
                        const value = row[header as keyof typeof row]
                        // Escape values with commas or quotes
                        return typeof value === 'string' && (value.includes(',') || value.includes('"'))
                            ? `"${value.replace(/"/g, '""')}"`
                            : value
                    }).join(',')
                )
            ]

            const csvString = csvRows.join('\n')

            // Create download link
            const blob = new Blob([csvString], { type: 'text/csv' })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)

            alert('Products exported successfully!')
        } catch (error: any) {
            alert(`Export error: ${error.message}`)
        }
    }

    const handleToggleStatus = async (productId: string, currentStatus: string) => {
        try {
            await toggleProductStatus(productId, currentStatus || 'Active')
            // No need to reload, revalidatePath handles it
        } catch (error: any) {
            alert(`Error updating status: ${error.message}`)
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-50/50 dark:bg-zinc-950">
            {/* Header Area - Clean & Modern */}
            <div className="hidden md:flex sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b dark:border-zinc-800 px-6 py-4 items-center justify-between shadow-sm transition-all duration-200">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        Inventory List
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-xs font-medium text-gray-600 dark:text-gray-400">
                            {data?.totalCount || 0} items
                        </span>
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage and organize your product catalog</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard/inventory"
                        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                    >
                        <ArrowLeft size={14} />
                        Back to Inventory
                    </Link>
                </div>
            </div>

            {/* Action Bar - Floating Card Effect */}
            <div className="sticky top-0 md:top-[76px] z-10 px-0 py-0 md:px-6 md:py-4 pointer-events-none transition-all">
                <div className="bg-white dark:bg-zinc-900 rounded-none md:rounded-xl border-b md:border dark:border-zinc-800 md:shadow-sm p-3 flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
                    {/* Search Field */}
                    <div className="flex-1 w-full md:w-auto md:min-w-[240px] md:max-w-md">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search by name, SKU, or ID..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full pl-10 pr-10 py-2 text-sm bg-gray-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-all shadow-inner"
                            />
                            {searchInput && (
                                <button
                                    onClick={handleClearSearch}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons Group */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="hidden md:flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-dashed border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 hover:border-gray-400 transition-all"
                        >
                            <Upload size={14} className="text-gray-500" />
                            Import CSV
                        </button>
                        <button
                            onClick={handleExport}
                            className="hidden md:flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all shadow-sm"
                        >
                            <Download size={14} className="text-gray-500" />
                            Export
                        </button>
                        <div className="hidden md:block w-px h-6 bg-gray-200 dark:bg-zinc-700 mx-1"></div>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md hover:shadow-lg hover:shadow-blue-500/20 transition-all active:scale-[0.98]"
                        >
                            <Plus size={16} />
                            Add Product
                        </button>
                    </div>
                </div>
            </div>

            {/* Products Table Area */}
            <div className="flex-1 overflow-auto px-2 md:px-6 pb-2 md:pb-6">
                <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg md:rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 dark:bg-zinc-800/80 border-b border-gray-100 dark:border-zinc-800">
                                    <th className="px-2 md:px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white w-10 md:w-12 text-center">#</th>
                                    <th className="px-2 md:px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white w-12 md:w-16">Image</th>
                                    <th className="px-2 md:px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Product</th>
                                    <th className="hidden md:table-cell px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Type</th>
                                    <th className="hidden md:table-cell px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Status</th>
                                    <th className="px-2 md:px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white">Product ID</th>
                                    <th className="hidden md:table-cell px-4 py-3 text-xs font-bold uppercase tracking-wider text-black dark:text-white text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                <p className="text-sm text-gray-500">Loading products...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-sm text-red-500 bg-red-50/50 dark:bg-red-900/10">
                                            Error loading products: {error.message}
                                        </td>
                                    </tr>
                                ) : !data || data.products.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-16 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-gray-400">
                                                    <Box size={20} />
                                                </div>
                                                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">No products found</h3>
                                                <p className="text-sm text-gray-500 max-w-xs mx-auto mb-2">
                                                    {search ? 'We couldn\'t find any products matching your search.' : 'Get started by adding your first product.'}
                                                </p>
                                                <button
                                                    onClick={() => setIsModalOpen(true)}
                                                    className="text-sm text-blue-600 font-medium hover:underline"
                                                >
                                                    Add New Product
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    data.products.map((product, index) => {
                                        return (
                                            <tr
                                                key={product.id}
                                                className="group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                                            >
                                                <td className="px-2 md:px-4 py-3 text-xs text-center text-gray-400 font-mono">
                                                    {(page - 1) * 50 + index + 1}
                                                </td>
                                                <td className="px-2 md:px-4 py-3">
                                                    <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-800 border dark:border-zinc-700 shadow-sm">
                                                        {product.image_url ? (
                                                            <Image
                                                                src={product.image_url}
                                                                alt={product.product_name}
                                                                className="w-full h-full object-cover"
                                                                width={40}
                                                                height={40}
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none';
                                                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                                }}
                                                            />
                                                        ) : null}
                                                        <div className={`absolute inset-0 flex items-center justify-center text-gray-300 ${product.image_url ? 'hidden' : ''} fallback-icon`}>
                                                            <ImageIcon size={16} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-2 md:px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <button
                                                            onClick={() => setViewProductId(product.id)}
                                                            className="text-sm font-medium text-gray-900 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 text-left transition-colors line-clamp-1"
                                                            title={product.product_name}
                                                        >
                                                            {product.product_name}
                                                        </button>
                                                        {product.seller_sku1 && (
                                                            <span className="text-[11px] text-gray-400 font-mono mt-0.5">SKU: {product.seller_sku1}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="hidden md:table-cell px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-full border ${product.product_type === 'combo'
                                                        ? (product.product_combos?.[0]?.count === 1
                                                            ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30'
                                                            : 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/30')
                                                        : 'bg-gray-50 text-gray-700 border-gray-100 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700'
                                                        }`}>
                                                        {product.product_type === 'combo' ? (
                                                            <Package size={12} />
                                                        ) : (
                                                            <Box size={12} />
                                                        )}
                                                        {product.product_type === 'combo'
                                                            ? (product.product_combos?.[0]?.count === 1 ? 'Variation' : 'Combo')
                                                            : 'Single'}
                                                    </span>
                                                </td>
                                                <td className="hidden md:table-cell px-4 py-3">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleToggleStatus(product.id, product.status || (product.is_deleted ? 'Inactive' : 'Active'))
                                                        }}
                                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border cursor-pointer hover:opacity-80 transition-opacity ${(product.status === 'Active' || (!product.status && !product.is_deleted))
                                                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30'
                                                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
                                                            }`}
                                                        title="Click to toggle status"
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${(product.status === 'Active' || (!product.status && !product.is_deleted)) ? 'bg-green-500' : 'bg-red-500'
                                                            }`}></span>
                                                        {product.status || (product.is_deleted ? 'Inactive' : 'Active')}
                                                    </button>
                                                </td>
                                                <td className="px-2 md:px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">
                                                    #{product.product_id}
                                                </td>
                                                <td className="hidden md:table-cell px-4 py-3 relative">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {/* Priority Button Wrapper */}
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => {
                                                                    setPriorityEditId(priorityEditId === product.id ? null : product.id);
                                                                    setMoreMenuId(null);
                                                                }}
                                                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-sm ${
                                                                    product.sales_priority
                                                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-none shadow-md shadow-amber-500/10 hover:shadow-lg hover:shadow-amber-500/20 active:scale-95'
                                                                        : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:border-amber-500 dark:hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50/10 dark:hover:bg-amber-950/10 active:scale-95'
                                                                }`}
                                                            >
                                                                Priority{product.sales_priority ? ': Yes' : ''}
                                                            </button>

                                                            {priorityEditId === product.id && (
                                                                <>
                                                                    {/* Fixed full-screen backdrop to detect click-out */}
                                                                    <div className="fixed inset-0 z-40 cursor-default" onClick={() => setPriorityEditId(null)} />
                                                                    {/* Floating Dropdown */}
                                                                    <div className="absolute right-0 mt-1.5 w-32 rounded-lg bg-white dark:bg-zinc-800 border border-gray-150 dark:border-zinc-700 shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                                                                        <button
                                                                            disabled={isSavingPriority}
                                                                            onClick={() => handleSetPriority(product, true)}
                                                                            className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 flex items-center gap-1.5 transition-colors"
                                                                        >
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                            Yes
                                                                        </button>
                                                                        <button
                                                                            disabled={isSavingPriority}
                                                                            onClick={() => handleSetPriority(product, false)}
                                                                            className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-1.5 transition-colors"
                                                                        >
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                                            No
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* More Button Wrapper */}
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => {
                                                                    setMoreMenuId(moreMenuId === product.id ? null : product.id);
                                                                    setPriorityEditId(null);
                                                                }}
                                                                className="px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:border-indigo-400 dark:hover:border-indigo-800 rounded-lg shadow-sm transition-all active:scale-95"
                                                            >
                                                                More
                                                            </button>

                                                            {moreMenuId === product.id && (
                                                                <>
                                                                    {/* Fixed full-screen backdrop to detect click-out */}
                                                                    <div className="fixed inset-0 z-40 cursor-default" onClick={() => setMoreMenuId(null)} />
                                                                    {/* Floating Dropdown */}
                                                                    <div className="absolute right-0 mt-1.5 w-40 rounded-lg bg-white dark:bg-zinc-800 border border-gray-150 dark:border-zinc-700 shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                                                                        <button
                                                                            onClick={() => {
                                                                                setViewProductId(product.id);
                                                                                setMoreMenuId(null);
                                                                            }}
                                                                            className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 flex items-center gap-1.5 transition-colors"
                                                                        >
                                                                            View
                                                                        </button>
                                                                        
                                                                        <div className="border-t border-gray-100 dark:border-zinc-700 my-1" />
                                                                        
                                                                        <div className="px-1 py-0.5">
                                                                            <DeleteProductButton
                                                                                productId={product.id}
                                                                                productName={product.product_name}
                                                                                userRole={userRole ?? 'user'}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
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
                    {data && data.totalPages > 1 && (
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
                                {Array.from({ length: data.totalPages }, (_, i) => i + 1)
                                    .filter(p => {
                                        // Always show first page, last page, current page, and pages around current
                                        return p === 1 ||
                                            p === data.totalPages ||
                                            Math.abs(p - page) <= 1
                                    })
                                    .map((p, i, arr) => (
                                        <div key={p} className="flex items-center gap-1.5">
                                            {/* Show ellipsis if there's a gap */}
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
                                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                                    disabled={page === data.totalPages}
                                    className="px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="text-center text-xs text-gray-500 mt-1">
                                Page {page} of {data.totalPages} ({data.totalCount} total products)
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Product Modal */}
            <AddProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />

            {/* View Product Modal */}
            <ViewProductModal
                productId={viewProductId}
                isOpen={!!viewProductId}
                onClose={() => setViewProductId(null)}
                onEdit={(id) => setEditProductId(id)}
            />

            {/* Edit Product Modal */}
            <EditProductModal
                productId={editProductId}
                isOpen={!!editProductId}
                onClose={() => setEditProductId(null)}
            />

            {/* Import CSV Modal */}
            <ImportCSVModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
            />
        </div>
    )
}
