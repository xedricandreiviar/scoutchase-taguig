/**
 * Property-based tests for group trail progress and completion.
 *
 * Property 23: Group trail progress and completion
 * For any group trail attempt with M members and a trail of N sites, the group progress
 * percentage SHALL equal `|union of all member unlocks| / N × 100`. The attempt SHALL be
 * marked complete if and only if the union of all member unlocks covers all N sites in the trail.
 *
 * Validates: Requirements 17.4, 17.5
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { calculateGroupProgress } from './group-progress'

/**
 * Arbitrary that generates a totalSites count and a corresponding array of member unlock sets.
 * Each member's unlock set is a subset of the trail's site IDs.
 */
const arbGroupTrailAttempt = fc
  .integer({ min: 1, max: 50 })
  .chain((totalSites) => {
    const allSiteIds = Array.from({ length: totalSites }, (_, i) => `site-${i + 1}`)
    const arbMemberSubset = fc.subarray(allSiteIds, { minLength: 0, maxLength: totalSites })
    const arbMembers = fc.array(arbMemberSubset, { minLength: 1, maxLength: 10 })
    return arbMembers.map((memberUnlocks) => ({ totalSites, memberUnlocks }))
  })

describe('Property 23: Group trail progress and completion', () => {
  it('progress equals round(|union of unlocks| / totalSites × 100)', () => {
    fc.assert(
      fc.property(arbGroupTrailAttempt, ({ totalSites, memberUnlocks }) => {
        const result = calculateGroupProgress(memberUnlocks, totalSites)

        // Compute union of all member unlocks
        const unionSet = new Set<string>()
        for (const unlocks of memberUnlocks) {
          for (const siteId of unlocks) {
            unionSet.add(siteId)
          }
        }

        const expectedUnionSize = Math.min(unionSet.size, totalSites)
        const expectedProgress = Math.round((expectedUnionSize / totalSites) * 100)

        expect(result.progress).toBe(expectedProgress)
        expect(result.uniqueSitesUnlocked).toBe(expectedUnionSize)
      }),
      { numRuns: 1000 }
    )
  })

  it('isComplete is true if and only if the union covers all sites', () => {
    fc.assert(
      fc.property(arbGroupTrailAttempt, ({ totalSites, memberUnlocks }) => {
        const result = calculateGroupProgress(memberUnlocks, totalSites)

        // Compute union of all member unlocks
        const unionSet = new Set<string>()
        for (const unlocks of memberUnlocks) {
          for (const siteId of unlocks) {
            unionSet.add(siteId)
          }
        }

        const coversAll = unionSet.size >= totalSites
        expect(result.isComplete).toBe(coversAll)
      }),
      { numRuns: 1000 }
    )
  })

  it('progress is always between 0 and 100 inclusive', () => {
    fc.assert(
      fc.property(arbGroupTrailAttempt, ({ totalSites, memberUnlocks }) => {
        const result = calculateGroupProgress(memberUnlocks, totalSites)

        expect(result.progress).toBeGreaterThanOrEqual(0)
        expect(result.progress).toBeLessThanOrEqual(100)
      }),
      { numRuns: 1000 }
    )
  })

  it('empty memberUnlocks yields 0 progress and not complete', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), (totalSites) => {
        const result = calculateGroupProgress([], totalSites)

        expect(result.progress).toBe(0)
        expect(result.isComplete).toBe(false)
        expect(result.uniqueSitesUnlocked).toBe(0)
      }),
      { numRuns: 100 }
    )
  })
})
