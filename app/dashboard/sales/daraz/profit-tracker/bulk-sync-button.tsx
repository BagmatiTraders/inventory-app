'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { syncBulkOrderPurchaseCosts, syncSpecificOrders } from '@/features/sales/actions/report-actions'
import { useQueryClient } from '@tanstack/react-query'

interface BulkSyncButtonProps {
    orderNumbers?: string[]
}

export function BulkSyncButton({ orderNumbers = [] }: BulkSyncButtonProps) {
    const [isSyncing, setIsSyncing] = useState(false)
    const [message, setMessage] = useState('')
    const queryClient = useQueryClient()

    const handleSync = async () => {
        const count = orderNumbers.length

        // Use specific sync if orders are provided (e.g. from filter), otherwise fallback to auto-find
        const mode = count > 0 ? 'specific' : 'auto'
        const promptMsg = mode === 'specific'
            ? `Sync visible ${count} orders? This will repair the orders currently shown in the table.`
            : 'Scan and sync up to 20 missing orders? Continue?'

        if (!confirm(promptMsg)) return

        setIsSyncing(true)
        setMessage('Syncing...')

        try {
            let result
            if (mode === 'specific') {
                result = await syncSpecificOrders(orderNumbers)
            } else {
                result = await syncBulkOrderPurchaseCosts()
            }

            // Show first debug message if available for clarity
            setMessage(`✓ ${result.message}`)
            // if (result.debug) alert(result.debug) // DEBUG: Show debug info explicitly

            // Invalidate and refetch the profit tracker data
            await queryClient.invalidateQueries({ queryKey: ['profit-tracker'] })
            await queryClient.invalidateQueries({ queryKey: ['daily-profit-stats'] })

            // Clear message after 3 seconds
            setTimeout(() => setMessage(''), 3000)
        } catch (error: any) {
            setMessage(`Error: ${error.message}`)
        } finally {
            setIsSyncing(false)
        }
    }

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : (orderNumbers.length > 0 ? `Sync Visible (${orderNumbers.length})` : 'Bulk Sync Fees')}
            </button>
            {message && (
                <span className="text-sm text-gray-600 dark:text-gray-400">{message}</span>
            )}
        </div>
    )
}
