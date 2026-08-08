import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { filterChallengesByRole } from './filter'
import type { Challenge, ChallengeType, DifficultyLevel } from './filter'
import type { UserRole } from '@/stores/auth'

/**
 * Property 4: Cub Scout difficulty filtering
 *
 * For any set of challenges with mixed difficulty levels, filtering challenges
 * for the Cub_Scout role SHALL return only challenges with difficulty = 'Easy',
 * and the result set SHALL be a subset of the input.
 *
 * **Validates: Requirements 3.3**
 */
describe('Property 4: Cub Scout difficulty filtering', () => {
  // --- Constants ---
  const CHALLENGE_TYPES: ChallengeType[] = [
    'trivia_quiz',
    'observation',
    'photo_documentation',
    'puzzle',
    'reflection_journal',
    'interview',
    'storytelling',
  ]

  const DIFFICULTY_LEVELS: DifficultyLevel[] = ['Easy', 'Medium', 'Hard']

  const NON_CUB_SCOUT_ROLES: UserRole[] = [
    'Boy_Scout',
    'Senior_Scout',
    'Rover_Scout',
  ]

  // --- Generators ---

  /** Generate a valid challenge type */
  const challengeTypeArb = fc.constantFrom(...CHALLENGE_TYPES)

  /** Generate a valid difficulty level */
  const difficultyArb = fc.constantFrom(...DIFFICULTY_LEVELS)

  /** Generate a single Challenge object with arbitrary fields */
  const challengeArb: fc.Arbitrary<Challenge> = fc.record({
    id: fc.uuid(),
    heritage_site_id: fc.uuid(),
    type: challengeTypeArb,
    difficulty: difficultyArb,
    title: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
    content_json: fc.constant({}),
    points_reward: fc.integer({ min: 10, max: 200 }),
    max_attempts: fc.integer({ min: 1, max: 5 }),
  })

  /** Generate a list of challenges with mixed difficulties */
  const challengeListArb = fc.array(challengeArb, { minLength: 0, maxLength: 30 })

  /** Generate a challenge with difficulty forced to 'Easy' */
  const easyChallengeArb: fc.Arbitrary<Challenge> = challengeArb.map((c) => ({
    ...c,
    difficulty: 'Easy' as DifficultyLevel,
  }))

  /** Generate a challenge with difficulty forced to non-Easy */
  const nonEasyChallengeArb: fc.Arbitrary<Challenge> = fc.record({
    id: fc.uuid(),
    heritage_site_id: fc.uuid(),
    type: challengeTypeArb,
    difficulty: fc.constantFrom('Medium' as DifficultyLevel, 'Hard' as DifficultyLevel),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
    content_json: fc.constant({}),
    points_reward: fc.integer({ min: 10, max: 200 }),
    max_attempts: fc.integer({ min: 1, max: 5 }),
  })

  /** Generate a non-Cub_Scout scout role */
  const nonCubScoutRoleArb = fc.constantFrom(...NON_CUB_SCOUT_ROLES)

  // --- Property Tests ---

  it('Cub_Scout filter returns only Easy challenges', () => {
    fc.assert(
      fc.property(
        challengeListArb,
        (challenges) => {
          const result = filterChallengesByRole(challenges, 'Cub_Scout')
          // Every challenge in the result must have difficulty 'Easy'
          for (const challenge of result) {
            expect(challenge.difficulty).toBe('Easy')
          }
        }
      ),
      { numRuns: 500 }
    )
  })

  it('Cub_Scout filter result is always a subset of the input', () => {
    fc.assert(
      fc.property(
        challengeListArb,
        (challenges) => {
          const result = filterChallengesByRole(challenges, 'Cub_Scout')
          // Every item in the result must exist in the original input (by reference)
          for (const challenge of result) {
            expect(challenges).toContain(challenge)
          }
          // Result length must not exceed input length
          expect(result.length).toBeLessThanOrEqual(challenges.length)
        }
      ),
      { numRuns: 500 }
    )
  })

  it('for Boy_Scout/Senior_Scout/Rover_Scout, all challenges are returned (no filtering)', () => {
    fc.assert(
      fc.property(
        challengeListArb,
        nonCubScoutRoleArb,
        (challenges, role) => {
          const result = filterChallengesByRole(challenges, role)
          // All challenges should be returned unchanged
          expect(result).toEqual(challenges)
          expect(result.length).toBe(challenges.length)
        }
      ),
      { numRuns: 500 }
    )
  })

  it('for an all-Easy input, Cub_Scout gets all of them back', () => {
    fc.assert(
      fc.property(
        fc.array(easyChallengeArb, { minLength: 0, maxLength: 20 }),
        (challenges) => {
          const result = filterChallengesByRole(challenges, 'Cub_Scout')
          expect(result.length).toBe(challenges.length)
          // Each item should be the same reference
          for (let i = 0; i < challenges.length; i++) {
            expect(result[i]).toBe(challenges[i])
          }
        }
      ),
      { numRuns: 300 }
    )
  })

  it('for a no-Easy input, Cub_Scout gets empty array', () => {
    fc.assert(
      fc.property(
        fc.array(nonEasyChallengeArb, { minLength: 0, maxLength: 20 }),
        (challenges) => {
          const result = filterChallengesByRole(challenges, 'Cub_Scout')
          expect(result).toHaveLength(0)
        }
      ),
      { numRuns: 300 }
    )
  })
})
