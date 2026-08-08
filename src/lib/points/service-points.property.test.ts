/**
 * Property-based tests for service hour point award calculation.
 *
 * Property 15: Service hour point award calculation
 * For any verified service log with duration D hours, the points awarded SHALL equal
 * `floor(D) * 10 + (if fractional part >= 0.5 then 5 else 0)` (10 points per hour),
 * subject to a maximum of 500 points per calendar month per user.
 *
 * Validates: Requirements 10.4, 11.1
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  calculateServicePoints,
  calculateMonthlyServicePoints,
  SERVICE_POINTS_MONTHLY_CAP,
} from './service-points'

/**
 * Generate arbitrary duration values representing valid service hours.
 * Range: 0.0 to 100.0 (beyond the 24hr form limit to stress-test the formula).
 */
const arbDuration = fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true })

/**
 * Generate arbitrary positive duration values (> 0).
 */
const arbPositiveDuration = fc.double({
  min: 0.01,
  max: 100,
  noNaN: true,
  noDefaultInfinity: true,
})

/**
 * Generate arbitrary monthly points already earned (0 to 600, can exceed cap).
 */
const arbAlreadyEarned = fc.integer({ min: 0, max: 600 })

/**
 * Reference implementation of the point formula for verification.
 */
function expectedPoints(duration: number): number {
  if (duration <= 0) return 0
  const wholeHours = Math.floor(duration)
  const fractionalPart = duration - wholeHours
  return wholeHours * 10 + (fractionalPart >= 0.5 ? 5 : 0)
}

describe('Property 15: Service hour point award calculation', () => {
  it('points = floor(D)×10 + (fractional >= 0.5 ? 5 : 0) for any duration', () => {
    fc.assert(
      fc.property(arbDuration, (duration) => {
        const result = calculateServicePoints(duration)
        const expected = expectedPoints(duration)

        expect(result).toBe(expected)
      }),
      { numRuns: 1000 }
    )
  })

  it('monthly cap: awarded points never exceed 500 - alreadyEarned', () => {
    fc.assert(
      fc.property(arbPositiveDuration, arbAlreadyEarned, (duration, alreadyEarned) => {
        const rawPoints = calculateServicePoints(duration)
        const awarded = calculateMonthlyServicePoints(alreadyEarned, rawPoints)

        const remaining = Math.max(0, SERVICE_POINTS_MONTHLY_CAP - alreadyEarned)
        expect(awarded).toBeLessThanOrEqual(remaining)
        expect(awarded).toBeLessThanOrEqual(SERVICE_POINTS_MONTHLY_CAP)
      }),
      { numRuns: 1000 }
    )
  })

  it('points are always non-negative', () => {
    fc.assert(
      fc.property(arbDuration, (duration) => {
        const result = calculateServicePoints(duration)
        expect(result).toBeGreaterThanOrEqual(0)
      }),
      { numRuns: 1000 }
    )
  })

  it('zero duration → 0 points', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 0, noNaN: true, noDefaultInfinity: true }),
        (duration) => {
          const result = calculateServicePoints(duration)
          expect(result).toBe(0)
        }
      ),
      { numRuns: 500 }
    )
  })
})
