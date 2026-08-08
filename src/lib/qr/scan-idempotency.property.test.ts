/**
 * Property 9: QR scan idempotency
 *
 * For any user who has already scanned a heritage site, performing a second scan
 * of the same site SHALL NOT create a duplicate qr_scans record and SHALL NOT
 * change the user's total points.
 *
 * **Validates: Requirements 6.8, 21.6**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { simulateScanResult, SCAN_POINTS } from './scan-handler'

describe('Feature: scoutchase-taguig, Property 9: QR scan idempotency', () => {
  it('for any siteId already in existingScans, result is already_unlocked with 0 points', () => {
    fc.assert(
      fc.property(
        // Generate a non-empty set of already-scanned site IDs, then pick one of them
        fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }).chain((siteIds) => {
          const uniqueIds = [...new Set(siteIds)]
          return fc.record({
            existingScans: fc.constant(new Set(uniqueIds)),
            // Pick one existing site to scan again
            siteId: fc.constantFrom(...uniqueIds),
          })
        }),
        ({ existingScans, siteId }) => {
          const result = simulateScanResult(existingScans, siteId)

          // Idempotency: no points awarded for duplicate scan
          expect(result.status).toBe('already_unlocked')
          expect(result.pointsAwarded).toBe(0)
          expect(result.siteId).toBe(siteId)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('for any siteId NOT in existingScans, result is a new unlock with points', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 20 }),
        fc.uuid(),
        (existingSiteIds, newSiteId) => {
          const existingScans = new Set(existingSiteIds)
          // Ensure the new site is NOT in the existing set
          fc.pre(!existingScans.has(newSiteId))

          const result = simulateScanResult(existingScans, newSiteId)

          expect(result.status).toBe('new_unlock')
          expect(result.pointsAwarded).toBe(SCAN_POINTS)
          expect(result.siteId).toBe(newSiteId)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('after a duplicate scan, the existing scans set remains unchanged (no growth)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }).chain((siteIds) => {
          const uniqueIds = [...new Set(siteIds)]
          return fc.record({
            existingSiteIds: fc.constant(uniqueIds),
            siteId: fc.constantFrom(...uniqueIds),
          })
        }),
        ({ existingSiteIds, siteId }) => {
          const existingScans = new Set(existingSiteIds)
          const sizeBefore = existingScans.size

          // Simulate the scan (pure function — does not mutate)
          const result = simulateScanResult(existingScans, siteId)

          // The set should not have grown (no duplicate record created)
          expect(existingScans.size).toBe(sizeBefore)
          // The result indicates no new record
          expect(result.status).toBe('already_unlocked')
        }
      ),
      { numRuns: 200 }
    )
  })

  it('simulating the same scan twice yields identical idempotent results', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }).chain((siteIds) => {
          const uniqueIds = [...new Set(siteIds)]
          return fc.record({
            existingSiteIds: fc.constant(uniqueIds),
            siteId: fc.constantFrom(...uniqueIds),
          })
        }),
        ({ existingSiteIds, siteId }) => {
          const existingScans = new Set(existingSiteIds)

          const result1 = simulateScanResult(existingScans, siteId)
          const result2 = simulateScanResult(existingScans, siteId)

          // Both calls produce the same result (idempotent)
          expect(result1).toEqual(result2)
          expect(result1.pointsAwarded).toBe(0)
          expect(result2.pointsAwarded).toBe(0)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('total points never increase when scanning an already-unlocked site', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
        fc.nat({ max: 10000 }),
        (siteIds, initialPoints) => {
          const uniqueIds = [...new Set(siteIds)]
          const existingScans = new Set(uniqueIds)
          // Pick the first site as the one being re-scanned
          const siteToRescan = uniqueIds[0]

          let totalPoints = initialPoints

          // Simulate a duplicate scan
          const result = simulateScanResult(existingScans, siteToRescan)
          totalPoints += result.pointsAwarded

          // Points must not change
          expect(totalPoints).toBe(initialPoints)
        }
      ),
      { numRuns: 200 }
    )
  })
})
