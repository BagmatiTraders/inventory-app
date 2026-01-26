'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Save, Search, Trash2, Edit2, X, AlertTriangle, PenTool, Check, Filter, Plus, Layers } from 'lucide-react'
import AsyncSelect from 'react-select/async'
import { getProducts } from '@/features/inventory/actions/product-actions'
import { saveDamagedStock, getDamagedStocks, deleteDamagedStock, updateDamagedStock, DamagedStock as DamagedStockType } from '@/features/inventory/actions/damaged-stock-actions'

export default function DamagedStock() {
    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [location, setLocation] = useState('Main Warehouse')
    const [selectedProduct, setSelectedProduct] = useState<any>(null) // { value, label, product_type, custom_id }
    const [quantityInput, setQuantityInput] = useState<number | ''>('')
    const [status, setStatus] = useState<'Damaged' | 'Repair' | 'Exchange'>('Damaged')
    const [remarks, setRemarks] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)

    // History Data State
    const [history, setHistory] = useState<DamagedStockType[]>([])
    const [filteredHistory, setFilteredHistory] = useState<DamagedStockType[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterStatus, setFilterStatus] = useState<'All' | 'Damaged'>('All')

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<Partial<DamagedStockType>>({})

    // Mobile View Details Modal State
    const [viewDetailsItem, setViewDetailsItem] = useState<DamagedStockType | null>(null)

    // Load history on mount
    useEffect(() => {
        fetchHistory()
    }, [])

    // Filter Effect
    useEffect(() => {
        let result = history

        // Filter by Search (Product Name or Remarks)
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            result = result.filter(item =>
                (item.product_name?.toLowerCase().includes(query) || '') ||
                (item.remarks?.toLowerCase().includes(query) || '') ||
                (item.product_custom_id?.toLowerCase().includes(query) || '')
            )
        }

        // Filter by Status Button
        if (filterStatus === 'Damaged') {
            result = result.filter(item => item.status === 'Damaged')
        }

        setFilteredHistory(result)
    }, [history, searchQuery, filterStatus])

    const fetchHistory = async () => {
        try {
            const data = await getDamagedStocks()
            setHistory(data)
        } catch (error) {
            console.error('Failed to load damaged stocks', error)
        } finally {
            setIsLoadingHistory(false)
        }
    }

    // Product Search Handler
    const loadProductOptions = async (inputValue: string) => {
        const { products } = await getProducts({
            search: inputValue,
            limit: 20,
            productType: 'all'
        })

        return products.map(product => ({
            value: product.id,
            label: product.product_name,
            product_type: product.product_type,
            custom_id: String(product.product_id)
        }))
    }

    const handleProductChange = (option: any) => {
        if (option && (option.product_type === 'combo' || option.product_type === 'variation')) {
            alert('Combo product cannot be added.')
            return
        }
        setSelectedProduct(option)
    }

    // Save Handler
    const handleSave = async () => {
        if (!selectedProduct) {
            alert('Please select a product')
            return
        }
        if (quantityInput === '' || quantityInput <= 0) {
            alert('Please enter a valid positive quantity')
            return
        }

        setIsSaving(true)
        try {
            // Logic: 
            // - Damaged: Qty is NEGATIVE (removing from stock)
            // - Repair/Exchange: Qty is POSITIVE (adding back to stock? Or just tracking? User said "+{qty}")
            let finalQty = Number(quantityInput)
            if (status === 'Damaged') {
                finalQty = -Math.abs(finalQty)
            } else {
                finalQty = Math.abs(finalQty)
            }

            await saveDamagedStock({
                date,
                location,
                product_id: selectedProduct.value,
                quantity: finalQty,
                status,
                remarks
            })

            // Reset form
            setSelectedProduct(null)
            setQuantityInput('')
            setStatus('Damaged')
            setRemarks('')
            setIsAddModalOpen(false)

            // Refresh history
            await fetchHistory()
        } catch (error: any) {
            alert(`Error saving damaged stock: ${error.message}`)
        } finally {
            setIsSaving(false)
        }
    }

    // Delete Handler
    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this record?')) return

        try {
            await deleteDamagedStock(id)
            await fetchHistory()
            setViewDetailsItem(null)
        } catch (error: any) {
            alert(`Error deleting: ${error.message}`)
        }
    }

    // Edit Status Handler
    const startEditStatus = (item: DamagedStockType) => {
        setEditingId(item.id)
        setEditForm({ status: item.status })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditForm({})
    }

    const saveStatusEdit = async (item: DamagedStockType) => {
        if (!editForm.status) return

        try {
            // Recalculate Qty Sign based on NEW status
            const absQty = Math.abs(item.quantity)
            let finalQty = absQty

            if (editForm.status === 'Damaged') {
                finalQty = -absQty
            } else {
                finalQty = absQty
            }

            await updateDamagedStock(item.id, {
                status: editForm.status,
                quantity: finalQty
            })

            setEditingId(null)
            await fetchHistory()
        } catch (error: any) {
            alert(`Error updating status: ${error.message}`)
        }
    }

    return (
        <div className="space-y-6">
            {/* HEADER: Search, Filters, Add Button */}
            {/* HEADER */}
            <div className="flex flex-row gap-2 md:gap-4 justify-between items-center bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-lg border dark:border-zinc-800 shadow-sm">

                {/* Search */}
                <div className="relative flex-1 md:flex-none md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 bg-gray-50 dark:bg-zinc-800 dark:text-white"
                    />
                </div>

                {/* Actions Group */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Damaged Filter Button */}
                    <button
                        onClick={() => setFilterStatus(prev => prev === 'Damaged' ? 'All' : 'Damaged')}
                        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors border whitespace-nowrap ${filterStatus === 'Damaged'
                            ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700'
                            }`}
                    >
                        <Filter size={16} />
                        <span className="hidden xs:inline">Damaged Only</span>
                        <span className="xs:hidden">Filter</span>
                    </button>

                    {/* Desktop Add Button (Hidden on Mobile) */}
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-all active:scale-95 ml-auto"
                    >
                        <PenTool size={16} />
                        Add Damage
                    </button>
                </div>
            </div>

            {/* Mobile Header Portal */}
            <MobileHeaderAction onClick={() => setIsAddModalOpen(true)} />

            {/* LIST TABLE */}
            <div className="overflow-x-auto border dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-zinc-800/80 dark:text-white border-b dark:border-white/10">
                        <tr>
                            <th className="hidden md:table-cell px-4 py-3">Date</th>
                            <th className="px-4 py-3">Product Name</th>
                            <th className="hidden md:table-cell px-4 py-3">Product ID</th>
                            <th className="px-4 py-3 text-center">Damage Qty</th>
                            <th className="px-4 py-3">Damage Status</th>
                            <th className="hidden md:table-cell px-4 py-3">Remarks</th>
                            <th className="hidden md:table-cell px-4 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                        {isLoadingHistory ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center">Loading...</td>
                            </tr>
                        ) : filteredHistory.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center">No records found.</td>
                            </tr>
                        ) : (
                            filteredHistory.map((item) => (
                                <tr key={item.id} className="bg-white border-b dark:bg-zinc-900 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                    <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap">{item.date}</td>

                                    {/* Product Name (Clickable on Mobile) */}
                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                        <button
                                            onClick={() => setViewDetailsItem(item)}
                                            className="md:hidden text-left text-blue-600 dark:text-blue-400 font-bold hover:underline"
                                        >
                                            {item.product_name}
                                            <div className="text-xs text-gray-400 font-normal no-underline mt-0.5">(Tap for details)</div>
                                        </button>
                                        <span className="hidden md:inline">{item.product_name}</span>
                                    </td>

                                    <td className="hidden md:table-cell px-4 py-3 font-mono text-xs">{item.product_custom_id || '-'}</td>

                                    {/* Qty */}
                                    <td className={`px-4 py-3 font-mono font-bold text-center ${item.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {item.quantity > 0 ? `+${item.quantity}` : item.quantity}
                                    </td>

                                    {/* Status Badge OR Edit Input */}
                                    <td className="px-4 py-3">
                                        {editingId === item.id ? (
                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    value={editForm.status}
                                                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                                                    className="px-2 py-1 text-xs border rounded bg-white dark:bg-zinc-700 dark:text-white"
                                                >
                                                    <option value="Damaged">Damaged</option>
                                                    <option value="Repair">Repair</option>
                                                    <option value="Exchange">Exchange</option>
                                                </select>
                                                <button
                                                    onClick={() => saveStatusEdit(item)}
                                                    className="text-green-600 hover:bg-green-100 rounded p-1"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    onClick={() => cancelEdit()}
                                                    className="text-gray-500 hover:bg-gray-200 rounded p-1"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col md:flex-row gap-1">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold w-fit
                                                    ${item.status === 'Damaged' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                                        item.status === 'Repair' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                                    {item.status}
                                                </span>
                                            </div>
                                        )}
                                    </td>

                                    <td className="hidden md:table-cell px-4 py-3 truncate max-w-[150px]">{item.remarks || '-'}</td>

                                    {/* Actions */}
                                    <td className="hidden md:table-cell px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {editingId !== item.id && (
                                                <button
                                                    onClick={() => startEditStatus(item)}
                                                    className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                    title="Edit Status"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ADD MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setIsAddModalOpen(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-zinc-800">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Damaged Stock</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Date Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-red-500"
                                />
                            </div>

                            {/* Product Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product</label>
                                <AsyncSelect
                                    cacheOptions
                                    defaultOptions
                                    loadOptions={loadProductOptions}
                                    onChange={handleProductChange}
                                    value={selectedProduct}
                                    placeholder="Search product..."
                                    className="text-sm"
                                    isOptionDisabled={(option: any) => option.product_type?.toLowerCase() === 'combo'}
                                    formatOptionLabel={(option: any) => (
                                        <div className="flex items-center gap-2">
                                            {option.product_type?.toLowerCase() === 'combo' && <Layers size={16} className="text-red-500" />}
                                            <span>{option.label}</span>
                                        </div>
                                    )}
                                    classNames={{
                                        control: (state) => `${state.isFocused ? 'ring-2 ring-red-500 border-red-500' : 'border-gray-300 dark:border-zinc-700'} !bg-white dark:!bg-zinc-800 !text-gray-900 dark:!text-white rounded-lg`,
                                        menu: () => '!bg-white dark:!bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-lg',
                                        option: ({ isFocused }) => `cursor-pointer px-3 py-2 ${isFocused ? '!bg-red-50 dark:!bg-zinc-700/50' : ''} !text-gray-900 dark:!text-white`,
                                        singleValue: () => '!text-gray-900 dark:!text-white',
                                        input: () => '!text-gray-900 dark:!text-white',
                                        placeholder: () => '!text-gray-500 dark:!text-gray-400'
                                    }}
                                />
                            </div>

                            {/* Product ID (Read-only) */}
                            {selectedProduct && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product ID</label>
                                    <input
                                        type="text"
                                        value={selectedProduct.custom_id || '-'}
                                        readOnly
                                        disabled
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border dark:border-zinc-700 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                                    />
                                </div>
                            )}

                            {/* Qty & Status */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={quantityInput}
                                        onChange={e => setQuantityInput(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="w-full px-3 py-2 border dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-red-500"
                                        placeholder="Qty"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Damage Status</label>
                                    <select
                                        value={status}
                                        onChange={e => setStatus(e.target.value as any)}
                                        className="w-full px-3 py-2 border dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-red-500"
                                    >
                                        <option value="Damaged">Damaged</option>
                                        <option value="Repair">Repair</option>
                                        <option value="Exchange">Exchange</option>
                                    </select>
                                </div>
                            </div>

                            {/* Logic Hint */}
                            <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                                {status === 'Damaged' ? (
                                    <span className="flex items-center gap-1 text-red-500">
                                        <AlertTriangle size={12} />
                                        This will reduce stock by {quantityInput || 0}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-green-500">
                                        <Check size={12} />
                                        This will add/return {quantityInput || 0} to stock
                                    </span>
                                )}
                            </div>

                            {/* Remarks */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remarks</label>
                                <textarea
                                    rows={3}
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-red-500"
                                    placeholder="Optional notes..."
                                />
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? 'Saving...' : 'Save Record'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAILS MODAL (Mobile) */}
            {viewDetailsItem && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={() => setViewDetailsItem(null)}
                >
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                            <h3 className="font-bold text-gray-900 dark:text-white">Damage Details</h3>
                            <button onClick={() => setViewDetailsItem(null)} className="p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Product</label>
                                <p className="text-base font-medium text-gray-900 dark:text-white">{viewDetailsItem.product_name}</p>
                                <p className="text-xs text-gray-500 mt-1">ID: {viewDetailsItem.product_custom_id || '-'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                    <p className="text-sm dark:text-gray-200">{viewDetailsItem.date}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantity</label>
                                    <p className={`text-sm font-mono font-bold ${viewDetailsItem.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {viewDetailsItem.quantity > 0 ? `+${viewDetailsItem.quantity}` : viewDetailsItem.quantity}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                    ${viewDetailsItem.status === 'Damaged' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                        viewDetailsItem.status === 'Repair' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                    {viewDetailsItem.status}
                                </span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Remarks</label>
                                <p className="text-sm bg-gray-50 dark:bg-zinc-800/50 p-2 rounded border dark:border-zinc-700 dark:text-gray-300">
                                    {viewDetailsItem.remarks || 'No remarks'}
                                </p>
                            </div>

                            <div className="pt-2">
                                <button
                                    onClick={() => {
                                        if (confirm('Delete this record?')) {
                                            handleDelete(viewDetailsItem.id)
                                        }
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-medium rounded-lg hover:bg-red-200 transition-colors"
                                >
                                    <Trash2 size={16} />
                                    Delete Record
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function MobileHeaderAction({ onClick }: { onClick: () => void }) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    if (!mounted) return null

    const container = document.getElementById('navbar-actions')
    if (!container) return null

    return createPortal(
        <button
            onClick={onClick}
            className="md:hidden p-1.5 bg-red-600 text-white rounded-md shadow-sm active:scale-95 transition-transform"
        >
            <Plus size={20} />
        </button>,
        container
    )
}
