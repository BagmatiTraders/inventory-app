'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function PanVatReportPage() {
    return (
        <div className="min-h-full bg-gray-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-6">
                <div className="flex items-center gap-4 mb-2">
                    <Link
                        href="/dashboard/account/pan-vat-billing"
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold">Pan/Vat Report</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            View PAN/VAT billing reports and summaries
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 p-8">
                    <div className="text-center text-gray-500 dark:text-gray-400">
                        <p className="text-lg">Pan/Vat Report page content will be implemented here</p>
                        <p className="text-sm mt-2">This page will display PAN/VAT billing reports and summaries</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
