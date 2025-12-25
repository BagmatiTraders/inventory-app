'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSuppliers, deleteSupplier } from '@/features/suppliers/actions/supplier-actions'
import { ArrowLeft, Plus, Search, X, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { AddSupplierModal } from '@/features/suppliers/components/AddSupplierModal'

export default function SuppliersListPage() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const queryClient = useQueryClient()

    // Fetch suppliers with pagination and search
    const { data, isLoading, error } = useQuery({
        queryKey: ['suppliers', page, search],
        queryFn: () => getSuppliers({ page, search, limit: 50 })
    })

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: deleteSupplier,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] })
        }
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

    const handleDelete = async (supplierId: string, supplierName: string) => {
        if (!confirm(`Are you sure you want to delete "${supplierName}"?`)) {
            return
        }

        try {
            await deleteMutation.mutateAsync(supplierId)
            alert('Supplier deleted successfully')
        } catch (error: any) {
            alert(`Delete error: ${error.message}`)
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Compact Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 flex items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Suppliers List</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Manage suppliers</p>
                </div>
                <Link
                    href="/dashboard/suppliers"
                    className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                >
                    <ArrowLeft size={12} />
                    Back to Suppliers
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
                                placeholder="Search suppliers..."
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

                    {/* Add Supplier Button */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                        <Plus size={12} />
                        Add Suppliers
                    </button>
                </div>
            </div>

            {/* Suppliers Table */}
            <div className="flex-1 overflow-auto px-3 py-3">
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-800">
                                <tr>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 w-10">S.N</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Supplier Name</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Contact Details</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Remarks</th>
                                    <th className="px-2 py-1.5 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            Loading suppliers...
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={5} className="px-2 py-8 text-center text-[15px] text-red-500">
                                            Error loading suppliers: {error.message}
                                        </td>
                                    </tr>
                                ) : !data || data.suppliers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-2 py-8 text-center text-[15px] text-gray-500">
                                            No suppliers found. {search && 'Try a different search term or '}
                                            <button className="text-blue-600 hover:underline" onClick={() => setIsModalOpen(true)}>add your first supplier</button>.
                                        </td>
                                    </tr>
                                ) : (
                                    data.suppliers.map((supplier, index) => (
                                        <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:shadow-lg hover:z-10 relative transition-all duration-200">
                                            <td className="px-2 py-1.5 text-[13px] text-gray-500">
                                                {(page - 1) * 50 + index + 1}
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px] font-medium">
                                                {supplier.supplier_name}
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px] text-gray-600 dark:text-gray-400">
                                                {supplier.contact_details || '-'}
                                            </td>
                                            <td className="px-2 py-1.5 text-[13px] text-gray-600 dark:text-gray-400">
                                                {supplier.remarks || '-'}
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleDelete(supplier.id, supplier.supplier_name)}
                                                        className="px-2 py-0.5 text-[13px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex items-center gap-1"
                                                    >
                                                        <Trash2 size={12} />
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {data && data.pagination.totalPages > 1 && (
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
                                {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1)
                                    .filter(p => {
                                        return p === 1 ||
                                            p === data.pagination.totalPages ||
                                            Math.abs(p - page) <= 1
                                    })
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
                                    onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                                    disabled={page === data.pagination.totalPages}
                                    className="px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="text-center text-xs text-gray-500 mt-1">
                                Page {page} of {data.pagination.totalPages} ({data.pagination.total} total suppliers)
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            {/* Add Supplier Modal */}
            <AddSupplierModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    )
}
