'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createPurchase } from '@/features/purchase/actions/purchase-actions'
import { getProducts } from '@/features/inventory/actions/product-actions'
import { getSuppliers } from '@/features/suppliers/actions/supplier-actions'
import AsyncSelect from 'react-select/async'
import { X, Save } from 'lucide-react'

interface PurchaseFormProps {
    onClose: () => void
    onSuccess: () => void
    initialData?: {
        productId?: string
        productName?: string
        quantity?: number
        remarks?: string
    }
}

export default function PurchaseForm({ onClose, onSuccess, initialData }: PurchaseFormProps) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        purchase_date: new Date().toISOString().split('T')[0],
        product_id: initialData?.productId || '',
        product_name: initialData?.productName || '',
        quantity: initialData?.quantity ? initialData.quantity.toString() : '',
        unit_amount: '' as any,
        total_amount: 0,
        supplier_id: '',
        supplier_name: '', // For display
        payment_type: 'Cash',
        remarks: initialData?.remarks || ''
    })

    // Calculate Total Amount
    useEffect(() => {
        const qty = parseFloat(formData.quantity) || 0
        const rate = parseFloat(formData.unit_amount) || 0
        setFormData(prev => ({ ...prev, total_amount: qty * rate }))
    }, [formData.quantity, formData.unit_amount])

    // Load Products for AsyncSelect
    const loadProductOptions = async (inputValue: string) => {
        const { products } = await getProducts({
            search: inputValue,
            limit: 50,
            productType: 'all'
        })
        return products.map(p => ({
            value: p.id,
            label: `${p.product_name} ${p.seller_sku1 ? `(${p.seller_sku1})` : ''}`,
            name: p.product_name
        }))
    }

    // Load Suppliers for AsyncSelect
    const loadSupplierOptions = async (inputValue: string) => {
        const { suppliers } = await getSuppliers({
            search: inputValue,
            limit: 50
        })
        return suppliers.map(s => ({
            value: s.id,
            label: s.supplier_name
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.product_id || !formData.quantity || !formData.unit_amount || !formData.supplier_id || !formData.payment_type) {
            alert('Please fill in all required fields')
            return
        }

        try {
            setIsSubmitting(true)
            await createPurchase({
                purchase_date: formData.purchase_date,
                product_id: formData.product_id,
                quantity: parseFloat(formData.quantity),
                unit_amount: parseFloat(formData.unit_amount),
                total_amount: formData.total_amount,
                supplier_id: formData.supplier_id,
                payment_type: formData.payment_type,
                remarks: formData.remarks
            })

            queryClient.invalidateQueries({ queryKey: ['today-purchases'] })
            onSuccess()
            onClose()
        } catch (error: any) {
            alert(`Error adding purchase: ${error.message}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-800">
                <h2 className="text-lg font-semibold">Add Edit Purchase</h2>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded">
                    <X size={20} />
                </button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-4">
                <form id="purchase-form" onSubmit={handleSubmit} className="space-y-4 max-w-2xl mx-auto">

                    {/* Date */}
                    <div>
                        <label className="block text-xs font-medium mb-1">Date</label>
                        <input
                            type="date"
                            value={formData.purchase_date}
                            onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                            className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900"
                        />
                    </div>

                    {/* Product */}
                    <div>
                        <label className="block text-xs font-medium mb-1">Product Name <span className="text-red-500">*</span></label>
                        <AsyncSelect
                            cacheOptions
                            defaultOptions
                            loadOptions={loadProductOptions}
                            value={formData.product_id ? { label: formData.product_name, value: formData.product_id } : null}
                            onChange={(opt: any) => setFormData({ ...formData, product_id: opt?.value || '', product_name: opt?.name || opt?.label || '' })}
                            className="text-sm"
                            placeholder="Search product..."
                        />
                    </div>

                    {/* Quantity & Unit Amount */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1">Quantity <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                min="1"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md bg-white text-gray-900"
                                placeholder="Qty"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Unit Amount <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.unit_amount}
                                onChange={(e) => setFormData({ ...formData, unit_amount: e.target.value })}
                                className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md bg-white text-gray-900"
                                placeholder="Amount"
                            />
                        </div>
                    </div>

                    {/* Total Amount */}
                    <div>
                        <label className="block text-xs font-medium mb-1">Total Amount</label>
                        <div className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-medium">
                            Rs {formData.total_amount.toFixed(2)}
                        </div>
                    </div>

                    {/* Supplier */}
                    <div>
                        <label className="block text-xs font-medium mb-1">Supplier <span className="text-red-500">*</span></label>
                        <AsyncSelect
                            cacheOptions
                            defaultOptions
                            loadOptions={loadSupplierOptions}
                            value={formData.supplier_id ? { label: formData.supplier_name, value: formData.supplier_id } : null}
                            onChange={(opt: any) => setFormData({ ...formData, supplier_id: opt?.value || '', supplier_name: opt?.label || '' })}
                            className="text-sm"
                            placeholder="Search supplier..."
                        />
                    </div>

                    {/* Payment Type */}
                    <div>
                        <label className="block text-xs font-medium mb-1">Payment Type <span className="text-red-500">*</span></label>
                        <select
                            value={formData.payment_type}
                            onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                            className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900"
                        >
                            <option value="Cash">Cash</option>
                            <option value="Due">Due</option>
                            <option value="Online">Online</option>
                            <option value="Others">Others</option>
                        </select>
                    </div>

                    {/* Remarks */}
                    <div>
                        <label className="block text-xs font-medium mb-1">Remarks</label>
                        <textarea
                            rows={3}
                            value={formData.remarks}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            className="w-full px-3 py-2 text-sm border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900"
                            placeholder="Optional remarks..."
                        />
                    </div>

                </form>
            </div>

            {/* Footer Actions */}
            <div className="px-4 py-3 border-t dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-zinc-700 rounded"
                    disabled={isSubmitting}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    form="purchase-form"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50"
                >
                    <Save size={16} />
                    {isSubmitting ? 'Saving...' : 'Save And Close'}
                </button>
            </div>
        </div>
    )
}
