import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-shim"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Dashboard | Bagmati Traders",
}

export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">Welcome back to Bagmati Traders Overview.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Revenue" value="Rs 45,231.89" change="+20.1% from last month" />
                <StatCard title="Active Sales" value="+2350" change="+180.1% from last month" />
                <StatCard title="Pending Orders" value="+12" change="+19% from last month" />
                <StatCard title="Low Stock Items" value="7" change="Needs Attention" warning />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Sales</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Sales chart will appear here...</p>
                        <div className="h-[200px] bg-gray-50 mt-4 rounded-md border border-dashed flex items-center justify-center text-gray-400">
                            Chart Placeholder
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Activity Log</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <ActivityItem user="Admin" action="Updated Stock" time="2m ago" />
                            <ActivityItem user="Staff A" action="New Sale (Invoice #123)" time="15m ago" />
                            <ActivityItem user="Staff B" action="Login at Kathmandu Store" time="1h ago" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function StatCard({ title, value, change, warning }: { title: string, value: string, change: string, warning?: boolean }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className={`text-xs ${warning ? 'text-red-500' : 'text-muted-foreground'}`}>{change}</p>
            </CardContent>
        </Card>
    )
}

function ActivityItem({ user, action, time }: { user: string, action: string, time: string }) {
    return (
        <div className="flex items-center">
            <div className="ml-4 space-y-1">
                <p className="text-sm font-medium leading-none">{user}</p>
                <p className="text-sm text-muted-foreground">{action}</p>
            </div>
            <div className="ml-auto font-medium text-xs text-muted-foreground">{time}</div>
        </div>
    )
}
