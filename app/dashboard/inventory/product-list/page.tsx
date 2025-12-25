'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getProducts, exportProducts, deleteAllProducts } from '@/features/inventory/actions/product-actions'
import { ArrowLeft, Plus, Upload, Download, Search, X, Package, Trash2, Box } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { AddProductModal } from '@/features/inventory/components/AddProductModal'
import { ViewProductModal } from '@/features/inventory/components/ViewProductModal'
import { EditProductModal } from '@/features/inventory/components/EditProductModal'
import { DeleteProductButton } from '@/features/inventory/components/DeleteProductButton'
import { ImportCSVModal } from '@/features/inventory/components/ImportCSVModal'

export default function ProductListPage() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [viewProductId, setViewProductId] = useState<string | null>(null)
    const [editProductId, setEditProductId] = useState<string | null>(null)
    const [userRole, setUserRole] = useState<'admin' | 'user'>('admin') // TODO: Get from auth

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

    const handleDeleteAll = async () => {
        if (!confirm('âš ï¸ WARNING: This will delete ALL products from the list!\n\nThis action will:\n- Delete all products permanently\n- Move them to the restore backup (15 days)\n\nAre you absolutely sure you want to continue?')) {
            return
        }

        if (!confirm('This is your FINAL confirmation.\n\nType YES to confirm deletion of all products.')) {
            return
        }

        try {
            const result = await deleteAllProducts()
            alert(result.message)
            // Refresh data
            window.location.reload()
        } catch (error: any) {
            alert(`Delete error: ${error.message}`)
        }
    }


    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Compact Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 flex items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Product List</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Manage product catalog</p>
                </div>
                <Link
                    href="/dashboard/inventory"
                    className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                >
                    <ArrowLeft size={12} />
                    Back to Inventory
                </Link>
            </div>

            {/* Compact Action Bar */}
            <div className="sticky top-[44px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                    {/* Compact Search */}
                    <div className="flex-1 min-w-[200px] max-w-sm">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                            <input
                                type="text"
                                placeholder="Search products, SKUs..."
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
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                        <Plus size={12} />
                        Add Product
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-1 px-2 py-1 text-sm border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors"
                    >
                        <Upload size={12} />
                        Import
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-1 px-2 py-1 text-sm border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded transition-colors"
                    >
                        <Download size={12} />
                        Export
                    </button>
                    <button
                        onClick={handleDeleteAll}
                        className="flex items-center gap-1 px-2 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                    >
                        <Trash2 size={12} />
                        Delete All
                    </button>
                </div>
            </div>

            {/* Products Table */}
            <div className="flex-1 overflow-auto px-3 py-3">
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                <tr>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 w-10">S.N</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 w-16">Image</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Product Name</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Type</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Product ID</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            Loading products...
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={6} className="px-2 py-8 text-center text-[15px] text-red-500">
                                            Error loading products: {error.message}
                                        </td>
                                    </tr>
                                ) : !data || data.products.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            No products found. {search && 'Try a different search term or '}
                                            <button className="text-blue-600 hover:underline" onClick={() => setIsModalOpen(true)}>add your first product</button>.
                                        </td>
                                    </tr>
                                ) : (
                                    data.products.map((product, index) => {
                                        return (
                                            <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:shadow-lg hover:z-10 relative transition-all duration-200">
                                                <td className="px-2 py-1.5 text-[13px] text-gray-500">
                                                    {(page - 1) * 50 + index + 1}
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    {product.image_url ? (
                                                        <img
                                                            src={product.image_url}
                                                            alt={product.product_name}
                                                            className="w-10 h-10 object-cover rounded"
                                                            onError={(e) => {
                                                                e.currentTarget.src = ''
                                                                e.currentTarget.alt = 'No Image'
                                                                e.currentTarget.className = 'w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-zinc-800 rounded text-[11px] text-gray-400'
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-zinc-800 rounded text-[11px] text-gray-400">
                                                            No Img
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 text-[13px]">
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setViewProductId(product.id)}
                                                            className="font-medium hover:text-blue-600 hover:underline text-left"
                                                        >
                                                            {product.product_name}
                                                        </button>
                                                        {product.product_type === 'combo' && (
                                                            product.product_combos?.[0]?.count === 1 ? (
                                                                <Package size={14} className="text-blue-500 fill-blue-500/10" />
                                                            ) : (
                                                                <Package size={14} className="text-purple-500 fill-purple-500/10" />
                                                            )
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded ${product.product_type === 'combo'
                                                        ? (product.product_combos?.[0]?.count === 1
                                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300')
                                                        : 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300'
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
                                                <td className="px-2 py-1.5 text-[13px] font-mono text-gray-500">
                                                    #{product.product_id}
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => setViewProductId(product.id)}
                                                            className="px-2 py-0.5 text-[13px] text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                                        >
                                                            View
                                                        </button>
                                                        <DeleteProductButton
                                                            productId={product.id}
                                                            productName={product.product_name}
                                                            userRole={userRole}
                                                        />
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
                </Card>
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

