'use client'

import { Package, ShoppingCart, TrendingUp, FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'

export default function SalesPage() {
    const salesModules = [
        {
            name: 'Daraz Sales',
            icon: Package,
            href: '/dashboard/sales/daraz',
            color: 'bg-orange-500'
        },
        {
            name: 'Marketplace Sales',
            icon: ShoppingCart,
            href: '/dashboard/sales/marketplace',
            color: 'bg-blue-500'
        },
        {
            name: 'Order List',
            icon: FileText,
            href: '/dashboard/sales/orders',
            color: 'bg-green-500'
        },
        {
            name: 'Sales Analytics',
            icon: TrendingUp,
            href: '/dashboard/sales/analytics',
            color: 'bg-purple-500'
        }
    ]

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 space-y-4">
            {/* Top Bar with Shadow */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-md sticky top-0 z-10">
                <h1 className="text-xl font-bold">Sales Management</h1>
            </div>

            <div className="px-4 space-y-4">
                {/* Sales Modules Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {salesModules.map((module) => {
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

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <p className="text-[15px] text-gray-500">Total Orders Today</p>
                        <p className="text-xl font-bold">0</p>
                    </Card>
                    <Card className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <p className="text-[15px] text-gray-500">Pending Orders</p>
                        <p className="text-xl font-bold text-yellow-600">0</p>
                    </Card>
                    <Card className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <p className="text-[15px] text-gray-500">Shipped Today</p>
                        <p className="text-xl font-bold text-blue-600">0</p>
                    </Card>
                    <Card className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <p className="text-[15px] text-gray-500">Today's Revenue</p>
                        <p className="text-xl font-bold text-green-600">Rs. 0</p>
                    </Card>
                </div>
            </div>
        </div>
    )
}

