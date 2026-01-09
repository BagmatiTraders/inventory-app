'use client'

import { useState, useEffect } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { supabase } from '@/lib/supabase/client'
import { saveMobileCapture } from '../actions'
import { Loader2, Camera as CameraIcon, Save, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

import { defineCustomElements } from '@ionic/pwa-elements/loader'

export default function CaptureInterface({ trigger }: { trigger?: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const [image, setImage] = useState<string | null>(null)
    const [imageBlob, setImageBlob] = useState<Blob | null>(null)
    const [price, setPrice] = useState('')
    const [remarks, setRemarks] = useState('')
    const [saving, setSaving] = useState(false)
    const [groupId, setGroupId] = useState('')
    const router = useRouter()

    // Initialize group ID and PWA elements on mount
    useEffect(() => {
        setGroupId(crypto.randomUUID())
        defineCustomElements(window)
    }, [])

    const openCamera = async () => {
        try {
            const photo = await Camera.getPhoto({
                quality: 60,
                allowEditing: false,
                resultType: CameraResultType.Uri,
                source: CameraSource.Camera,
                webUseInput: true,
            })

            if (photo.webPath) {
                // If we get a photo, ensure interface is open/visible
                setIsOpen(true)
                setImage(photo.webPath)
                const response = await fetch(photo.webPath)
                const blob = await response.blob()
                setImageBlob(blob)
            } else {
                // If cancelled and no image, maybe close if it was just opened?
                // But usually we just stay on the previous state.
            }
        } catch (error: any) {
            console.error('Camera error:', error)
            toast.error("Camera Error: " + (error?.message || "Unknown error"))
        }
    }

    // Trigger camera on open if triggered via button
    const handleTriggerClick = () => {
        setIsOpen(true) // Show the modal/overlay container
        openCamera()    // Immediately invoke camera
    }

    const clearForm = () => {
        setImage(null)
        setImageBlob(null)
        setPrice('')
        setRemarks('')
    }

    const handleClose = () => {
        clearForm()
        setIsOpen(false)
    }

    const handleSave = async (continueGroup: boolean) => {
        if (!imageBlob) {
            toast.error("No image captured")
            return
        }

        setSaving(true)
        const toastId = toast.loading(continueGroup ? "Adding to group..." : "Saving...")

        try {
            // 1. Upload
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
            const { error: uploadError } = await supabase.storage
                .from('mobile-captures')
                .upload(fileName, imageBlob, {
                    contentType: 'image/jpeg',
                    upsert: false
                })

            if (uploadError) throw new Error('Upload failed: ' + uploadError.message)

            // 2. Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('mobile-captures')
                .getPublicUrl(fileName)

            // 3. Save DB
            await saveMobileCapture({
                image_path: fileName,
                image_url: publicUrl,
                price: price ? parseFloat(price) : undefined,
                remarks: remarks || undefined,
                group_id: groupId
            })

            toast.success("Saved!", { id: toastId, duration: 1000 })

            // 4. Reset Logic
            clearForm()
            router.refresh()

            if (!continueGroup) {
                setGroupId(crypto.randomUUID())
            }

            // 5. Auto Re-open Camera
            setTimeout(() => {
                openCamera()
            }, 300)

        } catch (error: any) {
            console.error('Save error:', error)
            toast.error(error.message || "Failed to save", { id: toastId })
        } finally {
            setSaving(false)
        }
    }

    if (!isOpen) {
        // If provided a trigger, render it with click handler
        if (trigger) {
            return <div onClick={handleTriggerClick}>{trigger}</div>
        }
        // Fallback or hidden state
        return null
    }

    // Modal / Fullscreen Overlay
    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* If no image yet (e.g. cancelled camera but modal open), show placeholder or close */}
            {!image ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                    <button onClick={handleClose} className="absolute top-4 right-4 text-white p-2">
                        <X size={32} />
                    </button>
                    <button
                        onClick={openCamera}
                        className="p-8 rounded-full bg-gray-800 text-white mb-4"
                    >
                        <CameraIcon size={48} />
                    </button>
                    <p className="text-gray-400">Tap to open camera</p>
                </div>
            ) : (
                <>
                    {/* Image Preview Background */}
                    <div className="absolute inset-0 z-0">
                        <Image
                            src={image}
                            alt="Preview"
                            fill
                            className="object-contain"
                        />
                    </div>

                    {/* Overlay: Top Actions */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/60 to-transparent">
                        <button
                            onClick={handleClose}
                            className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30"
                        >
                            <X size={20} />
                        </button>

                        <button
                            onClick={() => handleSave(true)}
                            disabled={saving}
                            className="flex flex-col items-center gap-1 p-2 bg-blue-600/90 backdrop-blur-md rounded-lg text-white font-medium hover:bg-blue-600 shadow-lg active:scale-95 transition-all"
                        >
                            <Plus size={24} />
                            <span className="text-[10px] font-bold uppercase">Add More</span>
                        </button>
                    </div>

                    {/* Overlay: Bottom Inputs */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-10 space-y-4">
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <input
                                    type="number"
                                    value={price}
                                    placeholder="Price"
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="w-full bg-white/90 backdrop-blur text-black p-3 rounded-lg font-bold text-center placeholder:text-gray-500 shadow-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="flex-[1.5]">
                                <input
                                    value={remarks}
                                    placeholder="Remarks / Variation"
                                    onChange={(e) => setRemarks(e.target.value)}
                                    className="w-full bg-white/90 backdrop-blur text-black p-3 rounded-lg font-medium text-sm placeholder:text-gray-500 shadow-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => handleSave(false)}
                            disabled={saving}
                            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                            SAVE & NEXT
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
