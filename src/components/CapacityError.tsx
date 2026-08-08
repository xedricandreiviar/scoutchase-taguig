/**
 * CapacityError component (Req 22.4)
 *
 * Displayed when the platform returns HTTP 429 (Too Many Requests) or
 * 503 (Service Unavailable), indicating temporary capacity limits have
 * been exceeded. Shows an informative message and offers a retry action.
 */

import { useState, useEffect, useCallback } from 'react'

export interface CapacityErrorProps {
  /** The HTTP status code that triggered the error (429 or 503) */
  statusCode: 429 | 503
  /** Optional Retry-After value in seconds from the response header */
  retryAfterSeconds?: number
  /** Callback invoked when user clicks the retry button */
  onRetry: () => void
}

/**
 * Renders a user-friendly message when the platform exceeds capacity.
 * Includes a countdown timer when a Retry-After header is available.
 */
export function CapacityError({
  statusCode,
  retryAfterSeconds,
  onRetry,
}: CapacityErrorProps) {
  const [countdown, setCountdown] = useState<number | null>(
    retryAfterSeconds ?? null
  )

  useEffect(() => {
    if (countdown === null || countdown <= 0) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [countdown])

  const handleRetry = useCallback(() => {
    onRetry()
  }, [onRetry])

  const isRetryAvailable = countdown === null || countdown <= 0

  const title =
    statusCode === 429
      ? 'Too many requests'
      : 'Service temporarily unavailable'

  const message =
    statusCode === 429
      ? 'The platform is experiencing high demand. Please wait a moment before trying again.'
      : 'We are currently at capacity serving many users. Your data is safe — please try again shortly.'

  return (
    <div
      className="flex min-h-[300px] items-center justify-center p-6"
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-md text-center space-y-4">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100"
          aria-hidden="true"
        >
          <svg
            className="h-8 w-8 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-muted-foreground">{message}</p>

        {countdown !== null && countdown > 0 && (
          <p className="text-sm text-muted-foreground">
            Retry available in{' '}
            <span className="font-medium text-foreground">{countdown}s</span>
          </p>
        )}

        <button
          type="button"
          onClick={handleRetry}
          disabled={!isRetryAvailable}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]"
          aria-label={
            isRetryAvailable
              ? 'Retry loading the page'
              : `Retry available in ${countdown} seconds`
          }
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
            />
          </svg>
          {isRetryAvailable ? 'Try again' : 'Please wait...'}
        </button>
      </div>
    </div>
  )
}

/**
 * Utility to detect if a fetch response indicates a capacity error.
 * Returns the appropriate status code if capacity-related, or null otherwise.
 */
export function isCapacityError(
  status: number
): 429 | 503 | null {
  if (status === 429) return 429
  if (status === 503) return 503
  return null
}

/**
 * Extracts the Retry-After value from response headers (in seconds).
 * Supports both delta-seconds and HTTP-date formats.
 */
export function parseRetryAfter(
  headers: Headers | Record<string, string>
): number | undefined {
  const value =
    headers instanceof Headers
      ? headers.get('Retry-After')
      : headers['Retry-After'] || headers['retry-after']

  if (!value) return undefined

  // Try parsing as integer (delta-seconds)
  const seconds = parseInt(value, 10)
  if (!isNaN(seconds) && seconds > 0) return seconds

  // Try parsing as HTTP-date
  const date = new Date(value)
  if (!isNaN(date.getTime())) {
    const delta = Math.ceil((date.getTime() - Date.now()) / 1000)
    return delta > 0 ? delta : undefined
  }

  return undefined
}
