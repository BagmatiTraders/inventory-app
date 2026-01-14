'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Plus } from 'lucide-react'
import { getCourierLocations, getCouriers } from '@/features/settings/actions/courier-actions'
import { getProducts } from '@/features/inventory/actions/product-actions'
import { createMarketplaceOrder, updateMarketplaceOrder, MarketplaceOrder } from '@/features/sales/actions/marketplace-actions'
import { getUserRole } from '@/features/sales/actions/daraz-deletion-actions'
import Select from 'react-select'
import AsyncSelect from 'react-select/async'

interface MarketplaceOrderFormProps {
    onSuccess: () => void
    onCancel: () => void
    initialData?: MarketplaceOrder & { items: any[] } // Extend type to include items
}

interface OrderItem {
    product_id?: string
    product_name: string
    quantity: number
    amount: number
}

export function MarketplaceOrderForm({ onSuccess, onCancel, initialData }: MarketplaceOrderFormProps) {
    const isEditing = !!initialData
    const [isAdmin, setIsAdmin] = useState(false)

    // Form state
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
    const [customerName, setCustomerName] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')
    const [address, setAddress] = useState('')
    const [courierId, setCourierId] = useState<string>('') // Added courierId
    const [deliveryBranchId, setDeliveryBranchId] = useState<string>('')
    const [selectedBranch, setSelectedBranch] = useState<{ label: string, value: string } | null>(null) // Track selected option
    const [branchCharge, setBranchCharge] = useState(0)
    const [deliveryCharge, setDeliveryCharge] = useState(0)
    const [orderStatus, setOrderStatus] = useState('Pending')
    const [remarks, setRemarks] = useState('')

    // Order items
    const [orderItems, setOrderItems] = useState<OrderItem[]>([
        { product_name: '', quantity: 1, amount: 0 }
    ])

    const [isSubmitting, setIsSubmitting] = useState(false)

    // Check if user is admin
    useEffect(() => {
        getUserRole().then(role => {
            setIsAdmin(role === 'admin')
        })
    }, [])

    // Load initial data if editing
    useEffect(() => {
        if (initialData) {
            setOrderDate(initialData.order_date.split('T')[0])
            setCustomerName(initialData.customer_name)
            setPhoneNumber(initialData.phone_number)
            setAddress(initialData.address || '')
            setCourierId(initialData.courier_id || '')
            setDeliveryBranchId(initialData.delivery_branch_id || '')

            // Set initial selected branch if exists
            // Check both delivery_branch_id and the joined branch object
            if (initialData.delivery_branch_id) {
                // Handle different possible structures of 'branch' (single object or array from join)
                const branchData = (initialData as any).branch
                let branchName = 'Unknown Branch'
                let branchCharge = initialData.branch_charge

                if (branchData) {
                    if (Array.isArray(branchData) && branchData.length > 0) {
                        branchName = branchData[0].branch_name
                    } else if (typeof branchData === 'object') {
                        branchName = branchData.branch_name
                    }
                }

                // If branch name is still unknown but we have an ID, try to be helpful or just show ID? 
                // Better to show what we have.

                setSelectedBranch({
                    label: branchName || 'Unknown Branch',
                    value: initialData.delivery_branch_id,
                    deliveryCharge: branchCharge
                } as any)
            } else {
                setSelectedBranch(null)
            }

            setBranchCharge(initialData.branch_charge)
            setDeliveryCharge(initialData.delivery_charge)
            setOrderStatus(initialData.order_status)
            setRemarks(initialData.remarks || '')

            if (initialData.items && initialData.items.length > 0) {
                setOrderItems(initialData.items.map(item => ({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    amount: item.amount
                })))
            }
        }
    }, [initialData])



    // Fetch couriers
    const { data: couriers = [] } = useQuery({
        queryKey: ['couriers'],
        queryFn: getCouriers
    })

    const loadProductOptions = async (inputValue: string) => {
        const { products } = await getProducts({
            search: inputValue,
            limit: 50,
            productType: 'all'
        })

        return products.map(product => ({
            value: product.id,
            label: `${product.product_name} (ID: ${product.product_id})`,
            name: product.product_name
        }))
    }



    // Prepare courier options - Sorted with Active first
    const courierOptions = [...couriers]
        .sort((a, b) => {
            // Sort by active status first (active first), then by name
            if (a.is_active === b.is_active) {
                return a.courier_name.localeCompare(b.courier_name)
            }
            return a.is_active ? -1 : 1
        })
        .map(c => ({
            value: c.id,
            label: c.courier_name,
            isActive: c.is_active
        }))

    // Load branch options for AsyncSelect
    const loadBranchOptions = async (inputValue: string) => {
        if (!courierId) return []
        const locations = await getCourierLocations(courierId, inputValue)
        return locations.map(loc => ({
            value: loc.id,
            label: loc.branch_name,
            deliveryCharge: loc.delivery_charge
        }))
    }



    // Auto-select first active courier if not editing and no courier selected
    useEffect(() => {
        if (!isEditing && !courierId && couriers.length > 0) {
            const activeCourier = couriers.find(c => c.is_active)
            if (activeCourier) {
                setCourierId(activeCourier.id)
            }
        }
    }, [isEditing, courierId, couriers])

    // Calculate total amount
    const calculateTotal = () => {
        const itemsTotal = orderItems.reduce((sum, item) => {
            return sum + (item.quantity * item.amount)
        }, 0)
        return itemsTotal + deliveryCharge
    }

    const totalAmount = calculateTotal()

    // Add new product row
    const handleAddItem = () => {
        setOrderItems([...orderItems, { product_name: '', quantity: 1, amount: 0 }])
    }

    // Remove product row
    const handleRemoveItem = (index: number) => {
        if (orderItems.length > 1) {
            setOrderItems(orderItems.filter((_, i) => i !== index))
        }
    }

    // Update item
    const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
        setOrderItems(prev => {
            const newItems = [...prev]
            newItems[index] = { ...newItems[index], [field]: value }
            return newItems
        })
    }

    // Handle product selection
    const handleProductSelect = (index: number, option: any) => {
        setOrderItems(prev => {
            const newItems = [...prev]
            if (option) {
                newItems[index] = {
                    ...newItems[index],
                    product_id: option.value,
                    product_name: option.name
                }
            } else {
                newItems[index] = {
                    ...newItems[index],
                    product_id: undefined,
                    product_name: ''
                }
            }
            return newItems
        })
    }

    // Handle branch selection
    const handleBranchSelect = (option: any) => {
        setDeliveryBranchId(option?.value || '')
        setSelectedBranch(option) // Update selected option
        if (option) {
            setBranchCharge(option.deliveryCharge || 0)
        } else {
            setBranchCharge(0)
        }
    }

    // Handle courier selection
    const handleCourierSelect = (option: any) => {
        const newCourierId = option?.value || ''
        setCourierId(newCourierId)

        // Reset branch and charge immediately when courier changes
        setDeliveryBranchId('')
        setSelectedBranch(null)
        setBranchCharge(0)
    }

    // Validate phone number (10 digits)
    const validatePhoneNumber = (phone: string) => {
        return /^\d{10}$/.test(phone)
    }

    // Handle submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation
        if (!customerName.trim()) {
            alert('Customer name is required')
            return
        }

        if (!validatePhoneNumber(phoneNumber)) {
            alert('Phone number must be exactly 10 digits')
            return
        }

        // Validate items
        const validItems = orderItems.filter(item => item.product_name.trim() && item.quantity > 0)
        if (validItems.length === 0) {
            alert('Please add at least one product')
            return
        }

        setIsSubmitting(true)

        try {
            const orderData = {
                order_date: orderDate,
                customer_name: customerName,
                phone_number: phoneNumber,
                address: address || undefined,
                delivery_branch_id: deliveryBranchId || undefined,
                courier_id: courierId || undefined, // Include courier_id
                branch_charge: branchCharge,
                delivery_charge: deliveryCharge,
                order_status: orderStatus,
                remarks: remarks || undefined,
                items: validItems
            }

            if (isEditing && initialData) {
                await updateMarketplaceOrder(initialData.id, orderData)
                alert('Order updated successfully!')
            } else {
                await createMarketplaceOrder(orderData)
                alert('Order created successfully!')
            }

            onSuccess()
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Row 1: Date, Sales ID */}
            <div className="col-span-1">
                <label className="block text-xs font-medium mb-1">
                    Date <span className="text-red-500">*</span>
                </label>
                <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                    required
                />
            </div>

            <div className="col-span-1">
                <label className="block text-xs font-medium mb-1">
                    Sales ID
                </label>
                <input
                    type="text"
                    value={initialData?.sales_id || "Auto-generated"}
                    disabled
                    className="w-full px-2.5 py-1.5 text-sm bg-gray-100 dark:bg-zinc-800 border dark:border-zinc-700 rounded-md text-gray-500 cursor-not-allowed"
                />
            </div>

            {/* Row 2: Customer Name, Phone Number */}
            <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-medium mb-1">
                    Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                    placeholder="Enter customer name"
                    required
                />
            </div>

            <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-medium mb-1">
                    Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10)
                        setPhoneNumber(value)
                    }}
                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                    placeholder="10 digit number"
                    maxLength={10}
                    required
                />
            </div>

            {/* Row 3: Courier, Address */}
            <div className="col-span-1 md:col-span-1">
                <label className="block text-xs font-medium mb-1">
                    Courier
                </label>
                <Select
                    options={courierOptions}
                    value={courierOptions.find(c => c.value === courierId)}
                    onChange={handleCourierSelect}
                    className="text-sm"
                    classNamePrefix="select"
                    placeholder="Select courier..."
                    isDisabled={isEditing && !isAdmin} // Read-only in edit mode unless admin
                    isClearable={!isEditing}
                />
            </div>

            <div className="col-span-1 md:col-span-3">
                <label className="block text-xs font-medium mb-1">
                    Address
                </label>
                <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                    placeholder="Customer address"
                />
            </div>

            {/* Row 4: Delivery Branch, Branch Charge */}
            <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-medium mb-1">
                    Delivery Branch
                </label>
                <AsyncSelect
                    key={courierId} // Reset when courier changes
                    cacheOptions
                    defaultOptions
                    loadOptions={loadBranchOptions}
                    value={selectedBranch}
                    onChange={handleBranchSelect}
                    className="text-sm"
                    classNamePrefix="select"
                    placeholder={courierId ? "Search branch..." : "Select courier first"}
                    isClearable
                    isDisabled={!courierId || (isEditing && !isAdmin)} // Disabled if no courier OR (editing AND not admin)
                    noOptionsMessage={() => courierId ? "No branches found" : "Select courier first"}
                />
            </div>

            <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-medium mb-1">
                    Branch Charge
                </label>
                <input
                    type="number"
                    value={branchCharge}
                    disabled
                    className="w-full px-2.5 py-1.5 text-sm bg-gray-100 dark:bg-zinc-800 border dark:border-zinc-700 rounded-md text-gray-500 cursor-not-allowed"
                />
            </div>

            {/* Product Items */}
            <div className="col-span-2 md:col-span-4 border dark:border-zinc-700 rounded-lg p-3 bg-blue-50 dark:bg-blue-900/10">
                <h3 className="text-sm font-medium mb-3">Order Items</h3>

                {orderItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b dark:border-zinc-700 last:border-0 last:pb-0">
                        <div className="col-span-2">
                            <label className="block text-xs font-medium mb-1">
                                Product Name <span className="text-red-500">*</span>
                            </label>
                            <AsyncSelect
                                cacheOptions
                                defaultOptions
                                loadOptions={loadProductOptions}
                                value={item.product_name ? {
                                    value: item.product_id || '',
                                    label: item.product_name,
                                    name: item.product_name
                                } : null}
                                onChange={(option) => handleProductSelect(index, option)}
                                className="text-sm"
                                classNamePrefix="select"
                                placeholder="Search product..."
                                isClearable
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="block text-xs font-medium mb-1">
                                Qty <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 bg-white"
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="block text-xs font-medium mb-1">
                                Amount <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.amount}
                                    onChange={(e) => handleItemChange(index, 'amount', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveItem(index)}
                                    disabled={orderItems.length === 1}
                                    className="px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full mt-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center justify-center gap-1"
                >
                    <Plus size={14} />
                    Add Product
                </button>
            </div>

            {/* Next Row: Delivery Charge, Total Amount, Order Status */}
            <div className="col-span-1 md:col-span-1">
                <label className="block text-xs font-medium mb-1">
                    Delivery Charge
                </label>
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={deliveryCharge}
                    onChange={(e) => setDeliveryCharge(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                />
            </div>

            <div className="col-span-1 md:col-span-1">
                <label className="block text-xs font-medium mb-1">
                    Total Amount
                </label>
                <input
                    type="text"
                    value={`Rs ${totalAmount.toFixed(2)}`}
                    disabled
                    className="w-full px-2.5 py-1.5 text-sm font-bold bg-gray-100 dark:bg-zinc-800 border dark:border-zinc-700 rounded-md text-gray-900 dark:text-gray-100"
                />
            </div>

            <div className="col-span-2 md:col-span-2">
                <label className="block text-xs font-medium mb-1">
                    Order Status
                </label>
                <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                >
                    <option value="Pending">Pending</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Returning to Seller">Returning to Seller</option>
                    <option value="Fail Delivered">Fail Delivered</option>
                    <option value="Customer Return">Customer Return</option>
                    <option value="Return Delivered">Return Delivered</option>
                    <option value="Cancel">Cancel</option>
                </select>
            </div>

            {/* Remarks */}
            <div className="col-span-2 md:col-span-4">
                <label className="block text-xs font-medium mb-1">
                    Remarks
                </label>
                <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border dark:border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                    rows={1}
                    placeholder="Optional notes..."
                />
            </div>

            {/* Action Buttons */}
            <div className="col-span-2 md:col-span-4 flex items-center justify-end gap-3 pt-3 border-t dark:border-zinc-700">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="px-4 py-1.5 text-sm border dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                    Close
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Saving...' : (isEditing ? 'Update Order' : 'Add Order')}
                </button>
            </div>
        </form>
    )
}
