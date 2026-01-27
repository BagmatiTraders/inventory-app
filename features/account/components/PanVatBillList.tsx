'use client'

import { useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { Card } from '@/components/ui-shim'
import { useQuery } from '@tanstack/react-query'
import { getPanVatBills, type PanVatBill } from '@/features/account/actions/pan-vat-bill-actions'
import { format } from 'date-fns'
import { ViewPanVatBillModal } from './ViewPanVatBillModal'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { useEffect } from 'react'

interface PanVatBillListProps {
    onAddBill: () => void
}

export function PanVatBillList({ onAddBill }: PanVatBillListProps) {
    const [fiscalYearId, setFiscalYearId] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [selectedBillId, setSelectedBillId] = useState<string | null>(null)

    // Fetch fiscal years
    const { data: fiscalYearsData } = useFiscalYears()
    const fiscalYears = fiscalYearsData || []
    const { data: activeFiscalYear } = useActiveFiscalYear()

    // Set active fiscal year as default on mount
    useEffect(() => {
        if (activeFiscalYear && fiscalYearId === 'all') {
            setFiscalYearId(activeFiscalYear.id)
        }
    }, [activeFiscalYear])

    // Get selected fiscal year data
    const selectedFiscalYear = fiscalYearId !== 'all' ? fiscalYears.find(fy => fy.id === fiscalYearId) : null

    const { data: bills = [], isLoading } = useQuery({
        queryKey: ['pan-vat-bills', fiscalYearId, search, selectedFiscalYear?.start_date, selectedFiscalYear?.end_date],
        queryFn: () => getPanVatBills({
            fiscalYearId: fiscalYearId !== 'all' ? fiscalYearId : undefined,
            startDate: selectedFiscalYear?.start_date,
            endDate: selectedFiscalYear?.end_date,
            search: search || undefined,
        }),
    })

    const handleClearFilters = () => {
        setFiscalYearId('all')
        setSearch('')
    }

    return (
        <div className="space-y-4">
            <Card className="overflow-hidden">
                {/* Filters */}
                <div className="p-3 border-b dark:border-zinc-800">
                    <div className="flex flex-col md:flex-row gap-3">
                        {/* Fiscal Year Dropdown */}
                        <div className="flex-1">
                            <select
                                value={fiscalYearId}
                                onChange={(e) => setFiscalYearId(e.target.value)}
                                className="w-full px-3 py-1.5 text-[13px] border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">All Fiscal Years</option>
                                {fiscalYears.map((fy) => (
                                    <option key={fy.id} value={fy.id}>
                                        {fy.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Search Box */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by supplier, buyer, or invoice..."
                                className="w-full pl-9 pr-3 py-1.5 text-[13px] border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Clear Button */}
                        {(fiscalYearId !== 'all' || search) && (
                            <button
                                onClick={handleClearFilters}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] border dark:border-zinc-700 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                            >
                                <X className="h-3.5 w-3.5" />
                                Clear Filters
                            </button>
                        )}
                    </div>
                </div>

                {/* Bills Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-zinc-800">
                            <tr>
                                <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">S.N</th>
                                <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date (AD)</th>
                                <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date (BS)</th>
                                <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Invoice No</th>
                                <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier</th>
                                <th className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Buyer</th>
                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-3 py-8 text-center text-gray-500 text-[13px]">
                                        Loading bills...
                                    </td>
                                </tr>
                            ) : bills.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-3 py-8 text-center text-gray-500 text-[13px]">
                                        No bills found. Click "Add Bill" to create one.
                                    </td>
                                </tr>
                            ) : (
                                bills.map((bill, index) => (
                                    <tr key={bill.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-3 py-2 text-[13px] text-gray-500">{index + 1}</td>
                                        <td className="px-3 py-2 text-[13px] font-medium text-gray-900 dark:text-gray-100">{format(new Date(bill.issue_bill_date_ad), 'MMM dd, yyyy')}</td>
                                        <td className="px-3 py-2 text-[13px] text-gray-500 dark:text-gray-400">{bill.issue_bill_date_bs}</td>
                                        <td className="px-3 py-2 text-[13px] font-medium">
                                            <button
                                                onClick={() => setSelectedBillId(bill.id)}
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                            >
                                                {bill.invoice_no}
                                            </button>
                                        </td>
                                        <td className="px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100">{bill.supplier_company_name || '-'}</td>
                                        <td className="px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100">{bill.buyer_company_name || '-'}</td>
                                        <td className="px-3 py-2 text-[13px] text-right font-medium text-gray-900 dark:text-gray-100">
                                            Rs. {bill.total_amount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* View Bill Modal */}
            {selectedBillId && (
                <ViewPanVatBillModal
                    billId={selectedBillId}
                    onClose={() => setSelectedBillId(null)}
                />
            )}
        </div>
    )
}
