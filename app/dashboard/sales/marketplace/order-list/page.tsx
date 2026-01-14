'use client'

import { Suspense } from 'react'
import { MarketplaceOrderList } from '@/features/sales/components/MarketplaceOrderList'

export default function MarketplaceOrderListPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-full text-gray-500">
                Loading marketplace orders...
            </div>
        }>
            <MarketplaceOrderList isEmbedded={false} />
        </Suspense>
    )
}
