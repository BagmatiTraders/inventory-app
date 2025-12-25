'use client'

import Link from 'next/link'
import { Package, FileText, History, AlertTriangle, BarChart2 } from 'lucide-react'
import { Card } from '@/components/ui-shim'

export default function InventoryPage() {
    const inventoryModules = [
        {
            name: 'Product List',
            icon: Package,
            href: '/dashboard/inventory/product-list',
            color: 'bg-blue-500'
        },
        {
            name: 'Stock Adjustment',
            icon: FileText,
            href: '/dashboard/inventory/stock-adjustment',
            color: 'bg-green-500'
        },
        {
            name: 'Stock Ledger',
            icon: History,
            href: '/dashboard/inventory/stock-ledger',
            color: 'bg-purple-500'
        },
        {
            name: 'Damaged Stocks',
            icon: AlertTriangle,
            href: '/dashboard/inventory/damaged-stocks',
            color: 'bg-red-500'
        },
        {
            name: 'Stock Reports',
            icon: BarChart2,
            href: '/dashboard/inventory/stock-reports',
            color: 'bg-orange-500'
        }
    ]

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 space-y-4">
            {/* Top Bar with Shadow */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-md sticky top-0 z-10">
                <h1 className="text-xl font-bold">Inventory Management</h1>
            </div>

            <div className="px-4 space-y-4">
                {/* Inventory Modules Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {inventoryModules.map((module) => {
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
                        <p className="text-[15px] text-gray-500">Total Products</p>
                        <p className="text-xl font-bold">0</p>
                    </Card>
                    <Card className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <p className="text-[15px] text-gray-500">Low Stock Items</p>
                        <p className="text-xl font-bold text-orange-600">0</p>
                    </Card>
                    <Card className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <p className="text-[15px] text-gray-500">Out of Stock</p>
                        <p className="text-xl font-bold text-red-600">0</p>
                    </Card>
                    <Card className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <p className="text-[15px] text-gray-500">Total Value</p>
                        <p className="text-xl font-bold text-green-600">Rs. 0</p>
                    </Card>
                </div>
            </div>
        </div>
    )
}

