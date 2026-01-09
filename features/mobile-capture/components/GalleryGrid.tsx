"use client"

import { useState } from "react"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { Download, X, ZoomIn } from "lucide-react"

type Capture = {
    id: string
    created_at: string
    image_url: string
    price?: number | null
    remarks?: string | null
    group_id?: string | null
}

interface GalleryGridProps {
    captures: Capture[]
}

export function GalleryGrid({ captures }: GalleryGridProps) {
    const [selectedImage, setSelectedImage] = useState<Capture | null>(null)

    const handleDownload = async (url: string, filename: string) => {
        try {
            const response = await fetch(url)
            const blob = await response.blob()
            const link = document.createElement("a")
            link.href = window.URL.createObjectURL(blob)
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (error) {
            console.error("Download failed:", error)
        }
    }

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {captures.map((capture) => (
                    <div
                        key={capture.id}
                        className="group relative aspect-[3/4] bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden border dark:border-zinc-800 cursor-pointer hover:shadow-md transition-all"
                        onClick={() => setSelectedImage(capture)}
                    >
                        <Image
                            src={capture.image_url}
                            alt={capture.remarks || "Capture"}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <ZoomIn className="text-white drop-shadow-md" />
                        </div>

                        {/* Info Bar */}
                        <div className="absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-zinc-900/95 p-2 border-t dark:border-zinc-800 backdrop-blur-sm">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold truncate">
                                    {capture.price ? `Rs. ${capture.price}` : '-'}
                                </span>
                                <span className="text-gray-500 text-[10px]">
                                    {formatDistanceToNow(new Date(capture.created_at), { addSuffix: true })}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Lightbox Modal */}
            {selectedImage && (
                <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">

                    {/* Top Bar */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-50">
                        <div className="text-white">
                            <h2 className="font-bold text-lg">
                                {selectedImage.price ? `Rs. ${selectedImage.price}` : 'No Price'}
                            </h2>
                            <p className="text-sm text-gray-400">
                                {selectedImage.remarks || 'No remarks'}
                            </p>
                            <p className="text-xs text-gray-500 font-mono mt-1">
                                {new Date(selectedImage.created_at).toLocaleString()}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleDownload(selectedImage.image_url, `capture-${selectedImage.id}.jpg`)
                                }}
                                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors"
                                title="Download Image"
                            >
                                <Download size={24} />
                            </button>
                            <button
                                onClick={() => setSelectedImage(null)}
                                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors"
                                title="Close"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Image Container */}
                    <div
                        className="relative w-full h-full max-w-5xl max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Image
                            src={selectedImage.image_url}
                            alt="Full view"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                </div>
            )}
        </>
    )
}
