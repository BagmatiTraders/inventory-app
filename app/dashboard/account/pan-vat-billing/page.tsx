'use client'

import { ArrowLeft, ShoppingBag, ShoppingCart, FileText } from 'lucide-react'
import Link from 'next/link'

export default function PanVatBillingPage() {
    const billingModules = [
        {
            name: 'Purchase Billing',
            description: 'Manage purchase invoices and PAN/VAT details',
            href: '/dashboard/account/pan-vat-billing/purchase-billing',
            icon: ShoppingBag,
            color: 'bg-blue-500',
        },
        {
            name: 'Sales Billing',
            description: 'Manage sales invoices and PAN/VAT details',
            href: '/dashboard/account/pan-vat-billing/sales-billing',
            icon: ShoppingCart,
            color: 'bg-green-500',
        },
        {
            name: 'Report',
            description: 'View PAN/VAT billing reports and summaries',
            href: '/dashboard/account/pan-vat-billing/report',
            icon: FileText,
            color: 'bg-purple-500',
        },
    ]

    return (
        <div className="min-h-full bg-gray-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-6">
                <div className="flex items-center gap-4 mb-2">
                    <Link
                        href="/dashboard/account"
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold">Pan/Vat Billing</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Manage PAN and VAT billing information
                        </p>
                    </div>
                </div>
            </div>

            {/* Billing Modules Grid */}
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {billingModules.map((module) => (
                        <Link
                            key={module.href}
                            href={module.href}
                            className="group block p-6 bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 hover:shadow-lg transition-all duration-200 hover:scale-105"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className={`${module.color} p-4 rounded-lg text-white group-hover:scale-110 transition-transform`}>
                                    <module.icon className="h-8 w-8" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                        {module.name}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {module.description}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
