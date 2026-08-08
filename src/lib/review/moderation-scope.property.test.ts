import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { canRoverModerate } from './moderation-scope'
import type { UserRole } from '@/stores/auth'

/**
 * Property 24: Rover Scout moderation scope
 *
 * For any submission in the review queue, a Rover_Scout SHALL be permitted to
 * moderate it if and only if the submission's author has role Cub_Scout or Boy_Scout.
 *
 * **Validates: Requirements 18.3, 18.4**
 */
describe('Property 24: Rover Scout moderation scope', () => {
  // --- Constants ---
  const ALL_ROLES: UserRole[] = [
    'Guest',
    'Cub_Scout',
    'Boy_Scout',
    'Senior_Scout',
    'Rover_Scout',
    'Adult_Leader',
    'Council_Admin',
  ]

  const MODERATABLE_ROLES: UserRole[] = ['Cub_Scout', 'Boy_Scout']

  const NON_MODERATABLE_ROLES: UserRole[] = [
    'Guest',
    'Senior_Scout',
    'Rover_Scout',
    'Adult_Leader',
    'Council_Admin',
  ]

  // --- Generators ---

  /** Generate any valid UserRole */
  const userRoleArb = fc.constantFrom(...ALL_ROLES)

  /** Generate a role that Rover can moderate */
  const moderatableRoleArb = fc.constantFrom(...MODERATABLE_ROLES)

  /** Generate a role that Rover CANNOT moderate */
  const nonModeratableRoleArb = fc.constantFrom(...NON_MODERATABLE_ROLES)

  // --- Property Tests ---

  it('Rover_Scout can moderate iff author is Cub_Scout or Boy_Scout', () => {
    fc.assert(
      fc.property(
        userRoleArb,
        (authorRole) => {
          const result = canRoverModerate(authorRole)
          const expected = authorRole === 'Cub_Scout' || authorRole === 'Boy_Scout'
          expect(result).toBe(expected)
        }
      ),
      { numRuns: 500 }
    )
  })

  it('Rover_Scout CANNOT moderate Senior_Scout, Rover_Scout, Adult_Leader, Council_Admin submissions', () => {
    fc.assert(
      fc.property(
        nonModeratableRoleArb,
        (authorRole) => {
          const result = canRoverModerate(authorRole)
          expect(result).toBe(false)
        }
      ),
      { numRuns: 500 }
    )
  })

  it('function is deterministic — same input always produces same output', () => {
    fc.assert(
      fc.property(
        userRoleArb,
        (authorRole) => {
          const result1 = canRoverModerate(authorRole)
          const result2 = canRoverModerate(authorRole)
          expect(result1).toBe(result2)
        }
      ),
      { numRuns: 500 }
    )
  })

  it('Rover_Scout CAN moderate all Cub_Scout and Boy_Scout submissions', () => {
    fc.assert(
      fc.property(
        moderatableRoleArb,
        (authorRole) => {
          const result = canRoverModerate(authorRole)
          expect(result).toBe(true)
        }
      ),
      { numRuns: 300 }
    )
  })
})
