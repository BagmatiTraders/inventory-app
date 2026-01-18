'use client'

import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getPartiesStatement, type PartiesStatementItem } from '@/features/account/actions/parties-statement-actions'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'

export function PartiesStatement() {
    const [fiscalYearId, setFiscalYearId] = useState<string>('all')
    const [search, setSearch] = useState('')

    // Fetch fiscal years
    const { data: fiscalYears = [] } = useFiscalYears()
    const { data: activeFiscalYear } = useActiveFiscalYear()

    // Set active fiscal year as default on mount
    useEffect(() => {
        if (activeFiscalYear && fiscalYearId === 'all') {
            setFiscalYearId(activeFiscalYear.id)
        }
    }, [activeFiscalYear])

    // Get selected fiscal year data
    const selectedFiscalYear = fiscalYearId !== 'all' ? fiscalYears.find(fy => fy.id === fiscalYearId) : null

    // Fetch statement data
    const { data: statements = [], isLoading } = useQuery({
        queryKey: ['parties-statement', fiscalYearId, search, selectedFiscalYear?.start_date, selectedFiscalYear?.end_date],
        queryFn: () => getPartiesStatement({
            startDate: selectedFiscalYear?.start_date,
            endDate: selectedFiscalYear?.end_date,
            search: search || undefined,
        }),
    })

    const clearFilters = () => {
        setFiscalYearId('all')
        setSearch('')
    }

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800">
            {/* Filters */}
            <div className="p-4 border-b dark:border-zinc-800">
                <div className="flex flex-col md:flex-row gap-3">
                    {/* Fiscal Year Filter */}
                    <div className="flex-1">
                        <select
                            value={fiscalYearId}
                            onChange={(e) => setFiscalYearId(e.target.value)}
                            className="w-full px-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search supplier..."
                            className="w-full pl-10 pr-3 py-2 border dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Clear Filters */}
                    {(fiscalYearId !== 'all' || search) && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-2 px-4 py-2 border dark:border-zinc-700 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                        >
                            <X className="h-4 w-4" />
                            Clear Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Statement Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-zinc-800">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold">S.N</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold">Supplier List</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold">Total Purchase Amount</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold">Pan/Vat Bill Amount</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold">Difference</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {isLoading ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                    Loading statement...
                                </td>
                            </tr>
                        ) : statements.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                    No records found
                                </td>
                            </tr>
                        ) : (
                            statements.map((item, index) => {
                                const difference = item.total_purchase_amount - item.pan_vat_bill_amount
                                return (
                                    <tr key={item.supplier_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                                        <td className="px-4 py-3 text-sm font-medium">{item.supplier_name}</td>
                                        <td className="px-4 py-3 text-sm text-right font-medium">
                                            {formatNepaliCurrency(item.total_purchase_amount)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-blue-600 dark:text-blue-400">
                                            {formatNepaliCurrency(item.pan_vat_bill_amount)}
                                        </td>
                                        <td className={`px-4 py-3 text-sm text-right font-medium ${Math.abs(difference) > 1
                                                ? 'text-red-600 dark:text-red-400'
                                                : 'text-green-600 dark:text-green-400'
                                            }`}>
                                            {formatNepaliCurrency(difference)}
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
