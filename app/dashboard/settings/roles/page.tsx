'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui-shim'
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { Plus } from 'lucide-react'
import RoleList from '@/features/settings/components/RoleList'
import AddEditRoleDialog from '@/features/settings/components/AddEditRoleDialog'

export default function RolesPage() {
    const [isAddOpen, setIsAddOpen] = useState(false)

    return (
        <div className="space-y-6">
            <SettingsPageHeader
                title="Role Page"
                subtitle="Manage page roles and permissions"
            />

            <div className="flex justify-end gap-3">
                <button
                    onClick={() => setIsAddOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
                >
                    <Plus size={16} />
                    Add New Role
                </button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <RoleList />
                </CardContent>
            </Card>

            <AddEditRoleDialog
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
            />
        </div>
    )
}
