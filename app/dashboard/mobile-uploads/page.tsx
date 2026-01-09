'use server'

import { getMobileCaptures } from '@/features/mobile-capture/actions'
import { GalleryGrid } from '@/features/mobile-capture/components/GalleryGrid'

export default async function MobileUploadsPage() {
    const captures = await getMobileCaptures()

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Product Photo Capture</h1>
                <span className="text-sm text-gray-500">
                    {captures.length} photos
                </span>
            </div>

            <GalleryGrid captures={captures} />

            {captures.length === 0 && (
                <div className="py-20 text-center text-gray-500 border-2 border-dashed rounded-lg">
                    <p className="text-lg font-medium">No photos found</p>
                    <p className="text-sm mt-1">
                        Use the mobile app to capture product photos instantly.
                    </p>
                </div>
            )}
        </div>
    )
}
