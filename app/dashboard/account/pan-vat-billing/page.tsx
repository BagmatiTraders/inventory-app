'use client'

import { ArrowLeft, ShoppingBag, ShoppingCart, FileText } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'

export default function PanVatBillingPage() {
    const billingModules = [
        {
            name: 'Purchase Billing',
            href: '/dashboard/account/pan-vat-billing/purchase-billing',
            icon: ShoppingBag,
            color: 'bg-blue-500',
        },
        {
            name: 'Sales Billing',
            href: '/dashboard/account/pan-vat-billing/sales-billing',
            icon: ShoppingCart,
            color: 'bg-green-500',
        },
        {
            name: 'Report',
            href: '/dashboard/account/pan-vat-billing/report',
            icon: FileText,
            color: 'bg-purple-500',
        },
    ]

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 space-y-4">
            {/* Top Bar with Shadow */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-md sticky top-0 z-10 flex items-center gap-3">
                <Link
                    href="/dashboard/account"
                    className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-gray-600 dark:text-gray-400"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <h1 className="text-xl font-bold">Pan/Vat Billing</h1>
            </div>

            <div className="px-4 space-y-4">
                {/* Billing Modules Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {billingModules.map((module) => {
                        const Icon = module.icon
                        return (
                            <Link key={module.name} href={module.href}>
                                <Card className="p-3 hover:shadow-lg transition-all cursor-pointer h-full border border-gray-400 dark:border-zinc-600 bg-gray-200 dark:bg-zinc-800 flex flex-col items-center justify-center gap-2 text-center">
                                    <div className={`${module.color} p-2 rounded-md shadow-sm`}>
                                        <Icon size={18} className="text-white" />
                                    </div>
                                    <h3 className="font-semibold text-[15px] text-gray-800 dark:text-gray-100">{module.name}</h3>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
