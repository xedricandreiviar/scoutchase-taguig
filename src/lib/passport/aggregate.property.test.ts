/**
 * Property-based tests for Digital Passport aggregation correctness.
 *
 * Property 5: Digital Passport aggregation correctness
 * For any set of user activity records (QR scans, approved submissions, verified service logs,
 * earned badges, points ledger entries), the passport aggregation function SHALL produce counts
 * and totals that exactly match the sum/count of the corresponding records.
 *
 * Validates: Requirements 4.1
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  aggregatePassportData,
  type VisitedSite,
  type CompletedChallenge,
  type ServiceHourEntry,
  type EarnedBadge,
  type PointsLedgerEntry,
  type RawPassportData,
} from './aggregate'

/**
 * Arbitrary generators for passport activity records.
 */

const arbVisitedSite: fc.Arbitrary<VisitedSite> = fc.record({
  site_id: fc.uuid(),
  site_name: fc.string({ minLength: 1, maxLength: 50 }),
  scanned_at: fc.date().map((d) => d.toISOString()),
})

const arbCompletedChallenge: fc.Arbitrary<CompletedChallenge> = fc.record({
  challenge_id: fc.uuid(),
  challenge_name: fc.string({ minLength: 1, maxLength: 50 }),
  completed_at: fc.date().map((d) => d.toISOString()),
  points_awarded: fc.nat({ max: 200 }),
})

const arbServiceHourEntry: fc.Arbitrary<ServiceHourEntry> = fc.record({
  log_id: fc.uuid(),
  description: fc.string({ minLength: 20, maxLength: 100 }),
  duration_hours: fc.float({ min: 0.5, max: 24, noNaN: true })
    .map((v) => Math.round(v * 2) / 2), // 0.5 increments
  verified_at: fc.date().map((d) => d.toISOString()),
})

const arbEarnedBadge: fc.Arbitrary<EarnedBadge> = fc.record({
  badge_id: fc.uuid(),
  badge_name: fc.string({ minLength: 1, maxLength: 50 }),
  icon_url: fc.webUrl(),
  earned_at: fc.date().map((d) => d.toISOString()),
})

const arbPointsLedgerEntry: fc.Arbitrary<PointsLedgerEntry> = fc.record({
  id: fc.uuid(),
  amount: fc.integer({ min: -100, max: 500 }),
  reason: fc.string({ minLength: 1, maxLength: 50 }),
  created_at: fc.date().map((d) => d.toISOString()),
})

const arbRawPassportData: fc.Arbitrary<RawPassportData> = fc.record({
  visited_sites: fc.array(arbVisitedSite, { minLength: 0, maxLength: 20 }),
  completed_challenges: fc.array(arbCompletedChallenge, { minLength: 0, maxLength: 20 }),
  service_hours: fc.array(arbServiceHourEntry, { minLength: 0, maxLength: 20 }),
  earned_badges: fc.array(arbEarnedBadge, { minLength: 0, maxLength: 20 }),
  points_ledger: fc.array(arbPointsLedgerEntry, { minLength: 0, maxLength: 30 }),
  rank: fc.option(fc.nat({ max: 1000 }), { nil: null }),
})

describe('Property 5: Digital Passport aggregation correctness', () => {
  it('visitedSites.count equals length of visited_sites array', () => {
    fc.assert(
      fc.property(arbRawPassportData, (raw) => {
        const result = aggregatePassportData(raw)
        expect(result.visitedSites.count).toBe(raw.visited_sites.length)
      }),
      { numRuns: 1000 }
    )
  })

  it('completedChallenges.count equals length of completed_challenges array', () => {
    fc.assert(
      fc.property(arbRawPassportData, (raw) => {
        const result = aggregatePassportData(raw)
        expect(result.completedChallenges.count).toBe(raw.completed_challenges.length)
      }),
      { numRuns: 1000 }
    )
  })

  it('earnedBadges.count equals length of earned_badges array', () => {
    fc.assert(
      fc.property(arbRawPassportData, (raw) => {
        const result = aggregatePassportData(raw)
        expect(result.earnedBadges.count).toBe(raw.earned_badges.length)
      }),
      { numRuns: 1000 }
    )
  })

  it('totalPoints equals sum of points_ledger amounts', () => {
    fc.assert(
      fc.property(arbRawPassportData, (raw) => {
        const result = aggregatePassportData(raw)
        const expectedTotal = raw.points_ledger.reduce((sum, entry) => sum + entry.amount, 0)
        expect(result.totalPoints).toBe(expectedTotal)
      }),
      { numRuns: 1000 }
    )
  })

  it('serviceHours displayHours + displayMinutes correctly represent total', () => {
    fc.assert(
      fc.property(arbRawPassportData, (raw) => {
        const result = aggregatePassportData(raw)

        // Total decimal hours from raw records
        const totalDecimalHours = raw.service_hours.reduce(
          (sum, entry) => sum + entry.duration_hours,
          0
        )
        const totalMinutesRaw = Math.round(totalDecimalHours * 60)

        // displayHours and displayMinutes should reconstruct total minutes
        expect(result.serviceHours.displayHours * 60 + result.serviceHours.displayMinutes)
          .toBe(totalMinutesRaw)

        // displayMinutes should be in range [0, 59]
        expect(result.serviceHours.displayMinutes).toBeGreaterThanOrEqual(0)
        expect(result.serviceHours.displayMinutes).toBeLessThan(60)

        // displayHours should be non-negative
        expect(result.serviceHours.displayHours).toBeGreaterThanOrEqual(0)
      }),
      { numRuns: 1000 }
    )
  })
})
