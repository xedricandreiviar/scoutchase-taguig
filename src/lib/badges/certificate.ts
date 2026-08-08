/**
 * Client-side certificate generation service.
 *
 * Calls the `generate-certificate` Supabase Edge Function and handles
 * error responses with retry capability. The badge record is never lost
 * even if certificate generation fails (Req 11.6).
 *
 * Validates: Requirements 11.3, 11.6
 */

import { supabase } from '../supabase'

export interface CertificateResult {
  success: true
  certificate_url: string
  already_generated: boolean
}

export interface CertificateError {
  success: false
  error: string
  message: string
  retryable: boolean
}

export type GenerateCertificateResponse = CertificateResult | CertificateError

/**
 * Calls the generate-certificate Edge Function to produce a downloadable
 * certificate for a badge the user has earned.
 *
 * @param userId - The user's ID
 * @param badgeId - The badge ID to generate a certificate for
 * @returns A result with the certificate URL on success, or an error with retry info
 */
export async function generateCertificate(
  userId: string,
  badgeId: string
): Promise<GenerateCertificateResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-certificate', {
      body: { user_id: userId, badge_id: badgeId },
    })

    if (error) {
      return {
        success: false,
        error: 'certificate_generation_failed',
        message: 'Failed to generate certificate. Please try again.',
        retryable: true,
      }
    }

    if (data.error) {
      // Map specific errors to user-friendly messages
      const errorMessages: Record<string, string> = {
        missing_user_id: 'Invalid request. Please try again.',
        missing_badge_id: 'Invalid request. Please try again.',
        user_not_found: 'User profile not found.',
        badge_not_found: 'Badge not found.',
        badge_not_earned: 'You have not earned this badge yet.',
        certificate_too_large: 'Certificate generation failed due to size constraints. Please try again.',
        certificate_generation_failed: data.message || 'Failed to generate certificate. Please try again.',
      }

      const isRetryable = ['certificate_generation_failed', 'certificate_too_large'].includes(data.error)

      return {
        success: false,
        error: data.error,
        message: errorMessages[data.error] || 'An unexpected error occurred. Please try again.',
        retryable: isRetryable,
      }
    }

    return {
      success: true,
      certificate_url: data.certificate_url,
      already_generated: data.already_generated ?? false,
    }
  } catch {
    // Network or unexpected errors are always retryable (Req 11.6)
    return {
      success: false,
      error: 'network_error',
      message: 'Unable to reach the server. Please check your connection and try again.',
      retryable: true,
    }
  }
}

/**
 * Initiates a download of the certificate from the given URL.
 *
 * @param certificateUrl - The public URL of the certificate file
 * @param fileName - Optional custom filename for the download
 */
export function downloadCertificate(
  certificateUrl: string,
  fileName?: string
): void {
  const link = document.createElement('a')
  link.href = certificateUrl
  link.download = fileName || 'scoutchase-certificate.svg'
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
