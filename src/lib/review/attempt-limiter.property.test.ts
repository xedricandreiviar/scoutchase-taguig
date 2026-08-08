/**
 * Property-based tests for review attempt limiting.
 *
 * Property 13: Review attempt limiting
 * For any reviewable item with attempt_number and max_attempts, rejection SHALL
 * allow resubmission if attempt_number < max_attempts, and SHALL mark the item
 * as "failed"/"rejected" and prevent further submissions if
 * attempt_number >= max_attempts.
 *
 * Validates: Requirements 9.9, 9.10, 10.5, 10.6
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { canResubmit, getSubmissionStatus, getServiceLogStatus } from './attempt-limiter'

/**
 * Generate a valid attempt_number (1-based, at least 1).
 */
const arbAttemptNumber = fc.integer({ min: 1, max: 100 })

/**
 * Generate a valid max_attempts (at least 1).
 */
const arbMaxAttempts = fc.integer({ min: 1, max: 100 })

describe('Property 13: Review attempt limiting', () => {
  it('canResubmit returns true iff attempt < max', () => {
    fc.assert(
      fc.property(arbAttemptNumber, arbMaxAttempts, (attemptNumber, maxAttempts) => {
        const result = canResubmit(attemptNumber, maxAttempts)

        if (attemptNumber < maxAttempts) {
          expect(result).toBe(true)
        } else {
          expect(result).toBe(false)
        }
      }),
      { numRuns: 1000 }
    )
  })

  it('rejection at max attempts → status "failed" for submissions', () => {
    fc.assert(
      fc.property(arbMaxAttempts, (maxAttempts) => {
        // Generate attempt numbers >= maxAttempts
        const attemptNumber = maxAttempts // at the limit
        const status = getSubmissionStatus(attemptNumber, maxAttempts, 'reject')

        expect(status).toBe('failed')
      }),
      { numRuns: 500 }
    )
  })

  it('rejection above max attempts → status "failed" for submissions', () => {
    fc.assert(
      fc.property(
        arbMaxAttempts,
        fc.integer({ min: 1, max: 50 }),
        (maxAttempts, extra) => {
          // attempt exceeds max
          const attemptNumber = maxAttempts + extra
          const status = getSubmissionStatus(attemptNumber, maxAttempts, 'reject')

          expect(status).toBe('failed')
        }
      ),
      { numRuns: 500 }
    )
  })

  it('rejection below max attempts → status "rejected" (can resubmit)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        (maxAttempts) => {
          // Ensure attempt is strictly less than max
          const attemptNumber = fc.sample(
            fc.integer({ min: 1, max: maxAttempts - 1 }),
            1
          )[0]

          const status = getSubmissionStatus(attemptNumber, maxAttempts, 'reject')
          expect(status).toBe('rejected')

          // Also verify canResubmit agrees
          expect(canResubmit(attemptNumber, maxAttempts)).toBe(true)
        }
      ),
      { numRuns: 500 }
    )
  })

  it('approval always → status "approved" regardless of attempts', () => {
    fc.assert(
      fc.property(arbAttemptNumber, arbMaxAttempts, (attemptNumber, maxAttempts) => {
        const status = getSubmissionStatus(attemptNumber, maxAttempts, 'approve')

        expect(status).toBe('approved')
      }),
      { numRuns: 1000 }
    )
  })

  it('canResubmit and getSubmissionStatus are consistent on reject', () => {
    fc.assert(
      fc.property(arbAttemptNumber, arbMaxAttempts, (attemptNumber, maxAttempts) => {
        const resubmitAllowed = canResubmit(attemptNumber, maxAttempts)
        const status = getSubmissionStatus(attemptNumber, maxAttempts, 'reject')

        if (resubmitAllowed) {
          // If resubmission is allowed, status should be 'rejected' (not terminal)
          expect(status).toBe('rejected')
        } else {
          // If resubmission is blocked, status should be 'failed' (terminal)
          expect(status).toBe('failed')
        }
      }),
      { numRuns: 1000 }
    )
  })

  it('service log rejection always returns "rejected" status', () => {
    fc.assert(
      fc.property(arbAttemptNumber, arbMaxAttempts, (attemptNumber, maxAttempts) => {
        const status = getServiceLogStatus(attemptNumber, maxAttempts, 'reject')

        // Service logs use 'rejected' as status for both cases (Req 10.6)
        expect(status).toBe('rejected')

        // But canResubmit still determines if further submissions are allowed
        if (attemptNumber >= maxAttempts) {
          expect(canResubmit(attemptNumber, maxAttempts)).toBe(false)
        } else {
          expect(canResubmit(attemptNumber, maxAttempts)).toBe(true)
        }
      }),
      { numRuns: 500 }
    )
  })

  it('service log approval always returns "verified" regardless of attempts', () => {
    fc.assert(
      fc.property(arbAttemptNumber, arbMaxAttempts, (attemptNumber, maxAttempts) => {
        const status = getServiceLogStatus(attemptNumber, maxAttempts, 'approve')

        expect(status).toBe('verified')
      }),
      { numRuns: 500 }
    )
  })
})
