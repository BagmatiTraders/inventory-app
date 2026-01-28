'use client'

import { useState } from 'react'
import StockLedgerTable from './StockLedgerTable'
import StockValuationTable from './StockValuationTable'
import { StockLedgerItem } from '../services/stock-ledger-service'

interface Props {
    initialData: StockLedgerItem[]
    initialTotal: number
    initialPages: number
}

export default function StockLedgerView({ initialData, initialTotal, initialPages }: Props) {
    const [activeTab, setActiveTab] = useState<'ledger' | 'valuation'>('ledger')

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex gap-4 border-b dark:border-zinc-800">
                <button
                    onClick={() => setActiveTab('ledger')}
                    className={`pb-2 text-sm font-medium transition-colors relative ${activeTab === 'ledger'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                >
                    Stock Ledger
                    {activeTab === 'ledger' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('valuation')}
                    className={`pb-2 text-sm font-medium transition-colors relative ${activeTab === 'valuation'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                >
                    Stock Valuation
                    {activeTab === 'valuation' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
                    )}
                </button>
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {activeTab === 'ledger' ? (
                    <StockLedgerTable
                        initialData={initialData}
                        initialTotal={initialTotal}
                        initialPages={initialPages}
                    />
                ) : (
                    <StockValuationTable />
                )}
            </div>
        </div>
    )
}
