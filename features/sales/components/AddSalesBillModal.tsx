'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Search, AlertTriangle } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDashboard } from '@/app/dashboard/layout'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { getStockAnalysisData } from '@/features/stock-analysis/actions/stock-analysis-actions'
import { updateSalesBill, createSalesBill, type SalesBillItem, type SalesBill } from '@/features/sales/actions/sales-bill-actions'
import { adToBS, bsToAD, formatNepaliCurrency } from '@/lib/utils/date-converter'

interface AddSalesBillModalProps {
    onClose: () => void
    billToEdit?: SalesBill
}

export function AddSalesBillModal({ onClose, billToEdit }: AddSalesBillModalProps) {
    const queryClient = useQueryClient()
    const { isCollapsed } = useDashboard()
    const isEditing = !!billToEdit

    // Form state
    const [formData, setFormData] = useState({
        bill_date_ad: new Date().toISOString().split('T')[0],
        bill_date_bs: '',
        invoice_no: '',
        seller_company_id: '',
        customer_name: '',
        customer_address: '',
        customer_pan_vat: '',
    })

    const [lineItems, setLineItems] = useState<Omit<SalesBillItem, 'id'>[]>([
        { hs_code: '', particulars: '', quantity: 0, rate: 0, amount: 0, line_order: 0 }
    ])

    // Initialize Data
    useEffect(() => {
        if (billToEdit) {
            setFormData({
                bill_date_ad: billToEdit.bill_date_ad,
                bill_date_bs: billToEdit.bill_date_bs,
                invoice_no: billToEdit.invoice_no,
                seller_company_id: billToEdit.seller_company_id || '',
                customer_name: billToEdit.customer_name,
                customer_address: billToEdit.customer_address || '',
                customer_pan_vat: billToEdit.customer_pan_vat || '',
            })
            // Map items if available (requires getSalesBillById to fetch items with the bill)
            if (billToEdit.items) {
                setLineItems(billToEdit.items.map(item => ({
                    hs_code: item.hs_code || '',
                    particulars: item.particulars,
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: item.amount,
                    line_order: item.line_order
                })))
            }
        } else if (formData.bill_date_ad) {
            // Only set BS date if not editing (or if editing but empty, which shouldn't happen)
            // Actually, safely re-calc BS if not set
            if (!formData.bill_date_bs) {
                setFormData(prev => ({ ...prev, bill_date_bs: adToBS(formData.bill_date_ad) }))
            }
        }
    }, [billToEdit])

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    // Fetch Sellers (Our Companies)
    const { data: sellers = [] } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails,
    })

    // Fetch Stock Data for Particulars Search
    const { data: stockData = [] } = useQuery({
        queryKey: ['stock-analysis-all'],
        queryFn: () => getStockAnalysisData({ fiscalYearId: 'all' }), // Fetch all to search
    })

    // Helper for particulars dropdown
    const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null)
    const [particularSearch, setParticularSearch] = useState('')

    // Filtered particulars based on search
    const filteredStock = stockData.filter(item =>
        item.particulars.toLowerCase().includes(particularSearch.toLowerCase())
    )

    // Calculate totals
    const subTotalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0)
    const vatAmount = subTotalAmount * 0.13
    const totalAmount = subTotalAmount + vatAmount

    // Handlers
    const handleADDateChange = (date: string) => {
        setFormData({
            ...formData,
            bill_date_ad: date,
            bill_date_bs: date ? adToBS(date) : '',
        })
    }

    const handleBSDateChange = (date: string) => {
        setFormData({
            ...formData,
            bill_date_bs: date,
            bill_date_ad: date ? bsToAD(date) : '',
        })
    }

    const addLineItem = () => {
        setLineItems([
            ...lineItems,
            { hs_code: '', particulars: '', quantity: 0, rate: 0, amount: 0, line_order: lineItems.length }
        ])
    }

    const removeLineItem = (index: number) => {
        if (lineItems.length > 1) {
            setLineItems(lineItems.filter((_, i) => i !== index))
        }
    }

    const handleItemChange = (index: number, field: keyof SalesBillItem, value: any) => {
        const newItems = [...lineItems]
        const currentItem = { ...newItems[index] }

        // Special handling for Quantity validation
        if (field === 'quantity') {
            const qty = parseFloat(value) || 0
            // Find stock item to check running stock
            const stockItem = stockData.find(s => s.particulars === currentItem.particulars)

            if (stockItem && qty > stockItem.running_stock) {
                // Warning is handled in UI rendering, here we just set value but prevent submit later?
                // Or we can just cap it? User asked for warning and "didnot save data".
            }
            currentItem.quantity = qty
        } else if (field === 'rate') {
            currentItem.rate = parseFloat(value) || 0
        } else {
            (currentItem as any)[field] = value
        }

        // Auto-calculate amount
        if (field === 'quantity' || field === 'rate') {
            currentItem.amount = currentItem.quantity * currentItem.rate
        }

        newItems[index] = currentItem
        setLineItems(newItems)
    }

    const selectParticular = (index: number, stockItem: any) => {
        const newItems = [...lineItems]

        // Auto-fill H.S Code
        const hsCode = stockItem.hs_code || ''

        // Auto-calculate Rate: Purchase Rate * 1.1 + Purchase Rate = Purchase Rate * 2.1 ??? 
        // User request: "Purchase Rate * 10% + Purchase rate" -> Rate + (Rate * 0.1) = Rate * 1.1
        // Purchase Rate in stockData is `weighted_average_rate`
        const suggestedRate = (stockItem.weighted_average_rate || 0) * 1.1

        newItems[index] = {
            ...newItems[index],
            particulars: stockItem.particulars,
            hs_code: hsCode,
            rate: parseFloat(suggestedRate.toFixed(2)),
            quantity: 0, // Reset qty
            amount: 0
        }
        setLineItems(newItems)
        setActiveRowIndex(null)
        setParticularSearch('')
    }

    // Get Running Stock for a row
    const getRunningStock = (particulars: string) => {
        const item = stockData.find(s => s.particulars === particulars)
        return item?.running_stock || 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validations
        if (!formData.seller_company_id) {
            setError('Seller (Company) is required')
            return
        }
        if (!formData.customer_name) {
            setError('Customer Name is required')
            return
        }
        /* 
           Note: Invoice No is also required by the database schema (NOT NULL), 
           so we implicitly require it or it will fail on insert. 
           However, user didn't explicitly list it in 'Required fields'. 
           I will keep the check to prevent DB errors.
        */
        if (!formData.invoice_no) {
            setError('Invoice No is required')
            return
        }

        // Stock & Item Validation
        if (lineItems.length === 0) {
            setError('At least one item is required')
            return
        }

        for (let i = 0; i < lineItems.length; i++) {
            const item = lineItems[i]

            if (!item.particulars) {
                setError(`Row ${i + 1}: Particulars is required`)
                return
            }
            if (item.quantity <= 0) {
                setError(`Row ${i + 1}: Quantity must be greater than 0`)
                return
            }

            const runningStock = getRunningStock(item.particulars)
            if (item.quantity > runningStock) {
                setError(`Row ${i + 1}: Quantity (${item.quantity}) exceeds running stock (${runningStock}) for ${item.particulars}`)
                return
            }
        }

        setIsSubmitting(true)
        try {
            if (isEditing && billToEdit) {
                await updateSalesBill(billToEdit.id, {
                    ...formData,
                    sub_total_amount: subTotalAmount,
                    vat_amount: vatAmount,
                    total_amount: totalAmount,
                    items: lineItems.map((item, i) => ({ ...item, line_order: i }))
                })
                alert('Sales Bill Updated Successfully')
            } else {
                await createSalesBill({
                    ...formData,
                    sub_total_amount: subTotalAmount,
                    vat_amount: vatAmount,
                    total_amount: totalAmount,
                    items: lineItems.map((item, i) => ({ ...item, line_order: i }))
                })
                alert('Sales Bill Added Successfully')
            }

            queryClient.invalidateQueries({ queryKey: ['sales-bills'] })
            onClose()
        } catch (err: any) {
            setError(err.message || 'Failed to save sales bill')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className={`fixed inset-0 z-[100] overflow-y-auto bg-gray-50 dark:bg-zinc-950 transition-all duration-300 ${isCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
            <div className="min-h-screen">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">{isEditing ? 'Edit Sales Bill' : 'Add Sales Bill'}</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-7xl mx-auto">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            {error}
                        </div>
                    )}

                    {/* Row 1: Date, Invoice, Supplier */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Dates */}
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Date (AD)</label>
                                    <input
                                        type="date"
                                        value={formData.bill_date_ad}
                                        onChange={(e) => handleADDateChange(e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                    />
                                </div>
                                <div>
                                    {/* Additional Date Picker handled by browser input type='date' for AD, 
                                        BS is auto-calculated usually or text input */}
                                    {/* Since user asked for "Date Picker", the AD date input covers it. */}
                                </div>
                            </div>

                            {/* Invoice No */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Invoice No</label>
                                <input
                                    type="text"
                                    value={formData.invoice_no}
                                    onChange={(e) => setFormData({ ...formData, invoice_no: e.target.value })}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                />
                            </div>

                            {/* Seller (Supplier/Company) */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Seller (Our Company) <span className="text-red-500">*</span></label>
                                <select
                                    value={formData.seller_company_id}
                                    onChange={(e) => setFormData({ ...formData, seller_company_id: e.target.value })}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                >
                                    <option value="">Select Company</option>
                                    {sellers.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.company_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Customer Info */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 p-4">
                        <h3 className="text-sm font-semibold mb-3 text-gray-500">Customer Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Customer Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.customer_name}
                                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Address</label>
                                <input
                                    type="text"
                                    value={formData.customer_address}
                                    onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Pan/Vat</label>
                                <input
                                    type="number"
                                    value={formData.customer_pan_vat}
                                    onChange={(e) => setFormData({ ...formData, customer_pan_vat: e.target.value })}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 3: Items */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 p-4">
                        <div className="overflow-x-auto min-h-[300px]">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800 text-xs text-left">
                                    <tr>
                                        <th className="px-3 py-2 w-24">H.S Code</th>
                                        <th className="px-3 py-2 min-w-[200px]">Particulars <span className="text-red-500">*</span></th>
                                        <th className="px-3 py-2 w-32">Qty <span className="text-red-500">*</span></th>
                                        <th className="px-3 py-2 w-32">Rate (Rs)</th>
                                        <th className="px-3 py-2 w-32">Amount</th>
                                        <th className="px-3 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {lineItems.map((item, index) => (
                                        <tr key={index} className="vt-align-top">
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={item.hs_code || ''}
                                                    readOnly
                                                    className="w-full px-2 py-1 bg-gray-50 dark:bg-zinc-800/50 border dark:border-zinc-700 rounded text-sm text-gray-500"
                                                />
                                            </td>
                                            <td className="px-3 py-2 relative">
                                                <div
                                                    className="relative"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <input
                                                        type="text"
                                                        value={activeRowIndex === index ? particularSearch : item.particulars}
                                                        onChange={(e) => {
                                                            setParticularSearch(e.target.value)
                                                            if (activeRowIndex !== index) setActiveRowIndex(index)
                                                        }}
                                                        onFocus={() => {
                                                            setActiveRowIndex(index)
                                                            setParticularSearch(item.particulars)
                                                        }}
                                                        placeholder="Search particular..."
                                                        className="w-full px-2 py-1 border dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500"
                                                    />

                                                    {/* Dropdown */}
                                                    {activeRowIndex === index && (
                                                        <div className="absolute top-full left-0 z-50 w-full mt-1 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded shadow-lg max-h-48 overflow-y-auto">
                                                            {filteredStock.length > 0 ? (
                                                                filteredStock.map((stockItem, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        onClick={() => selectParticular(index, stockItem)}
                                                                        className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer flex justify-between"
                                                                    >
                                                                        <span>{stockItem.particulars}</span>
                                                                        <span className="text-xs text-gray-500">
                                                                            Stock: {stockItem.running_stock}
                                                                        </span>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="px-3 py-2 text-sm text-gray-500">No Match</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-col">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                        className={`w-full px-2 py-1 border rounded text-sm bg-white dark:bg-zinc-800 ${item.quantity > getRunningStock(item.particulars)
                                                            ? 'border-red-500 focus:ring-red-500'
                                                            : 'dark:border-zinc-700 focus:ring-blue-500'
                                                            }`}
                                                    />
                                                    <span className={`text-[10px] mt-0.5 ${item.quantity > getRunningStock(item.particulars) ? 'text-red-500 font-bold' : 'text-gray-500'
                                                        }`}>
                                                        Available: {getRunningStock(item.particulars)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={item.rate}
                                                    onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                                                    className="w-full px-2 py-1 border dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-800"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="px-2 py-1 text-sm font-medium">
                                                    {formatNepaliCurrency(item.amount)}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {lineItems.length > 1 && (
                                                    <button onClick={() => removeLineItem(index)} className="text-red-500 hover:text-red-700">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button
                                type="button"
                                onClick={addLineItem}
                                className="mt-2 flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium px-2"
                            >
                                <Plus className="h-4 w-4" /> Add Item
                            </button>
                        </div>
                    </div>

                    {/* Footer Totals & Actions */}
                    <div className="flex justify-end gap-8 bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 p-4">
                        <div className="w-64 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Sub Total Amount</span>
                                <span className="font-medium">{formatNepaliCurrency(subTotalAmount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">13% VAT</span>
                                <span className="font-medium">{formatNepaliCurrency(vatAmount)}</span>
                            </div>
                            <div className="border-t dark:border-zinc-700 pt-2 flex justify-between text-base font-bold">
                                <span>Total Amount</span>
                                <span className="text-blue-600">{formatNepaliCurrency(totalAmount)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="sticky bottom-0 bg-gray-50 dark:bg-zinc-950 pt-4 pb-2 border-t dark:border-zinc-800 flex justify-end gap-3 px-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border dark:border-zinc-700 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : 'Save & Close'}
                        </button>
                    </div>
                </form>

                {/* Close Dropdown on outside click hack/handler could go here if needed, but fixed layout handles reasonable enough */}
                {activeRowIndex !== null && (
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setActiveRowIndex(null)}
                    ></div>
                )}
            </div>
        </div>
    )
}
