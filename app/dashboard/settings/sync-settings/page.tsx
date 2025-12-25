'use client'

import { useState, useEffect } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui-shim'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

export default function SyncSettingsPage() {
    const [loading, setLoading] = useState(false)
    const [cutoffDate, setCutoffDate] = useState('')

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings/sync-rules')
            const data = await res.json()
            if (data.cutoff_date) {
                // Convert ISO to datetime-local format (YYYY-MM-DDTHH:mm)
                const date = new Date(data.cutoff_date)
                // Adjust for local timezone input
                const localISOTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
                setCutoffDate(localISOTime)
            }
        } catch (error) {
            console.error(error)
        }
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            // Save as ISO string
            const isoDate = cutoffDate ? new Date(cutoffDate).toISOString() : null

            const res = await fetch('/api/settings/sync-rules', {
                method: 'POST',
                body: JSON.stringify({ cutoff_date: isoDate }),
                headers: { 'Content-Type': 'application/json' }
            })

            if (!res.ok) throw new Error('Failed to save')

            toast.success('Settings saved successfully')
        } catch (error) {
            toast.error('Failed to save settings')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Sync Settings</h1>
                <p className="text-sm text-gray-500">Configure global rules for Daraz integration.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Order Sync Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Order Cutoff Date</label>
                        <div className="text-xs text-gray-500 mb-2">
                            Orders created <strong>before</strong> this date will NOT be added to Sales Entry effectively (they will be skipped during auto-booking).
                        </div>
                        <Input
                            type="datetime-local"
                            value={cutoffDate}
                            onChange={(e) => setCutoffDate(e.target.value)}
                            className="w-full sm:w-[300px]"
                        />
                    </div>

                    <div className="pt-4">
                        <Button onClick={handleSave} disabled={loading} className="gap-2">
                            <Save size={16} />
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
