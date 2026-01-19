'use client'

import { X, Edit } from 'lucide-react'
import { SalesBill, SalesBillItem, getSalesBillById } from '@/features/sales/actions/sales-bill-actions'
import { useQuery } from '@tanstack/react-query'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'

interface SalesBillDetailModalProps {
    billId: string
    onClose: () => void
    onEdit: (bill: SalesBill) => void
}

export function SalesBillDetailModal({ billId, onClose, onEdit }: SalesBillDetailModalProps) {
    // Fetch Bill Details (with items)
    const { data: bill, isLoading } = useQuery({
        queryKey: ['sales-bill', billId],
        queryFn: () => getSalesBillById(billId),
    })

    // Fetch Seller Details to get PAN/VAT
    const { data: companies = [] } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails,
        enabled: !!bill?.seller_company_id, // Only fetch if we have seller id
        staleTime: 1000 * 60 * 5
    })

    if (isLoading || !bill) {
        return (
            <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center">
                <div className="bg-white p-4 rounded-md">Loading details...</div>
            </div>
        )
    }

    const seller = companies.find((c: any) => c.id === bill.seller_company_id)

    // ... rest of the render using 'bill' from query result ...

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
                {/* Header Actions */}
                <div className="flex justify-end p-4 border-b dark:border-zinc-800">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-gray-500"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    {/* Row 1: Seller Name (Center) */}
                    <div className="text-center">
                        <h2 className="text-2xl font-bold uppercase tracking-wide">
                            {seller?.company_name || 'Unknown Seller'}
                        </h2>
                    </div>

                    {/* Row 2: Seller PAN/VAT (Center) */}
                    <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-semibold">PAN/VAT No:</span> {seller?.pan_vat_number || 'N/A'}
                    </div>

                    {/* Row 3: Customer Name (Left) - Invoice No (Right) */}
                    <div className="flex justify-between items-start pt-4">
                        <div>
                            <div className="text-sm text-gray-500">Customer Name</div>
                            <div className="font-semibold text-lg">{bill.customer_name}</div>
                            {bill.customer_address && (
                                <div className="text-sm text-gray-600 dark:text-gray-400">{bill.customer_address}</div>
                            )}
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-500">Invoice No</div>
                            <div className="font-bold text-lg text-blue-600">{bill.invoice_no}</div>
                            <div className="text-sm text-gray-500 mt-1">Date: {bill.bill_date_ad}</div>
                        </div>
                    </div>

                    {/* Row 4: Customer Pan/Vat (Left) */}
                    <div>
                        <span className="text-sm font-semibold text-gray-500">Customer PAN/VAT:</span>
                        <span className="ml-2 text-gray-700 dark:text-gray-300">{bill.customer_pan_vat || 'N/A'}</span>
                    </div>

                    {/* Row 5: Items Table */}
                    <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden mt-4">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 font-semibold border-b dark:border-zinc-700">
                                <tr>
                                    <th className="px-4 py-2 text-left w-24">H.S Code</th>
                                    <th className="px-4 py-2 text-left">Particulars</th>
                                    <th className="px-4 py-2 text-right w-24">Qty</th>
                                    <th className="px-4 py-2 text-right w-32">Rate</th>
                                    <th className="px-4 py-2 text-right w-32">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                {bill.items?.map((item, index) => (
                                    <tr key={index}>
                                        <td className="px-4 py-3 text-gray-500">{item.hs_code || '-'}</td>
                                        <td className="px-4 py-3">{item.particulars}</td>
                                        <td className="px-4 py-3 text-right">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right">{formatNepaliCurrency(item.rate)}</td>
                                        <td className="px-4 py-3 text-right font-medium">{formatNepaliCurrency(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Totals */}
                    <div className="flex justify-end pt-4">
                        <div className="w-64 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Sub Total Amount</span>
                                <span className="font-medium">{formatNepaliCurrency(bill.sub_total_amount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">13% VAT</span>
                                <span className="font-medium">{formatNepaliCurrency(bill.vat_amount)}</span>
                            </div>
                            <div className="border-t dark:border-zinc-700 pt-2 flex justify-between text-base font-bold">
                                <span>Total Amount</span>
                                <span className="text-blue-600">{formatNepaliCurrency(bill.total_amount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex justify-end gap-3 pt-6 border-t dark:border-zinc-800">
                        <button
                            onClick={() => onEdit(bill)}
                            className="flex items-center gap-2 px-4 py-2 border dark:border-zinc-700 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium"
                        >
                            <Edit className="h-4 w-4" /> Edit
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
