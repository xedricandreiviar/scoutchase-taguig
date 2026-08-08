/**
 * Attempt limiter for reviewable items (Submissions and Service Logs).
 *
 * Enforces max attempts logic:
 * - Rejection allows resubmission if attempt_number < max_attempts
 * - At max_attempts, marks as "failed" (submissions) or "rejected" (service logs)
 *   and prevents further submissions
 *
 * Validates: Requirements 9.9, 9.10, 10.5, 10.6
 * Property 13: Review attempt limiting
 */

export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'failed'
export type ServiceLogStatus = 'pending_verification' | 'verified' | 'rejected'

export type ReviewAction = 'approve' | 'reject'

/**
 * Determines whether a user can resubmit based on their current attempt number
 * and the maximum allowed attempts.
 *
 * @param attemptNumber - The current attempt number (1-based)
 * @param maxAttempts - The maximum allowed attempts
 * @returns true if the user can resubmit (attempt < max), false otherwise
 */
export function canResubmit(attemptNumber: number, maxAttempts: number): boolean {
  return attemptNumber < maxAttempts
}

/**
 * Determines the next status for a submission based on attempt number, max attempts,
 * and the reviewer's action.
 *
 * For approve: always returns 'approved'
 * For reject:
 *   - If attemptNumber >= maxAttempts → 'failed' (no more resubmissions)
 *   - If attemptNumber < maxAttempts → 'rejected' (can resubmit)
 *
 * @param attemptNumber - The current attempt number (1-based)
 * @param maxAttempts - The maximum allowed attempts
 * @param action - The reviewer's action ('approve' or 'reject')
 * @returns The resulting submission status
 */
export function getSubmissionStatus(
  attemptNumber: number,
  maxAttempts: number,
  action: ReviewAction
): SubmissionStatus {
  if (action === 'approve') {
    return 'approved'
  }

  // Reject: check if max attempts reached
  if (attemptNumber >= maxAttempts) {
    return 'failed'
  }

  return 'rejected'
}

/**
 * Determines the next status for a service log based on attempt number, max attempts,
 * and the reviewer's action.
 *
 * For approve (verify): always returns 'verified'
 * For reject:
 *   - If attemptNumber >= maxAttempts → 'rejected' (no more resubmissions)
 *   - If attemptNumber < maxAttempts → 'rejected' (can resubmit, but status is same)
 *
 * Note: Service logs use 'rejected' as the terminal status (Req 10.6)
 *
 * @param attemptNumber - The current attempt number (1-based)
 * @param maxAttempts - The maximum allowed attempts
 * @param action - The reviewer's action ('approve' or 'reject')
 * @returns The resulting service log status
 */
export function getServiceLogStatus(
  attemptNumber: number,
  maxAttempts: number,
  action: ReviewAction
): ServiceLogStatus {
  if (action === 'approve') {
    return 'verified'
  }

  return 'rejected'
}

/**
 * Validates that feedback meets the minimum length requirement.
 * Rejection feedback must be at least 10 characters (Req 9.9, 10.5).
 *
 * @param feedback - The reviewer's feedback text
 * @returns true if feedback is at least 10 characters
 */
export function isValidFeedback(feedback: string): boolean {
  return feedback.trim().length >= 10
}
