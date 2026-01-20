'use client'

import { useState, useEffect } from 'react'
import { CameraPreview } from '@capacitor-community/camera-preview'
import { BarcodeScanner } from '@capacitor-community/barcode-scanner'
import { registerBackHandler, unregisterBackHandler } from '@/components/CapacitorAppListener'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { createPortal } from 'react-dom'

interface BarcodeScannerModalProps {
    isOpen: boolean
    onClose: () => void
    onScan: (barcode: string) => Promise<boolean> // Returns true if order found, false if not found
}

export function BarcodeScannerModal({ isOpen, onClose, onScan }: BarcodeScannerModalProps) {
    const [cameraActive, setCameraActive] = useState(false)
    const [scanning, setScanning] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setMounted(true)
        return () => {
            stopScanning()
        }
    }, [])

    // Handle Android back button
    useEffect(() => {
        if (!isOpen || !cameraActive) return

        registerBackHandler(() => {
            handleClose()
            return true
        })

        return () => unregisterBackHandler()
    }, [isOpen, cameraActive])

    // Start camera and scanning when modal opens
    useEffect(() => {
        if (isOpen && !cameraActive) {
            startScanning()
        } else if (!isOpen && cameraActive) {
            stopScanning()
        }
    }, [isOpen])

    const toggleAppVisibility = (hide: boolean) => {
        const appContent = document.getElementById('app-content')
        if (appContent) {
            appContent.style.visibility = hide ? 'hidden' : 'visible'
        }
    }

    const startScanning = async () => {
        try {
            console.log('[BarcodeScanner] Starting camera...')
            setCameraActive(true)
            setScanning(true)
            setError(null)

            toggleAppVisibility(true)
            document.body.classList.add('camera-active')

            // Check and request camera permission
            const status = await BarcodeScanner.checkPermission({ force: true })
            if (!status.granted) {
                throw new Error('Camera permission denied')
            }

            // Prepare scanner (makes background transparent)
            await BarcodeScanner.prepare()

            // Start camera preview in background
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

            // Start continuous barcode scanning
            startBarcodeDetection()

            console.log('[BarcodeScanner] Camera started successfully!')
        } catch (error: any) {
            console.error('[BarcodeScanner] Failed to start camera:', error)
            toast.error(`Camera error: ${error?.message || 'Unknown error'}`)
            handleClose()
        }
    }

    const startBarcodeDetection = async () => {
        try {
            // Start scanning (this returns a promise that resolves when a barcode is detected)
            const result = await BarcodeScanner.startScan()

            if (result.hasContent) {
                const barcode = result.content || ''
                console.log('[BarcodeScanner] Barcode detected:', barcode)
                await handleBarcodeDetected(barcode)
            }
        } catch (error: any) {
            if (error?.message !== 'scan canceled') {
                console.error('[BarcodeScanner] Scan error:', error)
                setError(error?.message || 'Scanning failed')
            }
        }
    }

    const handleBarcodeDetected = async (barcode: string) => {
        console.log('[BarcodeScanner] Processing barcode:', barcode)
        setScanning(false)

        try {
            // Call the onScan callback to check if order exists
            const orderFound = await onScan(barcode)

            if (orderFound) {
                // Success: play beep sound and close
                playBeepSound()
                toast.success('Order found!')
                await stopScanning()
                onClose()
            } else {
                // Failure: play buzz sound, show error, keep scanner open
                playBuzzSound()
                setError('Order not found. Please scan again.')
                // Restart scanning after a brief delay
                setTimeout(() => {
                    setError(null)
                    setScanning(true)
                    startBarcodeDetection()
                }, 2000)
            }
        } catch (error: any) {
            console.error('[BarcodeScanner] Error processing barcode:', error)
            playBuzzSound()
            setError(error?.message || 'Error processing barcode')
            // Restart scanning
            setTimeout(() => {
                setError(null)
                setScanning(true)
                startBarcodeDetection()
            }, 2000)
        }
    }

    const stopScanning = async () => {
        if (!cameraActive) return

        try {
            console.log('[BarcodeScanner] Stopping scanner...')

            // Stop barcode scanning
            await BarcodeScanner.stopScan()

            // Stop camera preview
            await CameraPreview.stop()

            console.log('[BarcodeScanner] Scanner stopped successfully')
        } catch (error: any) {
            console.error('[BarcodeScanner] Error stopping scanner:', error)
        } finally {
            setCameraActive(false)
            setScanning(false)
            restoreBackground()
        }
    }

    const restoreBackground = () => {
        document.body.classList.remove('camera-active')
        toggleAppVisibility(false)
        BarcodeScanner.showBackground() // Restore app background
    }

    const handleClose = async () => {
        await stopScanning()
        onClose()
    }

    const playBeepSound = () => {
        const audio = new Audio('/sounds/beep.mp3')
        audio.play().catch(err => console.error('Failed to play beep sound:', err))
    }

    const playBuzzSound = () => {
        const audio = new Audio('/sounds/buzz.mp3')
        audio.play().catch(err => console.error('Failed to play buzz sound:', err))
    }

    if (!mounted || !isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-transparent">
            {/* SCANNER OVERLAY */}
            {cameraActive && (
                <div className="absolute inset-0 z-50 pointer-events-none">
                    {/* Top Controls */}
                    <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-4 pt-8 pointer-events-auto bg-gradient-to-b from-black/80 to-transparent">
                        <button
                            onClick={handleClose}
                            className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white shadow-lg border border-white/60 active:scale-95"
                        >
                            <X size={24} />
                        </button>
                        <div className="flex flex-col items-end gap-2">
                            <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-lg text-white text-sm font-medium">
                                {scanning ? 'Scanning...' : 'Ready'}
                            </div>
                        </div>
                    </div>

                    {/* Center: Rectangle Scan Area */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative w-[280px] h-[200px]">
                            {/* Semi-transparent overlay outside scan area */}
                            <div className="absolute inset-0 pointer-events-none">
                                {/* Top */}
                                <div className="absolute top-0 left-0 right-0 h-[calc(50vh-100px)] bg-black/50" style={{ transform: 'translateY(-100%)' }} />
                                {/* Bottom */}
                                <div className="absolute bottom-0 left-0 right-0 h-[calc(50vh-100px)] bg-black/50" style={{ transform: 'translateY(100%)' }} />
                                {/* Left */}
                                <div className="absolute top-0 left-0 bottom-0 w-[calc(50vw-140px)] bg-black/50" style={{ transform: 'translateX(-100%)' }} />
                                {/* Right */}
                                <div className="absolute top-0 right-0 bottom-0 w-[calc(50vw-140px)] bg-black/50" style={{ transform: 'translateX(100%)' }} />
                            </div>

                            {/* Scan rectangle border */}
                            <div className="absolute inset-0 border-4 border-white rounded-lg shadow-2xl">
                                {/* Corner markers */}
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />

                                {/* Scanning line animation */}
                                {scanning && (
                                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-scan" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom: Instructions and Error */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 pb-12 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-auto">
                        <div className="text-center text-white space-y-3">
                            {error ? (
                                <div className="p-4 bg-red-500/90 backdrop-blur-md rounded-lg font-medium text-lg">
                                    {error}
                                </div>
                            ) : (
                                <>
                                    <p className="text-lg font-semibold">
                                        Scan Order Barcode
                                    </p>
                                    <p className="text-sm text-white/80">
                                        Position the barcode within the rectangle
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CSS for scanning animation */}
            <style jsx>{`
                @keyframes scan {
                    0% {
                        top: 0;
                    }
                    50% {
                        top: 100%;
                    }
                    100% {
                        top: 0;
                    }
                }
                .animate-scan {
                    animation: scan 2s linear infinite;
                }
            `}</style>
        </div>,
        document.body
    )
}
