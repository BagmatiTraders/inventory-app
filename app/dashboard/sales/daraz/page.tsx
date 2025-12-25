'use client'

import { FileText, Package, BarChart2, TrendingUp, ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'

export default function DarazSalesMenuPage() {
    const menuItems = [
        {
            name: 'Sales Entry',
            icon: Package,
            href: '/dashboard/sales/daraz/sales-entry',
            color: 'bg-orange-500'
        },
        {
            name: 'Update Order Status',
            icon: FileText,
            href: '/dashboard/sales/daraz/update-status',
            color: 'bg-blue-500'
        },
        {
            name: 'Sales Dashboard',
            icon: BarChart2,
            href: '/dashboard/sales/daraz/dashboard',
            color: 'bg-green-500'
        },
        {
            name: 'Order Sync',
            icon: RefreshCw,
            href: '/dashboard/sales/daraz/order-sync',
            color: 'bg-indigo-500'
        },
        {
            name: 'Sales Report',
            icon: TrendingUp,
            href: '/dashboard/sales/daraz/report',
            color: 'bg-purple-500'
        }
    ]

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 space-y-4">
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-md sticky top-0 z-10 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Daraz Sales</h1>
                </div>
                <Link
                    href="/dashboard/sales"
                    className="flex items-center gap-1.5 px-3 py-1 text-[15px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors border border-gray-200 dark:border-zinc-700"
                >
                    <ArrowLeft size={14} />
                    Back to Sales
                </Link>
            </div>

            <div className="px-4">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {menuItems.map((item) => {
                        const Icon = item.icon
                        return (
                            <Link key={item.name} href={item.href}>
                                <Card className="p-3 hover:shadow-lg transition-all cursor-pointer h-full border border-gray-400 dark:border-zinc-600 bg-gray-200 dark:bg-zinc-800 flex flex-col items-center justify-center gap-2 text-center">
                                    <div className={`${item.color} p-2 rounded-full shadow-sm`}>
                                        <Icon size={18} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-[15px] text-gray-800 dark:text-gray-100">{item.name}</h3>
                                    </div>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

