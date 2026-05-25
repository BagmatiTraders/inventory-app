'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Search } from 'lucide-react'
import { createPanVatBill, updatePanVatBill, type CreatePanVatBillParams, type PanVatBillItem, type PanVatBill } from '@/features/account/actions/pan-vat-bill-actions'
import { getPanVatCompanies } from '@/features/account/actions/pan-vat-company-actions'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { adToBS, bsToAD, formatNepaliCurrency } from '@/lib/utils/date-converter'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDashboard } from '@/app/dashboard/context'

interface AddPanVatBillModalProps {
    onClose: () => void
    bill?: PanVatBill | null
}

export function AddPanVatBillModal({ onClose, bill }: AddPanVatBillModalProps) {
    const queryClient = useQueryClient()
    const { isCollapsed } = useDashboard()
    const isEditMode = !!bill

    // Form state
    const [formData, setFormData] = useState({
        issue_bill_date_ad: '',
        issue_bill_date_bs: '',
        supplier_company_id: '',
        supplier_pan_vat: '',
        invoice_no: '',
        buyer_company_id: '',
        buyer_pan_vat: '',
    })

    // Line items state
    const [lineItems, setLineItems] = useState<Omit<PanVatBillItem, 'id'>[]>([{ hs_code: '', particulars: '', quantity: 0, rate: 0, amount: 0, line_order: 0 }
    ])

    // Refs for custom tab order
    const supplierRef = useRef<HTMLInputElement>(null)
    const invoiceRef = useRef<HTMLInputElement>(null)
    const buyerRef = useRef<HTMLInputElement>(null)
    const hsCodeRefs = useRef<(HTMLInputElement | null)[]>([])
    const particularsRefs = useRef<(HTMLInputElement | null)[]>([])
    const quantityRefs = useRef<(HTMLInputElement | null)[]>([])
    const rateRefs = useRef<(HTMLInputElement | null)[]>([])
    const addRowRef = useRef<HTMLButtonElement>(null)
    const saveRef = useRef<HTMLButtonElement>(null)

    // Initialize form with bill data if editing
    useEffect(() => {
        if (bill) {
            setFormData({
                issue_bill_date_ad: bill.issue_bill_date_ad,
                issue_bill_date_bs: bill.issue_bill_date_bs,
                supplier_company_id: bill.supplier_company_id || '',
                supplier_pan_vat: bill.supplier_pan_vat || '',
                invoice_no: bill.invoice_no,
                buyer_company_id: bill.buyer_company_id || '',
                buyer_pan_vat: bill.buyer_pan_vat || '',
            })
            setSupplierSearch(bill.supplier_company_name || '')
            setBuyerSearch(bill.buyer_company_name || '')
            if (bill.items && bill.items.length > 0) {
                setLineItems(bill.items.map(item => ({
                    hs_code: item.hs_code || '',
                    particulars: item.particulars,
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: item.amount,
                    line_order: item.line_order
                })))
            }
        }
    }, [bill])

    // Dropdown search states
    const [supplierSearch, setSupplierSearch] = useState('')
    const [buyerSearch, setBuyerSearch] = useState('')
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
    const [showBuyerDropdown, setShowBuyerDropdown] = useState(false)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    // Fetch suppliers
    const { data: suppliers = [] } = useQuery({
        queryKey: ['pan-vat-companies'],
        queryFn: getPanVatCompanies,
    })

    // Fetch buyers
    const { data: buyers = [] } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails,
    })

    // Set default buyer to "Bagmati Traders & Suppliers" if exists (only in add mode)
    useEffect(() => {
        if (!isEditMode && buyers.length > 0 && !buyerSearch) {
            const defaultBuyer = buyers.find(
                b => b.company_name === 'Bagmati Traders & Suppliers'
            )
            if (defaultBuyer) {
                selectBuyer(defaultBuyer)
            }
        }
    }, [buyers, isEditMode])

    // Filter suppliers based on search
    const filteredSuppliers = suppliers.filter(s =>
        s.company_name.toLowerCase().includes(supplierSearch.toLowerCase())
    )

    // Filter buyers based on search
    const filteredBuyers = buyers.filter(b =>
        b.company_name.toLowerCase().includes(buyerSearch.toLowerCase())
    )

    // Calculate totals
    const subTotalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0)
    const taxableAmount = subTotalAmount
    const vat13Percent = taxableAmount * 0.13
    const totalAmount = taxableAmount + vat13Percent

    // Handle AD date change
    const handleADDateChange = (date: string) => {
        setFormData({
            ...formData,
            issue_bill_date_ad: date,
            issue_bill_date_bs: date ? adToBS(date) : '',
        })
    }

    // Handle BS date change
    const handleBSDateChange = (date: string) => {
        setFormData({
            ...formData,
            issue_bill_date_bs: date,
            issue_bill_date_ad: date ? bsToAD(date) : '',
        })
    }

    // Select supplier
    const selectSupplier = (supplier: any) => {
        setFormData({
            ...formData,
            supplier_company_id: supplier.id,
            supplier_pan_vat: supplier.pan_vat_no || '',
        })
        setSupplierSearch(supplier.company_name)
        setShowSupplierDropdown(false)
    }

    // Select buyer
    const selectBuyer = (buyer: any) => {
        setFormData({
            ...formData,
            buyer_company_id: buyer.id,
            buyer_pan_vat: buyer.pan_vat_details || '',
        })
        setBuyerSearch(buyer.company_name)
        setShowBuyerDropdown(false)
    }

    // Handle Enter key for supplier dropdown
    const handleSupplierKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && showSupplierDropdown && filteredSuppliers.length > 0) {
            e.preventDefault()
            selectSupplier(filteredSuppliers[0])
        }
    }

    // Handle Enter key for buyer dropdown
    const handleBuyerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && showBuyerDropdown && filteredBuyers.length > 0) {
            e.preventDefault()
            selectBuyer(filteredBuyers[0])
        }
    }

    // Handle line item change
    const handleLineItemChange = (index: number, field: keyof PanVatBillItem, value: any) => {
        const newItems = [...lineItems]
        newItems[index] = { ...newItems[index], [field]: value }

        // Calculate amount if quantity or rate changes
        if (field === 'quantity' || field === 'rate') {
            newItems[index].amount = newItems[index].quantity * newItems[index].rate
        }

        setLineItems(newItems)
    }

    // Add new line item
    const addLineItem = (focusNewRow: boolean = false) => {
        const newIndex = lineItems.length
        setLineItems([
            ...lineItems,
            { hs_code: '', particulars: '', quantity: 0, rate: 0, amount: 0, line_order: newIndex }
        ])
        if (focusNewRow) {
            // Focus the new row's H.S Code field after state update
            setTimeout(() => {
                hsCodeRefs.current[newIndex]?.focus()
            }, 50)
        }
    }

    // Handle Enter key on Add Row button
    const handleAddRowKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            addLineItem(true)
        }
    }

    // Handle Tab on Rate field (last item) to go to Add Row button
    const handleRateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Tab' && !e.shiftKey && index === lineItems.length - 1) {
            e.preventDefault()
            addRowRef.current?.focus()
        }
    }

    // Handle Tab on Add Row to go to Save Bill
    const handleAddRowTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault()
            saveRef.current?.focus()
        } else if (e.key === 'Enter') {
            e.preventDefault()
            addLineItem(true)
        }
    }

    // Remove line item
    const removeLineItem = (index: number) => {
        if (lineItems.length > 1) {
            setLineItems(lineItems.filter((_, i) => i !== index))
        }
    }

    // Handle submit

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validation
        if (!formData.issue_bill_date_ad) {
            setError('Issue Bill Date is required')
            return
        }
        if (!formData.invoice_no.trim()) {
            setError('Invoice No is required')
            return
        }
        if (lineItems.some(item => !item.particulars.trim())) {
            setError('All line items must have Particulars')
            return
        }

        setIsSubmitting(true)
        try {
            const billData = {
                issue_bill_date_ad: formData.issue_bill_date_ad,
                issue_bill_date_bs: formData.issue_bill_date_bs,
                supplier_company_id: formData.supplier_company_id || null,
                supplier_company_name: supplierSearch || null,
                supplier_pan_vat: formData.supplier_pan_vat || null,
                invoice_no: formData.invoice_no,
                buyer_company_id: formData.buyer_company_id || null,
                buyer_company_name: buyerSearch || null,
                buyer_pan_vat: formData.buyer_pan_vat || null,
                sub_total_amount: subTotalAmount,
                taxable_amount: taxableAmount,
                vat_13_percent: vat13Percent,
                total_amount: totalAmount,
                items: lineItems.map((item, index) => ({ ...item, line_order: index })),
            }

            if (isEditMode && bill) {
                await updatePanVatBill(bill.id, billData)
            } else {
                await createPanVatBill(billData)
            }

            queryClient.invalidateQueries({ queryKey: ['pan-vat-bills'] })
            onClose()
        } catch (err: any) {
            setError(err.message || `Failed to ${isEditMode ? 'update' : 'create'} bill`)
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
                        <h2 className="text-xl font-bold">{isEditMode ? 'Edit' : 'Add'} Pan/Vat Bill</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3 p-4">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Row 1: Bill Dates */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Issue Bill Date (A.D) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.issue_bill_date_ad}
                                    onChange={(e) => handleADDateChange(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Issue Bill Date (B.S) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.issue_bill_date_bs}
                                    onChange={(e) => handleBSDateChange(e.target.value)}
                                    placeholder="YYYY-MM-DD"
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">Auto-converts from AD date</p>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Supplier & Invoice */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Supplier Company */}
                            <div className="relative">
                                <label className="block text-sm font-medium mb-1">Supplier Company</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        ref={supplierRef}
                                        tabIndex={1}
                                        value={supplierSearch}
                                        onChange={(e) => {
                                            setSupplierSearch(e.target.value)
                                            setShowSupplierDropdown(true)
                                        }}
                                        onFocus={() => setShowSupplierDropdown(true)}
                                        onKeyDown={handleSupplierKeyDown}
                                        placeholder="Search supplier..."
                                        className="w-full pl-10 pr-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                {showSupplierDropdown && filteredSuppliers.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                        {filteredSuppliers.map((supplier) => (
                                            <button
                                                key={supplier.id}
                                                type="button"
                                                onClick={() => selectSupplier(supplier)}
                                                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-zinc-700"
                                            >
                                                {supplier.company_name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Supplier Pan/Vat */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Supplier Pan/Vat</label>
                                <input
                                    type="text"
                                    value={formData.supplier_pan_vat}
                                    readOnly
                                    tabIndex={-1}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-800 cursor-not-allowed"
                                    placeholder="Auto-filled"
                                />
                            </div>

                            {/* Invoice No */}
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Invoice No <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    ref={invoiceRef}
                                    tabIndex={2}
                                    value={formData.invoice_no}
                                    onChange={(e) => setFormData({ ...formData, invoice_no: e.target.value })}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 3: Buyer */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Buyer Name */}
                            <div className="relative">
                                <label className="block text-sm font-medium mb-1">Buyer Name</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        ref={buyerRef}
                                        tabIndex={3}
                                        value={buyerSearch}
                                        onChange={(e) => {
                                            setBuyerSearch(e.target.value)
                                            setShowBuyerDropdown(true)
                                        }}
                                        onFocus={() => setShowBuyerDropdown(true)}
                                        onKeyDown={handleBuyerKeyDown}
                                        placeholder="Search buyer..."
                                        className="w-full pl-10 pr-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                {showBuyerDropdown && filteredBuyers.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                        {filteredBuyers.map((buyer) => (
                                            <button
                                                key={buyer.id}
                                                type="button"
                                                onClick={() => selectBuyer(buyer)}
                                                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-zinc-700"
                                            >
                                                {buyer.company_name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Buyer Pan/Vat */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Buyer Pan/Vat</label>
                                <input
                                    type="text"
                                    value={formData.buyer_pan_vat}
                                    readOnly
                                    tabIndex={-1}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-800 cursor-not-allowed"
                                    placeholder="Auto-filled"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-semibold">Line Items</h3>
                            <button
                                type="button"
                                ref={addRowRef}
                                tabIndex={100}
                                onClick={() => addLineItem()}
                                onKeyDown={handleAddRowTabKeyDown}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                            >
                                <Plus className="h-4 w-4" />
                                Add Row
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800 text-xs">
                                    <tr>
                                        <th className="px-2 py-2 text-left">H.S Code</th>
                                        <th className="px-2 py-2 text-left">Particulars <span className="text-red-500">*</span></th>
                                        <th className="px-2 py-2 text-left">Quantity <span className="text-red-500">*</span></th>
                                        <th className="px-2 py-2 text-left">Rate <span className="text-red-500">*</span></th>
                                        <th className="px-2 py-2 text-left">Amount</th>
                                        <th className="px-2 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((item, index) => (
                                        <tr key={index} className="border-t dark:border-zinc-800">
                                            <td className="px-2 py-2">
                                                <input
                                                    type="text"
                                                    ref={el => { hsCodeRefs.current[index] = el }}
                                                    tabIndex={10 + (index * 4)}
                                                    value={item.hs_code || ''}
                                                    onChange={(e) => handleLineItemChange(index, 'hs_code', e.target.value)}
                                                    className="w-24 px-2 py-1 border dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-800"
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    type="text"
                                                    ref={el => { particularsRefs.current[index] = el }}
                                                    tabIndex={11 + (index * 4)}
                                                    value={item.particulars}
                                                    onChange={(e) => handleLineItemChange(index, 'particulars', e.target.value)}
                                                    className="w-full min-w-[200px] px-2 py-1 border dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-800"
                                                    required
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    ref={el => { quantityRefs.current[index] = el }}
                                                    tabIndex={12 + (index * 4)}
                                                    value={item.quantity}
                                                    onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="w-24 px-2 py-1 border dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-800"
                                                    required
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    ref={el => { rateRefs.current[index] = el }}
                                                    tabIndex={13 + (index * 4)}
                                                    value={item.rate}
                                                    onChange={(e) => handleLineItemChange(index, 'rate', parseFloat(e.target.value) || 0)}
                                                    onKeyDown={(e) => handleRateKeyDown(e, index)}
                                                    className="w-28 px-2 py-1 border dark:border-zinc-700 rounded text-sm bg-white dark:bg-zinc-800"
                                                    required
                                                />
                                            </td>
                                            <td className="px-2 py-2 text-sm font-medium">
                                                {formatNepaliCurrency(item.amount)}
                                            </td>
                                            <td className="px-2 py-2">
                                                {lineItems.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeLineItem(index)}
                                                        className="text-red-600 hover:text-red-800"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Sub Total Amount</label>
                                <div className="px-3 py-2 border dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-800 font-medium">
                                    {formatNepaliCurrency(subTotalAmount)}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Taxable Amount</label>
                                <div className="px-3 py-2 border dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-800 font-medium">
                                    {formatNepaliCurrency(taxableAmount)}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">VAT 13%</label>
                                <div className="px-3 py-2 border dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-800 font-medium">
                                    {formatNepaliCurrency(vat13Percent)}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Total Amount</label>
                                <div className="px-3 py-2 border dark:border-zinc-700 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold text-lg">
                                    {formatNepaliCurrency(totalAmount)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 justify-end sticky bottom-0 bg-gray-50 dark:bg-zinc-950 py-3 border-t dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border dark:border-zinc-700 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            ref={saveRef}
                            tabIndex={101}
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Bill'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
