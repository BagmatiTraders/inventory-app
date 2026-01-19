'use client'

import { Card } from '@/components/ui-shim'
import { ArrowLeft } from 'lucide-react'

import { useEffect, useState } from 'react'
import { getStatementDetails } from '@/features/account/actions/daraz-account-actions'
import { toast } from 'sonner'

interface StatementDetailViewProps {
    period: string
    storeId: string // Need storeId to fetch data
    onBack: () => void
}

export function StatementDetailView({ period, storeId, onBack }: StatementDetailViewProps) {
    const [data, setData] = useState({
        productPricePaidByBuyer: 0,
        coFundedVoucherMax: 0,
        shippingFeePaidByBuyer: 0,
        paymentFee: 0,
        darazCoinsDiscount: 0,
        freeShippingMaxFee: 0,
        commissionFee: 0,
        shippingFee: 0,
        shippingFeeDiscount: 0,
        coFundedVoucherMaxReversal: 0,
        productPriceRefunded: 0,
        gstWithholding: 0,
        handlingFeeReturn: 0,
        handlingFee: 0,
        paymentFeeRefunded: 0,
        darazCoinsReversal: 0,
        freeShippingNaxReversal: 0,
        commissionFeeRefunded: 0
    })
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true)
            try {
                // Parse period string "Jan 13, 2026 - Jan 19, 2026"
                // This is a bit fragile, ideally pass raw dates. 
                // But let's parse standard format we generated.
                const [startStr, endStr] = period.split(' - ')

                // Convert to YYYY-MM-DD for DB
                // Assumption: Parsing 'Jan 13, 2026' works in JS Date
                const startDate = new Date(startStr).toISOString()
                // For End Date, we want end of day? 
                // The DB filter is lte('delivered_at', endDate). 
                // If 'Jan 19', Date() gives 'Jan 19 00:00'. We need 'Jan 19 23:59:59' 
                // OR add 1 day and use lt.
                const endDateObj = new Date(endStr)
                endDateObj.setHours(23, 59, 59, 999)
                const endDate = endDateObj.toISOString()

                // @ts-ignore
                const res = await getStatementDetails(storeId, startDate, endDate)
                setData(res)
            } catch (error) {
                console.error(error)
                toast.error('Failed to load statement details')
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [period, storeId])

    const formatCurrency = (val: number) => {
        return `NPR ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    // Calculate Closing Balance (Sum of everything)
    const closingBalance = Object.values(data).reduce((acc, val) => acc + val, 0)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Statement Details</h2>
                    <p className="text-sm text-gray-500">{period}</p>
                </div>
            </div>

            {/* Details Table */}
            <Card className={`overflow-hidden border border-gray-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900 ${isLoading ? 'opacity-50' : ''}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 font-medium">
                            <tr className="border-b border-gray-200 dark:border-zinc-800">
                                <th className="px-6 py-4 w-1/4">Fee Type</th>
                                <th className="px-6 py-4 w-1/2">Fee Name</th>
                                <th className="px-6 py-4 w-1/4 text-right">Fee Amount (NPR)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {/* Opening Balance */}
                            <tr className="bg-gray-50/50 dark:bg-zinc-900/50">
                                <td className="px-6 py-3 font-semibold text-gray-700 dark:text-gray-300">Opening Balance</td>
                                <td className="px-6 py-3"></td>
                                <td className="px-6 py-3 text-right font-mono text-gray-900 dark:text-gray-100">NPR 0.00</td>
                            </tr>

                            {/* Delivered Orders */}
                            <SectionRow
                                title="Delivered Orders"
                                items={[
                                    { label: "Co-funded Voucher Max", value: data.coFundedVoucherMax },
                                    { label: "Shipping Fee Paid by Buyer", value: data.shippingFeePaidByBuyer },
                                    { label: "Product Price Paid by Buyer", value: data.productPricePaidByBuyer }
                                ]}
                                formatCurrency={formatCurrency}
                            />

                            {/* Transaction Fees */}
                            <SectionRow
                                title="Transaction Fees"
                                items={[
                                    { label: "Payment Fee", value: data.paymentFee },
                                    { label: "Daraz Coins Discount Participation Fee", value: data.darazCoinsDiscount },
                                    { label: "Free Shipping Max Fee", value: data.freeShippingMaxFee },
                                    { label: "Commission Fee", value: data.commissionFee },
                                    { label: "Shipping Fee", value: data.shippingFee },
                                    { label: "Shipping Fee Discount", value: data.shippingFeeDiscount }
                                ]}
                                formatCurrency={formatCurrency}
                            />

                            {/* Returned Orders */}
                            <SectionRow
                                title="Returned Orders"
                                items={[
                                    { label: "Co-funded Voucher Max Reversal", value: data.coFundedVoucherMaxReversal },
                                    { label: "Product Price Refunded to Buyer", value: data.productPriceRefunded }
                                ]}
                                formatCurrency={formatCurrency}
                            />

                            {/* Withholding */}
                            <SectionRow
                                title="Withholding"
                                items={[
                                    { label: "General Sales Tax Withholding", value: data.gstWithholding },
                                    { label: "General Sales Tax Withholding ", value: 0 } // Kept distinct as requested, though seemingly duplicate
                                ]}
                                formatCurrency={formatCurrency}
                            />

                            {/* Logistics & Fulfillment Services */}
                            <SectionRow
                                title="Logistics & Fulfillment Services"
                                items={[
                                    { label: "Handling Fee for Return", value: data.handlingFeeReturn },
                                    { label: "Handling Fee", value: data.handlingFee }
                                ]}
                                formatCurrency={formatCurrency}
                            />

                            {/* Transaction Fees Refunded */}
                            <SectionRow
                                title="Transaction Fees Refunded"
                                items={[
                                    { label: "Payment Fee Refunded", value: data.paymentFeeRefunded },
                                    { label: "Reversal of DARAZ Coins Discount Participation Fee", value: data.darazCoinsReversal },
                                    { label: "Reversal of Free Shipping Max Fee", value: data.freeShippingNaxReversal },
                                    { label: "Commission Fee Refunded", value: data.commissionFeeRefunded }
                                ]}
                                formatCurrency={formatCurrency}
                            />

                            {/* Closing Balance */}
                            <tr className="bg-gray-50/50 dark:bg-zinc-900/50 border-t-2 border-gray-200 dark:border-zinc-700">
                                <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">Closing Balance</td>
                                <td className="px-6 py-4"></td>
                                <td className="px-6 py-4 text-right font-bold font-mono text-gray-900 dark:text-gray-100">
                                    {formatCurrency(closingBalance)}
                                </td>
                            </tr>

                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}

function SectionRow({ title, items, formatCurrency }: { title: string, items: { label: string, value: number }[], formatCurrency: (v: number) => string }) {
    // Calculate Subtotal (Sum of values)
    const subtotal = items.reduce((sum, item) => sum + item.value, 0)

    return (
        <>
            {/* First row with Title and Subtotal */}
            <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 group">
                <td className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300 align-top pt-4" rowSpan={items.length + 1}>
                    {title}
                </td>
                <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100 border-b border-gray-50 dark:border-zinc-800/50 pt-4">
                    Subtotal
                </td>
                <td className="px-6 py-3 text-right font-medium text-gray-900 dark:text-gray-100 border-b border-gray-50 dark:border-zinc-800/50 pt-4">
                    {formatCurrency(subtotal)}
                </td>
            </tr>
            {/* Item rows */}
            {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                    {/* First column is spanned by the parent */}
                    <td className="px-6 py-2 text-gray-500 dark:text-gray-400 pl-6">
                        {item.label}
                    </td>
                    <td className="px-6 py-2 text-right text-gray-500 dark:text-gray-400 font-mono text-xs">
                        {item.value !== 0 ? formatCurrency(item.value) : '-'}
                    </td>
                </tr>
            ))}
        </>
    )
}
