'use client'

import { Bell } from 'lucide-react'
import { Card, CardContent } from '@/components/ui-shim'

interface ProfileHeaderProps {
    user: {
        full_name: string | null
        email: string
        role: string
    }
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
    return (
        <Card className="bg-white dark:bg-zinc-900 border-none shadow-sm mb-6">
            <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-200 text-2xl font-bold">
                        {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {user.full_name || 'User'}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400">{user.email}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 text-xs rounded-full text-gray-600 dark:text-gray-300 capitalize">
                            {user.role}
                        </span>
                    </div>
                </div>

                <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 relative">
                    <Bell className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"></span>
                </button>
            </CardContent>
        </Card>
    )
}
