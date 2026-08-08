import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRScanner, type ScanError } from '@/components/QRScanner'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'

export interface QRVerifyResponse {
  success: boolean
  site_id?: string
  site_name?: string
  already_unlocked?: boolean
  points_awarded?: number
  error?: string
}

type ScanPageState =
  | { status: 'scanning' }
  | { status: 'verifying'; decodedText: string }
  | { status: 'success'; result: QRVerifyResponse }
  | { status: 'error'; error: ScanError | { type: 'verification_error'; message: string } }

/**
 * QR Scanner page — full-page scanner with verification and navigation.
 * Scans a QR code, calls the verify-qr-scan Edge Function, and navigates
 * to the site content page on success.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.6, 6.7, 6.8
 */
export default function Scan() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [pageState, setPageState] = useState<ScanPageState>({
    status: 'scanning',
  })

  const verifyQrCode = useCallback(async (payload: string) => {
    if (!user) {
      setPageState({
        status: 'error',
        error: { type: 'verification_error', message: 'You must be logged in to scan QR codes.' },
      })
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke('verify-qr-scan', {
        body: { payload, user_id: user.id },
      })

      if (error) {
        setPageState({
          status: 'error',
          error: { type: 'verification_error', message: 'Verification failed. Please try again.' },
        })
        return
      }

      const response = data as QRVerifyResponse

      if (response.error) {
        const errorMessages: Record<string, string> = {
          invalid_qr_code: 'This QR code is invalid or has been tampered with.',
          site_not_found: 'Site not found. This QR code does not match any registered heritage site.',
          site_inactive: 'This heritage site is currently inactive.',
          missing_payload: 'Invalid scan data. Please try scanning again.',
          missing_user_id: 'Authentication error. Please log in again.',
        }

        setPageState({
          status: 'error',
          error: {
            type: 'verification_error',
            message: errorMessages[response.error] || 'An unexpected error occurred.',
          },
        })
        return
      }

      if (response.success) {
        setPageState({ status: 'success', result: response })

        // Navigate to the site content page after a brief delay
        setTimeout(() => {
          if (response.site_id) {
            navigate(`/app/sites/${response.site_id}`)
          }
        }, 1500)
      }
    } catch {
      setPageState({
        status: 'error',
        error: { type: 'verification_error', message: 'Network error. Please check your connection and try again.' },
      })
    }
  }, [user, navigate])

  const handleScanSuccess = useCallback((decodedText: string) => {
    setPageState({ status: 'verifying', decodedText })
    verifyQrCode(decodedText)
  }, [verifyQrCode])

  const handleScanError = useCallback((error: ScanError) => {
    setPageState({ status: 'error', error })
  }, [])

  const handleBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  const handleRetryScan = useCallback(() => {
    setPageState({ status: 'scanning' })
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b border-border">
        <button
          onClick={handleBack}
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-sm font-medium hover:bg-accent transition-colors"
          aria-label="Go back"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-foreground">
          Scan QR Code
        </h1>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {pageState.status === 'scanning' && (
          <QRScanner
            onScanSuccess={handleScanSuccess}
            onScanError={handleScanError}
            timeoutMs={30000}
          />
        )}

        {pageState.status === 'verifying' && (
          <div className="w-full max-w-sm p-6 text-center space-y-4">
            <div className="text-4xl" aria-hidden="true">✅</div>
            <h2 className="text-lg font-semibold text-foreground">
              QR Code Detected
            </h2>
            <p className="text-sm text-muted-foreground">
              Verifying your scan...
            </p>
            <div
              className="w-8 h-8 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"
              role="status"
              aria-label="Verifying scan"
            />
          </div>
        )}

        {pageState.status === 'success' && (
          <div className="w-full max-w-sm p-6 text-center space-y-4" role="alert" aria-live="polite">
            <div className="text-4xl" aria-hidden="true">🎉</div>
            <h2 className="text-lg font-semibold text-foreground">
              {pageState.result.already_unlocked
                ? 'Site Already Unlocked'
                : 'Site Unlocked!'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {pageState.result.already_unlocked
                ? `Navigating to ${pageState.result.site_name ?? 'the site'}...`
                : `You earned ${pageState.result.points_awarded ?? 10} points! Navigating to ${pageState.result.site_name ?? 'the site'}...`}
            </p>
            <div
              className="w-8 h-8 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"
              role="status"
              aria-label="Navigating to site"
            />
          </div>
        )}

        {pageState.status === 'error' && (
          <div className="w-full max-w-sm p-6 text-center space-y-4" role="alert" aria-live="polite">
            <div className="text-4xl" aria-hidden="true">⚠️</div>
            <h2 className="text-lg font-semibold text-foreground">
              Scan Error
            </h2>
            <p className="text-sm text-muted-foreground">
              {'message' in pageState.error
                ? pageState.error.message
                : pageState.error.type === 'permission_denied'
                  ? 'Camera permission is required to scan QR codes.'
                  : pageState.error.type === 'timeout'
                    ? 'No QR code was detected. Please try again.'
                    : 'Something went wrong. Please try again.'}
            </p>
            <button
              onClick={handleRetryScan}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors min-h-[44px] min-w-[44px]"
            >
              Try Again
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
