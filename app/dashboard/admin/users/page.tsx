import { UserListTable } from "@/features/admin/components/UserListTable"

export default function AdminUsersPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Users</h1>
            </div>
            <UserListTable />
        </div>
    )
}
