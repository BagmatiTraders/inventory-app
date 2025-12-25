'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui-shim'
import { Activity, Monitor, Globe } from 'lucide-react'

interface ActivityLogProps {
    logs: any[]
}

export function ActivityLog({ logs }: ActivityLogProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {logs.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No activity logs found</p>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="flex items-start gap-4 p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                                <div className="mt-1">
                                    {log.browser ? <Monitor className="h-4 w-4 text-gray-400" /> : <Globe className="h-4 w-4 text-gray-400" />}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">
                                        {log.action === 'login' ? 'Logged in' : 'Logged out'}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {log.browser} • {log.ip_address}
                                    </p>
                                </div>
                                <div className="text-xs text-gray-400">
                                    {new Date(log.created_at).toLocaleString()}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
