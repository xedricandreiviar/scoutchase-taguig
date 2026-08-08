import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { filterChallengesByRole, getChallengeConstraints } from './filter'
import type { Challenge, ChallengeType, DifficultyLevel } from './filter'
import type { UserRole } from '@/stores/auth'

/**
 * Property 4 Integration: Cub Scout difficulty filtering + constraints
 *
 * Integration-level property test verifying that challenge filtering and
 * role-based constraints work together correctly for all roles.
 *
 * **Validates: Requirements 3.3**
 */
describe('Property 4 Integration: Cub Scout filtering + constraints coherence', () => {
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
    'Adult_Leader',
    'Council_Admin',
    'Guest',
  ]

  // --- Generators ---

  const challengeTypeArb = fc.constantFrom(...CHALLENGE_TYPES)
  const difficultyArb = fc.constantFrom(...DIFFICULTY_LEVELS)

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

  const challengeListArb = fc.array(challengeArb, { minLength: 0, maxLength: 30 })

  const nonCubScoutRoleArb = fc.constantFrom(...NON_CUB_SCOUT_ROLES)

  // --- Integration Property Tests ---

  it('Cub_Scout: filtered challenges are all Easy AND constraints limit to 3 questions with 200 char limit', () => {
    fc.assert(
      fc.property(challengeListArb, (challenges) => {
        const filtered = filterChallengesByRole(challenges, 'Cub_Scout')
        const constraints = getChallengeConstraints('Cub_Scout')

        // All filtered challenges must be Easy
        for (const challenge of filtered) {
          expect(challenge.difficulty).toBe('Easy')
        }

        // Constraints must enforce simplified view
        expect(constraints.maxTriviaQuestions).toBe(3)
        expect(constraints.maxTextLength).toBe(200)
        expect(constraints.useMultipleChoice).toBe(true)
      }),
      { numRuns: 500 },
    )
  })

  it('Boy_Scout: all challenges pass through AND constraints allow 5 questions with 500 char limit', () => {
    fc.assert(
      fc.property(challengeListArb, (challenges) => {
        const filtered = filterChallengesByRole(challenges, 'Boy_Scout')
        const constraints = getChallengeConstraints('Boy_Scout')

        // All challenges pass through unfiltered
        expect(filtered).toEqual(challenges)
        expect(filtered.length).toBe(challenges.length)

        // Standard constraints
        expect(constraints.maxTriviaQuestions).toBe(5)
        expect(constraints.maxTextLength).toBe(500)
        expect(constraints.useMultipleChoice).toBe(false)
      }),
      { numRuns: 500 },
    )
  })

  it('constraints are consistent with filtering: Cub_Scout gets simpler constraints matching Easy-only filtering', () => {
    fc.assert(
      fc.property(challengeListArb, nonCubScoutRoleArb, (challenges, role) => {
        const cubFiltered = filterChallengesByRole(challenges, 'Cub_Scout')
        const cubConstraints = getChallengeConstraints('Cub_Scout')

        const otherFiltered = filterChallengesByRole(challenges, role)
        const otherConstraints = getChallengeConstraints(role)

        // Cub_Scout always gets a subset (fewer or equal challenges)
        expect(cubFiltered.length).toBeLessThanOrEqual(otherFiltered.length)

        // Cub_Scout constraints are always more restrictive
        expect(cubConstraints.maxTriviaQuestions).toBeLessThanOrEqual(
          otherConstraints.maxTriviaQuestions,
        )
        expect(cubConstraints.maxTextLength).toBeLessThanOrEqual(otherConstraints.maxTextLength)

        // Cub_Scout always uses multiple choice (simpler interaction)
        expect(cubConstraints.useMultipleChoice).toBe(true)
      }),
      { numRuns: 500 },
    )
  })
})
