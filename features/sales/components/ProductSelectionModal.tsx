'use client'

import { useState } from 'react'

import { X } from 'lucide-react'

interface ProductSelectionModalProps {
    isOpen: boolean
    onClose: () => void
    products: Array<{
        product_id: string
        product_name: string
        image_url?: string | null
        quantity?: number
        stock?: number
    }>
    onProductSelect: (productId: string) => void
}

export function ProductSelectionModal({ isOpen, onClose, products, onProductSelect }: ProductSelectionModalProps) {
    const [zoomedImage, setZoomedImage] = useState<string | null>(null)

    if (!isOpen) return null

    const getStockColor = (stock: number | undefined) => {
        if (stock === undefined || stock === null) return 'text-gray-500 dark:text-gray-400'
        if (stock > 10) return 'text-green-600 dark:text-green-400'
        if (stock > 0) return 'text-yellow-600 dark:text-yellow-400'
        return 'text-red-600 dark:text-red-400'
    }

    return (
        <>
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
                                    <div className="flex justify-between items-center gap-3">
                                        {/* Product Image */}
                                        <div
                                            className="relative w-12 h-12 flex-shrink-0 bg-gray-100 dark:bg-zinc-800 rounded border dark:border-zinc-700 overflow-hidden cursor-zoom-in"
                                            onClick={(e) => {
                                                if (product.image_url) {
                                                    e.stopPropagation()
                                                    setZoomedImage(product.image_url)
                                                }
                                            }}
                                        >
                                            {product.image_url ? (
                                                <img
                                                    src={product.image_url}
                                                    alt={product.product_name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none'
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-400">
                                                    No Img
                                                </div>
                                            )}
                                        </div>

                                        <span className="font-medium text-gray-900 dark:text-gray-100 flex-1 pr-2">
                                            {product.product_name}
                                        </span>

                                        <div className="flex flex-col items-end gap-0.5 text-sm">
                                            {product.quantity && (
                                                <span className="text-gray-500 dark:text-gray-400 text-xs">
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

            {/* Zoomed Image Overlay */}
            {zoomedImage && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm cursor-zoom-out"
                    onClick={() => setZoomedImage(null)}
                >
                    <img
                        src={zoomedImage}
                        alt="Zoomed product"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()} // Prevent closing if clicking on image itself (optional, but requested "click outside")
                    />
                    <button
                        onClick={() => setZoomedImage(null)}
                        className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black/50 rounded-full p-2 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>
            )}
        </>
    )
}
