'use client'

import { useState, useEffect } from 'react'
import { X, Edit } from 'lucide-react'
import { getProductById } from '@/features/inventory/actions/product-actions'
import { useQuery } from '@tanstack/react-query'
import Barcode from 'react-barcode'

interface ViewProductModalProps {
    productId: string | null
    isOpen: boolean
    onClose: () => void
    onEdit: (productId: string) => void
}

export function ViewProductModal({ productId, isOpen, onClose, onEdit }: ViewProductModalProps) {
    // Fetch product details
    const { data: product, isLoading, error } = useQuery({
        queryKey: ['product', productId],
        queryFn: () => productId ? getProductById(productId) : null,
        enabled: !!productId && isOpen
    })

    // Close modal on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose()
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose])

    if (!isOpen || !productId) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b dark:border-zinc-700">
                    <h2 className="text-xl font-bold">Product Details</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading product details...</div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-500">Error: {error.message}</div>
                    ) : !product ? (
                        <div className="text-center py-8 text-gray-500">Product not found</div>
                    ) : (
                        <div className="space-y-6">
                            {/* Product ID as Barcode */}
                            <div className="flex flex-col items-center p-6 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                                <div className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Product ID
                                </div>
                                <Barcode
                                    value={product.product_id.toString()}
                                    width={2}
                                    height={60}
                                    fontSize={14}
                                    background="transparent"
                                />
                            </div>

                            {/* Product Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                                        Product Name
                                    </label>
                                    <p className="text-lg font-semibold">{product.product_name}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                                        Product Type
                                    </label>
                                    <span className={`inline-flex px-3 py-1 text-sm font-medium rounded ${product.product_type === 'combo'
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                                        : 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300'
                                        }`}>
                                        {product.product_type === 'combo' ? 'Combo Product' : 'Single Product'}
                                    </span>
                                </div>

                                {product.image_url && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                                            Product Image
                                        </label>
                                        <img
                                            src={product.image_url}
                                            alt={product.product_name}
                                            className="w-48 h-48 object-cover rounded-lg border dark:border-zinc-700"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Combo Items */}
                            {product.product_type === 'combo' && product.combo_items && product.combo_items.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold mb-4">Combo Components</h3>
                                    <div className="space-y-2">
                                        {product.combo_items.map((item: any) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border dark:border-purple-800"
                                            >
                                                <div>
                                                    <p className="font-medium">{item.child?.product_name || 'Unknown Product'}</p>
                                                    <p className="text-sm text-gray-500">Product ID: {item.child?.product_id}</p>
                                                </div>
                                                <div className="text-lg font-semibold text-purple-700 dark:text-purple-400">
                                                    × {item.quantity}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Seller SKUs */}
                            {product.product_type === 'single' && (
                                <div>
                                    <h3 className="text-lg font-semibold mb-4">Seller SKUs & Accounts</h3>
                                    <div className="space-y-3">
                                        {[1, 2, 3, 4].map((num) => {
                                            const skuKey = `seller_sku${num}` as keyof typeof product
                                            const accountKey = `seller_account${num}` as keyof typeof product
                                            const sku = product[skuKey]
                                            const account = product[accountKey]

                                            if (!sku && !account) return null

                                            return (
                                                <div key={num} className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Seller SKU {num}</p>
                                                        <p className="font-medium">{sku || 'Not set'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Seller Account {num}</p>
                                                        <p className="font-medium">{account || 'Not set'}</p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Audit Trail */}
                            <div className="border-t dark:border-zinc-700 pt-6">
                                <h3 className="text-lg font-semibold mb-4">Audit Trail</h3>
                                <div className="space-y-3">
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                                        <p className="text-sm">
                                            {product.import_flag ? (
                                                <>
                                                    <span className="font-medium">Imported by:</span> {product.created_by_name || 'Unknown'} at{' '}
                                                    {new Date(product.created_at).toLocaleString()}
                                                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-200 dark:bg-blue-800 rounded">Import</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="font-medium">Created by:</span> {product.created_by_name || 'Unknown'} at{' '}
                                                    {new Date(product.created_at).toLocaleString()}
                                                </>
                                            )}
                                        </p>
                                    </div>

                                    {product.updated_at !== product.created_at && (
                                        <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg">
                                            <p className="text-sm">
                                                <span className="font-medium">Updated by:</span> {product.updated_by_name || 'Unknown'} at{' '}
                                                {new Date(product.updated_at).toLocaleString()}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {product && (
                    <div className="border-t dark:border-zinc-700 p-6 flex items-center justify-end gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 border dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => {
                                onEdit(productId)
                                onClose()
                            }}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                        >
                            <Edit size={16} />
                            Edit
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
