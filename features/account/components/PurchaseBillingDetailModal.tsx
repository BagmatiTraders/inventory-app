'use client'

import { useState, useEffect } from 'react'
import { X, Eye, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getPurchaseBillingDetail } from '@/features/account/actions/purchase-billing-detail-actions'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'
import { format } from 'date-fns'
import { ViewPanVatBillModal } from './ViewPanVatBillModal'

interface PurchaseBillingDetailModalProps {
    supplierCompanyId: string | null
    supplierCompanyName: string | null
    buyerCompanyId: string | null
    buyerCompanyName: string | null
    fiscalYearId?: string | null
    fiscalYearName?: string
    startDate?: string
    endDate?: string
    onClose: () => void
}

export function PurchaseBillingDetailModal({
    supplierCompanyId,
    supplierCompanyName,
    buyerCompanyId,
    buyerCompanyName,
    fiscalYearId,
    fiscalYearName,
    startDate,
    endDate,
    onClose,
}: PurchaseBillingDetailModalProps) {
    const [selectedBillId, setSelectedBillId] = useState<string | null>(null)
    const [showBalanceConfirmationMessage, setShowBalanceConfirmationMessage] = useState(false)

    // Fetch detailed billing data
    const { data, isLoading } = useQuery({
        queryKey: ['purchase-billing-detail', supplierCompanyId, buyerCompanyId, fiscalYearId, startDate, endDate],
        queryFn: () => getPurchaseBillingDetail({
            supplierCompanyId,
            buyerCompanyId,
            fiscalYearId,
            startDate,
            endDate,
        }),
    })

    const handleBalanceConfirmationClick = () => {
        if (data && data.totalAmount < 100000) {
            setShowBalanceConfirmationMessage(true)
            setTimeout(() => setShowBalanceConfirmationMessage(false), 3000)
        } else {
            // TODO: Implement balance confirmation generation logic later
            alert('Balance Confirmation feature will be implemented later.')
        }
    }

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Billed From: {supplierCompanyName || 'N/A'}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Fiscal Year: {fiscalYearName || 'All Fiscal Years'}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Balance Confirmation Button */}
                        <div className="mb-4 flex items-center gap-3">
                            <button
                                onClick={handleBalanceConfirmationClick}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
                            >
                                Balance Confirmation
                            </button>
                            {showBalanceConfirmationMessage && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md border border-red-200 dark:border-red-800">
                                    <AlertCircle className="h-4 w-4" />
                                    <span className="text-sm font-medium">Cannot Generate : Amount Less than Rs 100000</span>
                                </div>
                            )}
                        </div>

                        {/* Bills Table */}
                        {isLoading ? (
                            <div className="text-center py-12 text-gray-500">
                                Loading bills...
                            </div>
                        ) : !data || data.bills.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                No bills found for this combination.
                            </div>
                        ) : (
                            <div className="border dark:border-zinc-700 rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-zinc-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                S.N
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Date (AD)
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Date (BS)
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Invoice No
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Billed To
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Total Amount
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                                        {data.bills.map((bill, index) => (
                                            <tr key={bill.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-4 py-3 text-[13px] text-gray-500">
                                                    {index + 1}
                                                </td>
                                                <td className="px-4 py-3 text-[13px] font-medium text-gray-900 dark:text-gray-100">
                                                    {format(new Date(bill.issue_bill_date_ad), 'MMM dd, yyyy')}
                                                </td>
                                                <td className="px-4 py-3 text-[13px] text-gray-500 dark:text-gray-400">
                                                    {bill.issue_bill_date_bs}
                                                </td>
                                                <td className="px-4 py-3 text-[13px]">
                                                    <button
                                                        onClick={() => setSelectedBillId(bill.id)}
                                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline font-medium"
                                                    >
                                                        {bill.invoice_no}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-[13px] text-gray-900 dark:text-gray-100">
                                                    {bill.buyer_company_name || 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-[13px] text-right font-medium text-gray-900 dark:text-gray-100">
                                                    {formatNepaliCurrency(bill.total_amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-blue-50 dark:bg-blue-900/20">
                                        <tr>
                                            <td colSpan={5} className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-gray-100">
                                                Total Amount:
                                            </td>
                                            <td className="px-4 py-3 text-right text-base font-bold text-blue-600 dark:text-blue-400">
                                                {formatNepaliCurrency(data.totalAmount)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* View Bill Modal */}
            {selectedBillId && (
                <ViewPanVatBillModal
                    billId={selectedBillId}
                    onClose={() => setSelectedBillId(null)}
                />
            )}
        </>
    )
}
