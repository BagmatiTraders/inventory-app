'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getApprovalRequests, approveDeleteRequest, rejectDeleteRequest } from '@/features/inventory/actions/product-actions'
import { getPendingDeletionRequests, approveDeletionRequest, rejectDeletionRequest } from '@/features/sales/actions/daraz-deletion-actions'
import { Card, CardContent } from '@/components/ui-shim'
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { Clock, Check, X, AlertTriangle } from 'lucide-react'

export default function ApprovalsPage() {
    const [activeTab, setActiveTab] = useState('products')
    const queryClient = useQueryClient()

    // Fetch approval requests
    const { data: approvals, isLoading, error } = useQuery({
        queryKey: ['approvals', activeTab],
        queryFn: async () => {
            if (activeTab === 'sales') {
                const result = await getPendingDeletionRequests()
                if (!result.success) throw new Error(result.error)
                return result.data?.map((req: any) => ({
                    id: req.id,
                    resource_name: `Order #${req.order_number}`,
                    requested_at: req.requested_at,
                    expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                    metadata: {
                        user_name: req.requester?.raw_user_meta_data?.full_name || req.requester?.email,
                        user_email: req.requester?.email,
                        reason: req.reason
                    }
                })) || []
            }
            return getApprovalRequests(activeTab)
        }
    })

    const handleApprove = async (requestId: string) => {
        if (!confirm('Approve this delete request? The item will be moved to Restore Backup.')) {
            return
        }

        try {
            if (activeTab === 'sales') {
                const result = await approveDeletionRequest(requestId)
                if (!result.success) throw new Error(result.error)
            } else {
                await approveDeleteRequest(requestId)
            }
            queryClient.invalidateQueries({ queryKey: ['approvals'] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            alert('Request approved successfully!')
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        }
    }

    const handleReject = async (requestId: string) => {
        const notes = prompt('Reject reason (optional):')

        if (!confirm('Reject this delete request? The item will remain active.')) {
            return
        }

        try {
            if (activeTab === 'sales') {
                const result = await rejectDeletionRequest(requestId, notes || undefined)
                if (!result.success) throw new Error(result.error)
            } else {
                await rejectDeleteRequest(requestId)
            }
            queryClient.invalidateQueries({ queryKey: ['approvals'] })
            alert('Request rejected successfully!')
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        }
    }

    const getTimeRemaining = (expiresAt: string) => {
        const now = new Date().getTime()
        const expiry = new Date(expiresAt).getTime()
        const diff = expiry - now

        if (diff <= 0) return 'Expired'

        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

        return `${hours}h ${minutes}m remaining`
    }

    return (
        <div className="space-y-6">
            <SettingsPageHeader
                title="Approval Center"
                subtitle="Review and approve pending delete requests (48-hour window)"
            />

            {/* Tabs */}
            <Card>
                <div className="border-b dark:border-zinc-700">
                    <div className="flex gap-4 p-4">
                        {['products', 'sales', 'purchases', 'suppliers'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 font-medium rounded-lg transition-colors ${activeTab === tab
                                    ? 'bg-blue-600 text-white'
                                    : 'hover:bg-gray-100 dark:hover:bg-zinc-800'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <CardContent className="p-6">
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading approvals...</div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-500">Error: {error.message}</div>
                    ) : !approvals || approvals.length === 0 ? (
                        <div className="text-center py-12">
                            <Check className="mx-auto mb-4 text-green-500" size={48} />
                            <p className="text-lg font-medium">All caught up!</p>
                            <p className="text-sm text-gray-500 mt-2">No pending delete requests for {activeTab}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {approvals.map((approval: any) => {
                                const isExpiring = new Date(approval.expires_at).getTime() - new Date().getTime() < 6 * 60 * 60 * 1000 // Less than 6 hours

                                return (
                                    <div
                                        key={approval.id}
                                        className={`p-4 rounded-lg border-2 ${isExpiring
                                            ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/10'
                                            : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            {/* Left: Info */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded">
                                                        Delete Request
                                                    </span>
                                                    {isExpiring && (
                                                        <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded">
                                                            <AlertTriangle size={12} />
                                                            Expiring Soon
                                                        </span>
                                                    )}
                                                </div>

                                                <h3 className="text-lg font-semibold mb-1">{approval.resource_name}</h3>

                                                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                                    <p>
                                                        <span className="font-medium">Requested by:</span>{' '}
                                                        {approval.metadata?.user_name || 'Unknown'}
                                                    </p>
                                                    <p>
                                                        <span className="font-medium">Requested at:</span>{' '}
                                                        {new Date(approval.requested_at).toLocaleString()}
                                                    </p>
                                                    {activeTab === 'sales' && approval.metadata?.reason && (
                                                        <p>
                                                            <span className="font-medium">Reason:</span>{' '}
                                                            {approval.metadata.reason}
                                                        </p>
                                                    )}
                                                    <p className="flex items-center gap-1">
                                                        <Clock size={14} />
                                                        <span className="font-medium">Expires in:</span>{' '}
                                                        <span className={isExpiring ? 'text-orange-600 dark:text-orange-400 font-semibold' : ''}>
                                                            {getTimeRemaining(approval.expires_at)}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Right: Actions */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleApprove(approval.id)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                                >
                                                    <Check size={16} />
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleReject(approval.id)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                                >
                                                    <X size={16} />
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
