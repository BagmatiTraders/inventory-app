'use client'

import Link from 'next/link'
import { CreditCard, ShoppingCart, Truck, Store } from 'lucide-react'

export default function AccountPage() {
    const accountModules = [
        {
            name: 'Pan/Vat Billing',
            description: 'Manage PAN and VAT billing information',
            href: '/dashboard/account/pan-vat-billing',
            icon: CreditCard,
            color: 'bg-purple-500',
        },
        {
            name: 'Daraz Account',
            description: 'Daraz account management and settings',
            href: '/dashboard/account/daraz-account',
            icon: ShoppingCart,
            color: 'bg-orange-500',
        },
        {
            name: 'Marketplace / Courier',
            description: 'Marketplace and courier account details',
            href: '/dashboard/account/marketplace-courier',
            icon: Truck,
            color: 'bg-blue-500',
        },
        {
            name: 'Store Account',
            description: 'Store account configuration',
            href: '/dashboard/account/store-account',
            icon: Store,
            color: 'bg-green-500',
        },
    ]

    return (
        <div className="min-h-full bg-gray-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-6">
                <h1 className="text-xl font-bold hidden md:block w-full">Account & Transaction</h1>
                <h1 className="text-xl font-bold w-full text-center md:text-left md:hidden block -ml-10">Account & Transaction</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 hidden md:block">
                    Manage your business accounts and billing information
                </p>
            </div>

            {/* Account Modules Grid */}
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                    {accountModules.map((module) => (
                        <Link
                            key={module.href}
                            href={module.href}
                            className="group block p-6 bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 hover:shadow-lg transition-all duration-200 hover:scale-105"
                        >
                            <div className="flex items-start gap-4">
                                <div className={`${module.color} p-3 rounded-lg text-white group-hover:scale-110 transition-transform`}>
                                    <module.icon className="h-6 w-6" />
                                </div>
                                <div className="flex-1">
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
