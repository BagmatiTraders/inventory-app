'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSalesBills, SalesBill } from '@/features/sales/actions/sales-bill-actions'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { Search, X } from 'lucide-react'

import { Card } from '@/components/ui-shim'

interface SalesBillListProps {
    onViewBill: (billId: string) => void
}

export function SalesBillList({ onViewBill }: SalesBillListProps) {
    const [fiscalYearId, setFiscalYearId] = useState<string>('all')
    const [search, setSearch] = useState('')

    // Fetch fiscal years
    const { data: fiscalYears = [] } = useFiscalYears()
    const { data: activeFy } = useActiveFiscalYear()

    // Initialize with active FY
    useEffect(() => {
        if (activeFy && fiscalYearId === 'all') {
            setFiscalYearId(activeFy.id)
        }
    }, [activeFy])

    const { data: bills = [], isLoading } = useQuery({
        queryKey: ['sales-bills', fiscalYearId, search],
        queryFn: () => getSalesBills({ fiscalYearId, search }),
    })

    const handleClearFilters = () => {
        setFiscalYearId('all')
        setSearch('')
    }

    return (
        <Card className="overflow-hidden">
            {/* Filters */}
            <div className="p-3 border-b dark:border-zinc-800">
                <div className="flex flex-col md:flex-row gap-3">
                    {/* Fiscal Year Filter */}
                    <div className="flex-1">
                        <select
                            value={fiscalYearId}
                            onChange={(e) => setFiscalYearId(e.target.value)}
                            className="w-full px-3 py-1.5 text-[13px] border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                        >
                            <option value="all">All Fiscal Years</option>
                            {fiscalYears.map((fy) => (
                                <option key={fy.id} value={fy.id}>
                                    {fy.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Search Filter */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search invoice or customer..."
                            className="w-full pl-9 pr-3 py-1.5 text-[13px] border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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

            {/* List */}
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-gray-400">
                        <tr>
                            <th className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Date (AD)</th>
                            <th className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Invoice No</th>
                            <th className="px-3 py-2 text-xs font-bold uppercase tracking-wider">Customer</th>
                            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider">Sub Total</th>
                            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider">VAT</th>
                            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider">Total Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-[13px]">
                                    Loading sales bills...
                                </td>
                            </tr>
                        ) : bills.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-[13px]">
                                    No sales bills found for the selected criteria.
                                </td>
                            </tr>
                        ) : (
                            bills.map((bill) => (
                                <tr key={bill.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                    <td className="px-3 py-2 text-[13px] text-gray-500 dark:text-gray-400">
                                        {bill.bill_date_ad}
                                    </td>
                                    <td className="px-3 py-2 text-[13px] font-medium">
                                        <button
                                            onClick={() => onViewBill(bill.id)}
                                            className="text-blue-600 hover:text-blue-800 hover:underline"
                                        >
                                            {bill.invoice_no}
                                        </button>
                                    </td>
                                    <td className="px-3 py-2 text-[13px] font-medium text-gray-900 dark:text-gray-100">
                                        {bill.customer_name}
                                    </td>
                                    <td className="px-3 py-2 text-[13px] text-right text-gray-600 dark:text-gray-400">
                                        {formatNepaliCurrency(bill.sub_total_amount)}
                                    </td>
                                    <td className="px-3 py-2 text-[13px] text-right text-gray-600 dark:text-gray-400">
                                        {formatNepaliCurrency(bill.vat_amount)}
                                    </td>
                                    <td className="px-3 py-2 text-[13px] text-right font-medium text-blue-600 dark:text-blue-400">
                                        {formatNepaliCurrency(bill.total_amount)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    )
}
