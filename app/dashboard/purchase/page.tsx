'use client'

import { FileText, History, BarChart2, TrendingUp, BarChart3, Users, Menu, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { useDashboard } from '../layout'

export default function PurchaseDashboardPage() {
    const { setIsMobileMenuOpen } = useDashboard()
    const purchaseModules = [
        {
            name: 'Purchase Entry',
            icon: FileText,
            href: '/dashboard/purchase/purchase-entry',
            color: 'bg-blue-500'
        },
        {
            name: 'Purchase Summary',
            icon: LayoutDashboard,
            href: '/dashboard/purchase/dashboard',
            color: 'bg-indigo-600'
        },
        {
            name: 'Inventory Price Reports',
            icon: TrendingUp,
            href: '/dashboard/purchase/inventory-price-reports',
            color: 'bg-purple-500'
        }
    ]

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 space-y-4">
            {/* Top Bar with Shadow */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-md fixed md:sticky top-0 left-0 right-0 z-50 flex items-center justify-between md:justify-end gap-4">
                {/* Mobile Menu Button - shows only on mobile */}
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md relative z-20"
                >
                    <Menu size={24} />
                </button>

                <h1 className="text-xl font-bold w-full text-center md:text-left md:hidden block -ml-10">Purchase Management</h1>
                <h1 className="text-xl font-bold hidden md:block w-full">Purchase Management</h1>

                <div className="w-8 md:hidden"></div> {/* Balance spacer */}
            </div>

            <div className="px-4 space-y-2 md:space-y-4 pt-3 md:pt-0">
                {/* Purchase Modules Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {purchaseModules.map((module) => {
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
                        <p className="text-[15px] text-gray-500">Purchases Today</p>
                        <p className="text-xl font-bold">0</p>
                    </Card>
                    <Card className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                        <p className="text-[15px] text-gray-500">Monthly Total</p>
                        <p className="text-xl font-bold text-green-600">Rs 0</p>
                    </Card>
                </div>
            </div>
        </div>
    )
}
