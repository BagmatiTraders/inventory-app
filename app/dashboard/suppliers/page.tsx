'use client'

import { Package, FileText, TrendingUp, CreditCard, Users } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'

export default function SuppliersPage() {
    const suppliersModules = [
        {
            name: 'Suppliers List',
            icon: Users,
            href: '/dashboard/suppliers/suppliers-list',
            color: 'bg-blue-500'
        },
        {
            name: 'Suppliers Transaction',
            icon: FileText,
            href: '/dashboard/suppliers/suppliers-transaction',
            color: 'bg-green-500'
        },
        {
            name: 'Suppliers Statement',
            icon: TrendingUp,
            href: '/dashboard/suppliers/suppliers-statement',
            color: 'bg-purple-500'
        },
        {
            name: 'PAN/VAT Billing',
            icon: CreditCard,
            href: '/dashboard/suppliers/pan-vat-billing',
            color: 'bg-orange-500'
        },
        {
            name: 'Suppliers Account',
            icon: Package,
            href: '/dashboard/suppliers/suppliers-account',
            color: 'bg-teal-500'
        }
    ]

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 space-y-4">
            {/* Top Bar with Shadow */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-md sticky top-0 z-10">
                <h1 className="text-xl font-bold">Suppliers</h1>
            </div>

            <div className="px-4 space-y-4">
                {/* Suppliers Modules Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {suppliersModules.map((module) => {
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
