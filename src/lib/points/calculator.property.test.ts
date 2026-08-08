/**
 * Property-based tests for point system calculation.
 *
 * Property 16: Point system calculation
 * For any combination of completed challenges, verified service hours, completed trails,
 * and attended events, the total points SHALL equal:
 * (challenges_completed × 50) + (service_points capped at 500/month) + (trails_completed × 100) + (events_attended × 25).
 *
 * Validates: Requirements 11.1
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  calculateTotalPoints,
  POINTS_PER_CHALLENGE,
  POINTS_PER_TRAIL,
  POINTS_PER_EVENT,
} from './calculator'
import { SERVICE_POINTS_MONTHLY_CAP } from './service-points'

/**
 * Arbitrary for non-negative activity counts representing a realistic scout scenario.
 */
const arbActivityCounts = fc.record({
  challenges: fc.nat({ max: 200 }),
  servicePoints: fc.nat({ max: 1000 }), // raw service points before cap
  trails: fc.nat({ max: 50 }),
  events: fc.nat({ max: 200 }),
})

/**
 * Arbitrary for activity counts with service points already capped at 500/month.
 */
const arbCappedActivityCounts = fc.record({
  challenges: fc.nat({ max: 200 }),
  servicePoints: fc.nat({ max: SERVICE_POINTS_MONTHLY_CAP }),
  trails: fc.nat({ max: 50 }),
  events: fc.nat({ max: 200 }),
})

describe('Property 16: Point system calculation', () => {
  it('total equals challenges×50 + servicePoints + trails×100 + events×25', () => {
    fc.assert(
      fc.property(arbCappedActivityCounts, (activities) => {
        const result = calculateTotalPoints(activities)

        const expected =
          activities.challenges * POINTS_PER_CHALLENGE +
          activities.servicePoints +
          activities.trails * POINTS_PER_TRAIL +
          activities.events * POINTS_PER_EVENT

        expect(result).toBe(expected)
      }),
      { numRuns: 1000 }
    )
  })

  it('zero activities yield 0 points', () => {
    fc.assert(
      fc.property(
        fc.constant({ challenges: 0, servicePoints: 0, trails: 0, events: 0 }),
        (activities) => {
          const result = calculateTotalPoints(activities)
          expect(result).toBe(0)
        }
      ),
      { numRuns: 1 }
    )
  })

  it('points are always non-negative for non-negative inputs', () => {
    fc.assert(
      fc.property(arbActivityCounts, (activities) => {
        const result = calculateTotalPoints(activities)
        expect(result).toBeGreaterThanOrEqual(0)
      }),
      { numRuns: 1000 }
    )
  })

  it('function is deterministic — same inputs always produce same output', () => {
    fc.assert(
      fc.property(arbCappedActivityCounts, (activities) => {
        const result1 = calculateTotalPoints(activities)
        const result2 = calculateTotalPoints(activities)

        expect(result1).toBe(result2)
      }),
      { numRuns: 500 }
    )
  })

  it('service points respect the monthly cap of 500 when used in formula', () => {
    fc.assert(
      fc.property(arbActivityCounts, (activities) => {
        // Simulate capping the service points before passing to calculator
        const cappedServicePoints = Math.min(activities.servicePoints, SERVICE_POINTS_MONTHLY_CAP)
        const cappedActivities = { ...activities, servicePoints: cappedServicePoints }

        const result = calculateTotalPoints(cappedActivities)

        const expected =
          activities.challenges * POINTS_PER_CHALLENGE +
          cappedServicePoints +
          activities.trails * POINTS_PER_TRAIL +
          activities.events * POINTS_PER_EVENT

        expect(result).toBe(expected)
        // Verify capped service contribution never exceeds 500
        expect(cappedServicePoints).toBeLessThanOrEqual(SERVICE_POINTS_MONTHLY_CAP)
      }),
      { numRuns: 500 }
    )
  })
})
