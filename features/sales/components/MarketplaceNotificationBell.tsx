'use client'

import { useState, useEffect } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { getMarketplaceRedirectNotifications, RedirectNotification } from '@/features/sales/actions/marketplace-notification-actions'
import { useQuery } from '@tanstack/react-query'

export function MarketplaceNotificationBell({ align = 'right' }: { align?: 'left' | 'right' }) {
    const [isOpen, setIsOpen] = useState(false)
    const [readIds, setReadIds] = useState<string[]>([])

    // Load read notifications from local storage on mount
    useEffect(() => {
        const stored = localStorage.getItem('marketplace_notification_read_ids')
        if (stored) {
            try {
                setReadIds(JSON.parse(stored))
            } catch (e) {
                console.error('Failed to parse read notifications', e)
            }
        }
    }, [])

    const { data: notifications = [], refetch } = useQuery({
        queryKey: ['marketplace-redirect-notifications'],
        queryFn: getMarketplaceRedirectNotifications,
        refetchInterval: 30000, // Check every 30 seconds
    })

    // Filter out read notifications to calculate badge count
    const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length

    const handleToggle = () => {
        if (!isOpen) {
            // Opening the dropdown
            setIsOpen(true)
            // Mark currently visible notifications as read
            const newIds = notifications.map(n => n.id)
            const updatedReadIds = [...Array.from(new Set([...readIds, ...newIds]))]
            setReadIds(updatedReadIds)
            localStorage.setItem('marketplace_notification_read_ids', JSON.stringify(updatedReadIds))
        } else {
            setIsOpen(false)
        }
    }

    // Close on click outside (simple implementation)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (isOpen && !target.closest('.notification-container')) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative notification-container">
            <button
                onClick={handleToggle}
                className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                title="Notifications"
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} mt-2 w-[85vw] max-w-[320px] md:w-96 md:max-w-none bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden`}>
                    <div className="px-4 py-3 border-b dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                        <span className="text-xs text-gray-500">
                            {notifications.length} Total
                        </span>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 text-sm">
                                <CheckCheck className="mx-auto mb-2 text-green-500" size={20} />
                                <p>No redirect opportunities found.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {notifications.map((notification) => (
                                    <li key={notification.id} className="p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                                            Returning to seller <span className="font-bold font-mono text-blue-600">{notification.returningOrder.sales_id}</span> is possible to Redirect with Pending <span className="font-bold font-mono text-blue-600">{notification.pendingOrder.sales_id}</span>

                                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                                                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                                    Branch: {notification.pendingOrder.branch_name}
                                                </span>
                                                {notification.matchType === 'FUZZY' && (
                                                    <span className="text-xs font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded">
                                                        Possible match
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
