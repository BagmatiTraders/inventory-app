'use client'

import { useState, use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { getSupplierFullLedger } from '@/features/suppliers/actions/supplier-ledger-actions'
import { Card } from '@/components/ui-shim'

import { useDashboard } from '@/app/dashboard/layout'
import { useEffect } from 'react'

export default function SupplierLedgerPage({ params }: { params: Promise<{ supplierId: string }> }) {
    const { supplierId } = use(params)
    const searchParams = useSearchParams()
    const fiscalYearId = searchParams.get('fiscalYearId') || undefined
    const paramSupplierName = searchParams.get('supplierName') ? decodeURIComponent(searchParams.get('supplierName')!) : null
    const { setHeaderTitle } = useDashboard()

    // Set Global Header Title if param exists
    useEffect(() => {
        if (setHeaderTitle && paramSupplierName) {
            setHeaderTitle(`${paramSupplierName} - Ledger`)
        }
        return () => {
            if (setHeaderTitle) setHeaderTitle(null)
        }
    }, [setHeaderTitle, paramSupplierName])

    // Fetch  Ledger Data
    const { data: ledgerData, isLoading } = useQuery({
        queryKey: ['supplier-full-ledger', supplierId, fiscalYearId],
        queryFn: () => getSupplierFullLedger({ supplierId, fiscalYearId })
    })

    const ledger = ledgerData?.ledger || []
    const supplierName = ledgerData?.supplierName || paramSupplierName || 'Loading...'
    const runningBalance = ledger.length > 0 ? ledger[0].running_amount : 0

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="hidden md:flex sticky top-0  z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <Link
                        href={`/dashboard/suppliers/suppliers-account/${supplierId}?fiscalYearId=${fiscalYearId || ''}`}
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{supplierName}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Complete Ledger</p>
                    </div>
                </div>
                {/* Running Balance Display */}
                <div className="text-right">
                    <div className="text-xs text-gray-500 uppercase font-semibold">Running Balance</div>
                    <div className={`text-xl font-bold ${runningBalance > 1 ? 'text-red-600' : runningBalance < -1 ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                        Rs {runningBalance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-2 z-10">
                <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500 uppercase font-semibold">Running Balance</div>
                    <div className={`text-lg font-bold ${runningBalance > 1 ? 'text-red-600' : runningBalance < -1 ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                        Rs {runningBalance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            <div className="p-4 flex-1 overflow-auto">
                {/* Ledger Table */}
                {isLoading ? (
                    <div className="h-64 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg border">
                        <Loader2 className="animate-spin text-gray-400" />
                    </div>
                ) : ledger.length === 0 ? (
                    <div className="h-64 flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg border">
                        <p className="text-gray-500">No transactions found</p>
                    </div>
                ) : (
                    <Card className="overflow-hidden bg-white shadow-sm dark:bg-zinc-900 border">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-zinc-800">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Date</th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Particular</th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Debit</th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Credit</th>
                                        <th className="px-4 py-3 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right">Running Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {ledger.map((entry: any) => (
                                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                {new Date(entry.date).toLocaleDateString('en-GB')}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="font-medium text-gray-900 dark:text-gray-100">{entry.particular}</div>
                                                {entry.particular_detail && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">{entry.particular_detail}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                                                {entry.debit > 0 ? `Rs ${Number(entry.debit).toLocaleString('en-NP', { minimumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                                                {entry.credit > 0 ? `Rs ${Number(entry.credit).toLocaleString('en-NP', { minimumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td className={`px-4 py-3 text-sm text-right font-bold ${entry.running_amount > 1 ? 'text-red-600' : entry.running_amount < -1 ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                                                Rs {Number(entry.running_amount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    )
}
