/**
 * Property-based tests for badge criteria evaluation.
 *
 * Property 17: Badge criteria evaluation
 * For any user activity profile and badge criteria, the badge evaluator SHALL award
 * a badge if and only if the user's stats meet or exceed every criterion defined
 * in the badge's criteria_json.
 *
 * Validates: Requirements 11.2
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { evaluateBadgeCriteria } from './evaluator'
import type { UserActivityProfile, BadgeCriteria } from './evaluator'

/**
 * All possible criterion types.
 */
const CRITERIA_TYPES: BadgeCriteria['type'][] = [
  'sites_visited',
  'history_challenges',
  'service_hours',
  'env_challenges',
  'all_trails_in_district',
  'referrals_with_challenge',
  'culture_challenges',
  'total_points',
]

/**
 * Generate an arbitrary UserActivityProfile with non-negative integer values.
 */
const arbProfile: fc.Arbitrary<UserActivityProfile> = fc.record({
  sitesVisited: fc.nat({ max: 100 }),
  historyChallenges: fc.nat({ max: 50 }),
  serviceHours: fc.nat({ max: 500 }),
  envChallenges: fc.nat({ max: 50 }),
  trailsCompleted: fc.nat({ max: 30 }),
  totalTrails: fc.nat({ max: 30 }),
  referralsWithChallenge: fc.nat({ max: 50 }),
  cultureChallenges: fc.nat({ max: 50 }),
  totalPoints: fc.nat({ max: 5000 }),
})

/**
 * Generate a single arbitrary BadgeCriteria with a random type and threshold.
 */
const arbCriterion: fc.Arbitrary<BadgeCriteria> = fc.record({
  type: fc.constantFrom(...CRITERIA_TYPES),
  threshold: fc.integer({ min: 1, max: 100 }),
})

/**
 * Generate an array of 1-5 badge criteria (non-empty).
 */
const arbCriteria: fc.Arbitrary<BadgeCriteria[]> = fc.array(arbCriterion, {
  minLength: 1,
  maxLength: 5,
})

/**
 * Helper: manually check if a profile meets a single criterion.
 * This mirrors the logic in the evaluator for verification purposes.
 */
function meetsCriterion(profile: UserActivityProfile, criterion: BadgeCriteria): boolean {
  if (criterion.type === 'all_trails_in_district') {
    return profile.totalTrails > 0 && profile.trailsCompleted >= profile.totalTrails
  }

  const valueMap: Record<BadgeCriteria['type'], number> = {
    sites_visited: profile.sitesVisited,
    history_challenges: profile.historyChallenges,
    service_hours: profile.serviceHours,
    env_challenges: profile.envChallenges,
    all_trails_in_district: profile.trailsCompleted,
    referrals_with_challenge: profile.referralsWithChallenge,
    culture_challenges: profile.cultureChallenges,
    total_points: profile.totalPoints,
  }

  return valueMap[criterion.type] >= criterion.threshold
}

describe('Property 17: Badge criteria evaluation', () => {
  it('badge awarded iff ALL criteria thresholds are met/exceeded', () => {
    fc.assert(
      fc.property(arbProfile, arbCriteria, (profile, criteria) => {
        const result = evaluateBadgeCriteria(profile, criteria)

        // Independently verify: all criteria must be met
        const allMet = criteria.every((c) => meetsCriterion(profile, c))

        expect(result).toBe(allMet)
      }),
      { numRuns: 500 }
    )
  })

  it('empty criteria → false (never awards)', () => {
    fc.assert(
      fc.property(arbProfile, (profile) => {
        const result = evaluateBadgeCriteria(profile, [])
        expect(result).toBe(false)
      }),
      { numRuns: 200 }
    )
  })

  it('function is deterministic', () => {
    fc.assert(
      fc.property(arbProfile, arbCriteria, (profile, criteria) => {
        const result1 = evaluateBadgeCriteria(profile, criteria)
        const result2 = evaluateBadgeCriteria(profile, criteria)

        expect(result1).toBe(result2)
      }),
      { numRuns: 200 }
    )
  })

  it('adding more criteria can only make it harder to qualify (monotonicity)', () => {
    fc.assert(
      fc.property(
        arbProfile,
        arbCriteria,
        arbCriterion,
        (profile, baseCriteria, extraCriterion) => {
          const resultBase = evaluateBadgeCriteria(profile, baseCriteria)
          const resultExtended = evaluateBadgeCriteria(profile, [
            ...baseCriteria,
            extraCriterion,
          ])

          // If extended criteria awards badge, base criteria must also award
          // (adding criteria cannot make it easier)
          if (resultExtended) {
            expect(resultBase).toBe(true)
          }
        }
      ),
      { numRuns: 500 }
    )
  })
})
