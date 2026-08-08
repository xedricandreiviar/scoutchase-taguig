import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export type ScanError =
  | { type: 'permission_denied' }
  | { type: 'timeout' }
  | { type: 'scanner_error'; message: string }

export interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void
  onScanError: (error: ScanError) => void
  timeoutMs?: number // default 30000
}

type ScannerState =
  | 'initializing'
  | 'scanning'
  | 'permission_denied'
  | 'timeout'
  | 'success'
  | 'error'

const SCANNER_ELEMENT_ID = 'qr-scanner-region'

/**
 * QR Scanner component wrapping html5-qrcode with React lifecycle management.
 * Handles camera permission, 30-second timeout, and clean teardown.
 *
 * Validates: Requirements 6.1, 6.2, 6.6
 */
export function QRScanner({
  onScanSuccess,
  onScanError,
  timeoutMs = 30000,
}: QRScannerProps) {
  const [state, setState] = useState<ScannerState>('initializing')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasScannedRef = useRef(false)
  const isMountedRef = useRef(true)

  const cleanup = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (scannerRef.current) {
      try {
        const scannerState = scannerRef.current.getState()
        if (scannerState === 2) {
          // Html5QrcodeScannerState.SCANNING
          await scannerRef.current.stop()
        }
      } catch {
        // Scanner may already be stopped
      }
      scannerRef.current = null
    }
  }, [])

  const startScanner = useCallback(async () => {
    if (hasScannedRef.current || !isMountedRef.current) return

    setState('initializing')

    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID)
      scannerRef.current = scanner

      // Start the timeout once camera is active (Req 6.6)
      const startTimeout = () => {
        timeoutRef.current = setTimeout(() => {
          if (!hasScannedRef.current && isMountedRef.current) {
            setState('timeout')
            onScanError({ type: 'timeout' })
            cleanup()
          }
        }, timeoutMs)
      }

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (hasScannedRef.current) return
          hasScannedRef.current = true
          setState('success')
          cleanup()
          onScanSuccess(decodedText)
        },
        () => {
          // QR code scan failure - this fires frequently while searching, ignore
        }
      )

      if (isMountedRef.current) {
        setState('scanning')
        startTimeout()
      }
    } catch (err) {
      if (!isMountedRef.current) return

      const errorMessage =
        err instanceof Error ? err.message : String(err)

      // Check if it's a permission denied error
      if (
        errorMessage.toLowerCase().includes('permission') ||
        errorMessage.toLowerCase().includes('notallowederror') ||
        errorMessage.toLowerCase().includes('not allowed')
      ) {
        setState('permission_denied')
        onScanError({ type: 'permission_denied' })
      } else {
        setState('error')
        onScanError({ type: 'scanner_error', message: errorMessage })
      }
    }
  }, [onScanSuccess, onScanError, timeoutMs, cleanup])

  useEffect(() => {
    isMountedRef.current = true
    hasScannedRef.current = false
    startScanner()

    return () => {
      isMountedRef.current = false
      cleanup()
    }
  }, [startScanner, cleanup])

  const handleRetry = useCallback(() => {
    hasScannedRef.current = false
    setState('initializing')
    startScanner()
  }, [startScanner])

  return (
    <div className="flex flex-col items-center w-full">
      {/* Permission denied state (Req 6.2) */}
      {state === 'permission_denied' && (
        <div
          className="w-full max-w-sm p-6 text-center space-y-4"
          role="alert"
          aria-live="polite"
        >
          <div className="text-4xl" aria-hidden="true">📷</div>
          <h3 className="text-lg font-semibold text-foreground">
            Camera Access Required
          </h3>
          <p className="text-sm text-muted-foreground">
            Camera permission is required to scan QR codes. Please enable
            camera access in your device settings:
          </p>
          <ol className="text-sm text-muted-foreground text-left space-y-2 list-decimal list-inside">
            <li>Open your device Settings</li>
            <li>Go to Privacy &amp; Security → Camera</li>
            <li>Find your browser and enable camera access</li>
            <li>Return to this page and try again</li>
          </ol>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors min-h-[44px] min-w-[44px]"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Timeout state (Req 6.6) */}
      {state === 'timeout' && (
        <div
          className="w-full max-w-sm p-6 text-center space-y-4"
          role="alert"
          aria-live="polite"
        >
          <div className="text-4xl" aria-hidden="true">⏱️</div>
          <h3 className="text-lg font-semibold text-foreground">
            Scanner Timed Out
          </h3>
          <p className="text-sm text-muted-foreground">
            No QR code was detected within 30 seconds. Please ensure:
          </p>
          <ul className="text-sm text-muted-foreground text-left space-y-1 list-disc list-inside">
            <li>The QR code is clearly visible and well-lit</li>
            <li>The QR code is not damaged or obscured</li>
            <li>Hold your device steady about 15-20cm from the code</li>
          </ul>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors min-h-[44px] min-w-[44px]"
          >
            Retry Scan
          </button>
        </div>
      )}

      {/* Scanner error state */}
      {state === 'error' && (
        <div
          className="w-full max-w-sm p-6 text-center space-y-4"
          role="alert"
          aria-live="polite"
        >
          <div className="text-4xl" aria-hidden="true">⚠️</div>
          <h3 className="text-lg font-semibold text-foreground">
            Scanner Error
          </h3>
          <p className="text-sm text-muted-foreground">
            Something went wrong with the QR scanner. Please try again.
          </p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors min-h-[44px] min-w-[44px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Scanner viewport */}
      {(state === 'initializing' || state === 'scanning') && (
        <div className="w-full max-w-sm space-y-4">
          <div
            id={SCANNER_ELEMENT_ID}
            className="w-full rounded-lg overflow-hidden bg-black"
            aria-label="QR code scanner viewport"
          />
          {state === 'initializing' && (
            <p className="text-sm text-center text-muted-foreground">
              Initializing camera...
            </p>
          )}
          {state === 'scanning' && (
            <p className="text-sm text-center text-muted-foreground">
              Point your camera at a QR code
            </p>
          )}
        </div>
      )}

      {/* Success state */}
      {state === 'success' && (
        <div className="w-full max-w-sm p-6 text-center space-y-4">
          <div className="text-4xl" aria-hidden="true">✅</div>
          <h3 className="text-lg font-semibold text-foreground">
            QR Code Detected
          </h3>
          <p className="text-sm text-muted-foreground">
            Verifying...
          </p>
        </div>
      )}
    </div>
  )
}

export default QRScanner
