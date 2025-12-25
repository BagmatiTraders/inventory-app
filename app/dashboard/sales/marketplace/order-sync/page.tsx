'use client'

import { ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function MarketplaceOrderSyncPage() {
    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Top Bar with Shadow */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-md sticky top-0 z-10 flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold">Marketplace Order Sync</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Sync orders from connected marketplace stores</p>
                </div>
                <Link
                    href="/dashboard/sales/marketplace"
                    className="flex items-center gap-1.5 px-3 py-1 text-xs bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors border border-gray-200 dark:border-zinc-700"
                >
                    <ArrowLeft size={14} />
                    Back to Marketplace
                </Link>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 mb-4">
                        <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">Order Sync</h2>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                        This page is under development. Order synchronization functionality will be available soon.
                    </p>
                </div>
            </div>
        </div>
    )
}
