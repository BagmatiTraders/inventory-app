'use client'

import { FileText, History, BarChart2, TrendingUp, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'

export default function PurchaseDashboardPage() {
    const purchaseModules = [
        {
            name: 'Purchase Entry',
            description: 'Add and manage daily purchases',
            icon: FileText,
            href: '/dashboard/purchase/purchase-entry',
            color: 'bg-blue-500'
        },
        {
            name: 'Daily Purchase List',
            description: 'View full purchase history',
            icon: History,
            href: '/dashboard/purchase/daily-purchase-list',
            color: 'bg-green-500'
        },
        {
            name: 'Inventory Price Reports',
            description: 'Analyze product pricing trends',
            icon: TrendingUp,
            href: '/dashboard/purchase/inventory-price-reports',
            color: 'bg-purple-500'
        },
        {
            name: 'Purchase Analytics',
            description: 'View purchase reports by fiscal year',
            icon: BarChart3,
            href: '/dashboard/purchase/analytics',
            color: 'bg-indigo-500'
        },
        {
            name: 'Purchase Reports',
            description: 'Detailed purchase analytics',
            icon: BarChart2,
            href: '/dashboard/purchase/purchase-reports',
            color: 'bg-orange-500'
        }
    ]

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 space-y-4">
            {/* Top Bar with Shadow */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-md sticky top-0 z-10">
                <h1 className="text-xl font-bold">Purchase Management</h1>
            </div>

            <div className="px-4 space-y-4">
                {/* Modules Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {purchaseModules.map((module) => {
                        const Icon = module.icon
                        return (
                            <Link key={module.name} href={module.href}>
                                <Card className="p-4 hover:shadow-lg transition-all cursor-pointer h-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex flex-col items-center justify-center gap-3 text-center group">
                                    <div className={`${module.color} p-3 rounded-full shadow-md group-hover:scale-110 transition-transform`}>
                                        <Icon size={24} className="text-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{module.name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{module.description}</p>
                                    </div>
                                </Card>
                            </Link>
                        )
                    })}
                </div>

                {/* Quick Stats (Placeholder) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                    <Card className="p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <p className="text-sm text-gray-500 font-medium">Purchases Today</p>
                        <p className="text-2xl font-bold mt-1">0</p>
                    </Card>
                    <Card className="p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <p className="text-sm text-gray-500 font-medium">Monthly Total</p>
                        <p className="text-2xl font-bold mt-1 text-green-600">Rs 0</p>
                    </Card>
                </div>
            </div>
        </div>
    )
}
