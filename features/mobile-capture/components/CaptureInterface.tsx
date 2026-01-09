'use client'

import { useState, useEffect } from 'react'
import { CameraPreview } from '@capacitor-community/camera-preview'
import { supabase } from '@/lib/supabase/client'
import { saveMobileCapture } from '../actions'
import { Loader2, Save, Plus, X, Zap, ZapOff, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
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
            stopCamera()
            restoreBackground()
        }
    }, [])

    // Debug: Log whenever cameraActive changes
    useEffect(() => {
        console.log('[Camera] ===== cameraActive changed to:', cameraActive, '=====')
    }, [cameraActive])

    const toggleAppVisibility = (hide: boolean) => {
        const appContent = document.getElementById('app-content')
        if (appContent) {
            appContent.style.visibility = hide ? 'hidden' : 'visible'
        }
    }

    const startCamera = async () => {
        try {
            console.log('[Camera] Starting camera...')
            console.log('[Camera] Current cameraActive:', cameraActive)
            setIsOpen(true)
            setCameraActive(true)
            console.log('[Camera] Set cameraActive to TRUE')

            toggleAppVisibility(true)
            document.body.classList.add('camera-active')

            console.log('[Camera] Attempting CameraPreview.start() with toBack:TRUE')
            await CameraPreview.start({
                toBack: true,
                position: 'rear',
                x: 0,
                y: 0,
                width: window.screen.width,
                height: window.screen.height,
                rotateWhenOrientationChanged: false,
                disableAudio: true
            })
            console.log('[Camera] Camera started successfully with toBack:true!')
        } catch (error: any) {
            console.error('[Camera] Failed to start camera:', error)
            console.error('[Camera] Error details:', JSON.stringify(error))
            toast.error(`Camera error: ${error?.message || 'Unknown error'}`)
            handleClose()
        }
    }

    const stopCamera = async () => {
        if (!cameraActive) {
            console.log('[Camera] stopCamera called but camera is already inactive, skipping')
            return
        }

        try {
            console.log('[Camera] Stopping camera...')
            await CameraPreview.stop()
            console.log('[Camera] Camera stopped successfully')
        } catch (error: any) {
            // Don't log "already stopped" errors as errors
            if (error?.message?.includes('already stopped')) {
                console.log('[Camera] Camera was already stopped')
            } else {
                console.error('[Camera] Error stopping camera:', error)
            }
        } finally {
            console.log('[Camera] Setting cameraActive to FALSE')
            setCameraActive(false)
        }
    }

    const restoreBackground = () => {
        document.body.classList.remove('camera-active')
        toggleAppVisibility(false)
    }

    const capturePhoto = async () => {
        try {
            console.log('[Camera] Attempting to capture photo...')
            const result = await CameraPreview.capture({
                quality: 85
            })
            console.log('[Camera] Capture successful, processing image...')

            const base64Data = result.value
            const base64Response = await fetch(`data:image/jpeg;base64,${base64Data}`)
            const blob = await base64Response.blob()

            setImage(`data:image/jpeg;base64,${base64Data}`)
            setImageBlob(blob)

            console.log('[Camera] Image processed, stopping camera')
            stopCamera()

        } catch (error: any) {
            console.error('[Camera] Capture failed:', error)
            console.error('[Camera] Capture error details:', JSON.stringify(error))
            toast.error(`Capture failed: ${error?.message || 'Unknown error'}`)
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

    if (!isOpen) {
        if (trigger) {
            return <div onClick={startCamera}>{trigger}</div>
        }
        return null
    }

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-transparent">
            {/* CAMERA CONTROLS OVERLAY - camera renders behind via toBack:true */}
            {cameraActive && !image && (
                <div className="absolute inset-0 z-50 pointer-events-none">
                    {/* Top Controls */}
                    <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-4 pt-8 pointer-events-auto">
                        <button
                            onClick={handleClose}
                            className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white shadow-lg border border-white/60 active:scale-95"
                        >
                            <X size={24} />
                        </button>
                        <button
                            onClick={toggleFlash}
                            className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white shadow-lg border border-white/60 active:scale-95"
                        >
                            {flashMode === 'on' ? <Zap size={24} /> : <ZapOff size={24} />}
                        </button>
                    </div>

                    {/* Bottom Controls - Capture and Flip */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between items-center px-8 pb-12 pointer-events-auto">
                        {/* Empty spacer for layout balance */}
                        <div className="w-12" />

                        <button
                            onClick={capturePhoto}
                            className="w-20 h-20 rounded-full border-4 border-white bg-white/20 active:scale-95 transition-transform flex items-center justify-center backdrop-blur-sm shadow-2xl"
                        >
                            <div className="w-16 h-16 bg-white rounded-full" />
                        </button>

                        <button
                            onClick={flipCamera}
                            className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white shadow-lg border border-white/60 active:scale-95"
                        >
                            <RefreshCcw size={24} />
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
