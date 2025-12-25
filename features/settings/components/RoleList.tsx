"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getPageRoles, deletePageRole } from "../actions/role-actions"
import { Edit, Trash2 } from "lucide-react"
import AddEditRoleDialog from "./AddEditRoleDialog"

export default function RoleList() {
    const [editingRole, setEditingRole] = useState<any>(null)
    const { data: roles, isLoading, refetch } = useQuery({
        queryKey: ['page-roles'],
        queryFn: async () => await getPageRoles()
    })

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this role?")) {
            try {
                await deletePageRole(id)
                refetch()
            } catch (error) {
                console.error('Failed to delete role:', error)
                alert('Failed to delete role')
            }
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading roles...</div>
    }

    if (!roles?.length) {
        return (
            <div className="p-12 text-center border-2 border-dashed rounded-lg text-gray-500">
                No roles found. Add one to get started.
            </div>
        )
    }

    return (
        <>
            <div className="overflow-x-auto rounded-lg border dark:border-zinc-700">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-zinc-900 text-gray-500 uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3 font-medium">S.N.</th>
                            <th className="px-6 py-3 font-medium">Main Page Role</th>
                            <th className="px-6 py-3 font-medium">Sub Page Role</th>
                            <th className="px-6 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-zinc-700">
                        {roles.map((role, index) => (
                            <tr key={role.id} className="bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700/50">
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                                    {index + 1}
                                </td>
                                <td className="px-6 py-4 font-semibold text-blue-600 dark:text-blue-400">
                                    {role.main_role}
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                    {role.sub_role || '-'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => setEditingRole(role)}
                                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700 rounded-md transition-colors"
                                            title="Edit Role"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(role.id)}
                                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                            title="Delete Role"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingRole && (
                <AddEditRoleDialog
                    isOpen={true}
                    onClose={() => setEditingRole(null)}
                    editRole={editingRole}
                    onUpdate={refetch}
                />
            )}
        </>
    )
}
