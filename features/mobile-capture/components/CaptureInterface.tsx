'use client'

import { useState, useEffect } from 'react'
import { CameraPreview, CameraPreviewPictureOptions } from '@capacitor-community/camera-preview'
import { supabase } from '@/lib/supabase/client'
import { saveMobileCapture } from '../actions'
import { Loader2, Camera as CameraIcon, Save, Plus, X, Zap, ZapOff, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { defineCustomElements } from '@ionic/pwa-elements/loader'
import { createPortal } from 'react-dom'

export default function CaptureInterface({ trigger }: { trigger?: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const [image, setImage] = useState<string | null>(null)
    const [imageBlob, setImageBlob] = useState<Blob | null>(null)
    const [price, setPrice] = useState('')
    const [remarks, setRemarks] = useState('')
    const [saving, setSaving] = useState(false)
    const [groupId, setGroupId] = useState('')
    const [flashMode, setFlashMode] = useState<'off' | 'on'>('off')
    const [cameraActive, setCameraActive] = useState(false)
    const [mounted, setMounted] = useState(false)

    const router = useRouter()

    useEffect(() => {
        setGroupId(crypto.randomUUID())
        defineCustomElements(window)
        setMounted(true)

        return () => {
            stopCamera() // Cleanup on unmount
            restoreBackground()
        }
    }, [])

    const toggleAppVisibility = (hide: boolean) => {
        const appContent = document.getElementById('app-content')
        if (appContent) {
            appContent.style.visibility = hide ? 'hidden' : 'visible'
        }
    }

    const startCamera = async () => {
        try {
            setIsOpen(true)
            setCameraActive(true)

            // Hide App Content to reveal camera behind
            toggleAppVisibility(true)
            document.body.style.backgroundColor = 'transparent'
            document.documentElement.style.backgroundColor = 'transparent'

            await CameraPreview.start({
                toBack: true, // Camera goes behind WebView
                position: 'rear',
                x: 0,
                y: 0,
                width: window.innerWidth,
                height: window.innerHeight,
                paddingBottom: 0,
                rotateWhenOrientationChanged: false
            })
        } catch (error) {
            console.error('Failed to start camera:', error)
            toast.error("Failed to start camera")
            handleClose()
        }
    }

    const stopCamera = async () => {
        try {
            await CameraPreview.stop()
        } catch (error) {
            console.error('Error stopping camera:', error)
        } finally {
            setCameraActive(false)
            // Do NOT restore background yet if we have an image, 
            // but usually we might want to keep the UI
        }
    }

    const restoreBackground = () => {
        document.body.style.backgroundColor = ''
        document.documentElement.style.backgroundColor = ''
        toggleAppVisibility(false)
    }

    const capturePhoto = async () => {
        try {
            const result = await CameraPreview.capture({
                quality: 85
            })

            // Result is base64 string
            const base64Data = result.value

            // Create Blob
            const base64Response = await fetch(`data:image/jpeg;base64,${base64Data}`)
            const blob = await base64Response.blob()

            setImage(`data:image/jpeg;base64,${base64Data}`)
            setImageBlob(blob)

            stopCamera() // Stop camera preview

            // Note: We keep isOpen=true and cameraActive=false? 
            // Or we keep transparent background?
            // Since we display the captured image as an opaque overlay, 
            // we can arguably restore background, BUT the Portal sits on top anyway.
            // Let's keep background transparent until full close to avoid flashing.

        } catch (error) {
            console.error('Capture failed:', error)
            toast.error("Capture failed")
        }
    }

    const flipCamera = async () => {
        await CameraPreview.flip()
    }

    const toggleFlash = async () => {
        const nextMode = flashMode === 'off' ? 'on' : 'off'
        await CameraPreview.setFlashMode({ flashMode: nextMode })
        setFlashMode(nextMode)
    }

    const handleClose = async () => {
        await stopCamera()
        clearForm()
        setIsOpen(false)
        restoreBackground()
    }

    const clearForm = () => {
        setImage(null)
        setImageBlob(null)
        setPrice('')
        setRemarks('')
    }

    const handleSave = async (continueGroup: boolean) => {
        if (!imageBlob) {
            toast.error("No image captured")
            return
        }

        setSaving(true)
        const toastId = toast.loading(continueGroup ? "Adding to group..." : "Saving...")

        try {
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
            const { error: uploadError } = await supabase.storage
                .from('mobile-captures')
                .upload(fileName, imageBlob, {
                    contentType: 'image/jpeg',
                    upsert: false
                })

            if (uploadError) throw new Error('Upload failed: ' + uploadError.message)

            const { data: { publicUrl } } = supabase.storage
                .from('mobile-captures')
                .getPublicUrl(fileName)

            await saveMobileCapture({
                image_path: fileName,
                image_url: publicUrl,
                price: price ? parseFloat(price) : undefined,
                remarks: remarks || undefined,
                group_id: groupId
            })

            toast.success("Saved!", { id: toastId, duration: 1000 })

            clearForm()
            router.refresh()

            if (!continueGroup) {
                setGroupId(crypto.randomUUID())
            }

            // Auto Re-open Camera
            setTimeout(() => {
                startCamera()
            }, 300)

        } catch (error: any) {
            console.error('Save error:', error)
            toast.error(error.message || "Failed to save", { id: toastId })
        } finally {
            setSaving(false)
        }
    }

    if (!mounted) return null

    // Render Trigger normally
    if (!isOpen) {
        if (trigger) {
            return <div onClick={startCamera}>{trigger}</div>
        }
        return null
    }

    // Portal for Full Screen UI
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-transparent">
            {/* CAMERA VIEW LAYER */}
            {cameraActive && !image && (
                <div id="cameraPreview" className="absolute inset-0 bg-transparent flex flex-col justify-between p-6">
                    {/* Top Controls */}
                    <div className="flex justify-between items-start pt-8">
                        <button onClick={handleClose} className="p-3 bg-black/40 backdrop-blur rounded-full text-white">
                            <X size={24} />
                        </button>
                        <div className="flex gap-4">
                            <button onClick={toggleFlash} className="p-3 bg-black/40 backdrop-blur rounded-full text-white">
                                {flashMode === 'on' ? <Zap size={24} /> : <ZapOff size={24} />}
                            </button>
                            <button onClick={flipCamera} className="p-3 bg-black/40 backdrop-blur rounded-full text-white">
                                <RefreshCcw size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Bottom Controls - Capture Button */}
                    <div className="flex justify-center pb-12">
                        <button
                            onClick={capturePhoto}
                            className="w-20 h-20 rounded-full border-4 border-white bg-white/20 active:scale-95 transition-transform flex items-center justify-center backdrop-blur-sm"
                        >
                            <div className="w-16 h-16 bg-white rounded-full shadow-lg" />
                        </button>
                    </div>
                </div>
            )}

            {/* REVIEW / INPUT LAYER */}
            {image && (
                <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in fade-in duration-200">
                    {/* Image Preview */}
                    <div className="absolute inset-0 z-0 bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={image}
                            alt="Preview"
                            className="w-full h-full object-contain"
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
                                    placeholder="Rmks"
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
                </div>
            )}
        </div>,
        document.body
    )
}
