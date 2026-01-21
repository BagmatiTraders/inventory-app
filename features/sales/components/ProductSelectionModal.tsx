'use client'

import { X } from 'lucide-react'

interface ProductSelectionModalProps {
    isOpen: boolean
    onClose: () => void
    products: Array<{
        product_id: string
        product_name: string
        quantity?: number
        stock?: number
    }>
    onProductSelect: (productId: string) => void
}

export function ProductSelectionModal({ isOpen, onClose, products, onProductSelect }: ProductSelectionModalProps) {
    if (!isOpen) return null

    const getStockColor = (stock: number | undefined) => {
        if (stock === undefined || stock === null) return 'text-gray-500 dark:text-gray-400'
        if (stock > 10) return 'text-green-600 dark:text-green-400'
        if (stock > 0) return 'text-yellow-600 dark:text-yellow-400'
        return 'text-red-600 dark:text-red-400'
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-700">
                    <h2 className="text-lg font-bold">Select Product to Plan</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <X size={20} />
                    </button>
                </div>

                {/* Product List */}
                <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                    {products.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            No products found in this order
                        </div>
                    ) : (
                        products.map((product, idx) => (
                            <button
                                key={idx}
                                onClick={() => onProductSelect(product.product_id)}
                                className="w-full text-left p-3 border dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-900 dark:text-gray-100 flex-1 pr-2">
                                        {product.product_name}
                                    </span>
                                    <div className="flex items-center gap-2 text-sm">
                                        {product.quantity && (
                                            <span className="text-gray-500 dark:text-gray-400">
                                                Qty: {product.quantity}
                                            </span>
                                        )}
                                        <span className={`font-medium ${getStockColor(product.stock)}`}>
                                            Stock: {product.stock ?? 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t dark:border-zinc-700">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 text-sm border dark:border-zinc-700 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}
