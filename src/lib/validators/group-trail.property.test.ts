import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateGroupSize } from './group-trail'

/**
 * Property 22: Group trail attempt size validation
 *
 * For any group trail creation with N invitees, the validator SHALL accept if 1 ≤ N ≤ 9
 * (total group size including leader is 2–10) and reject otherwise.
 *
 * **Validates: Requirements 17.1**
 */
describe('Property 22: Group trail attempt size validation', () => {
  // --- Generators ---

  /** Generate a valid invitee count in range [1, 9] */
  const validInviteeCount = fc.integer({ min: 1, max: 9 })

  /** Generate a count below the minimum (less than 1) */
  const tooFewInvitees = fc.integer({ min: -100, max: 0 })

  /** Generate a count above the maximum (greater than 9) */
  const tooManyInvitees = fc.integer({ min: 10, max: 1000 })

  /** Generate a non-integer number */
  const nonIntegerCount = fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true })
    .filter((n) => !Number.isInteger(n))

  it('should accept any integer invitee count between 1 and 9 inclusive', () => {
    fc.assert(
      fc.property(validInviteeCount, (count) => {
        const result = validateGroupSize(count)
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      }),
      { numRuns: 200 }
    )
  })

  it('should reject any invitee count below 1', () => {
    fc.assert(
      fc.property(tooFewInvitees, (count) => {
        const result = validateGroupSize(count)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }),
      { numRuns: 100 }
    )
  })

  it('should reject any invitee count above 9', () => {
    fc.assert(
      fc.property(tooManyInvitees, (count) => {
        const result = validateGroupSize(count)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }),
      { numRuns: 100 }
    )
  })

  it('should accept boundary values 1 and 9, reject 0 and 10', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(1),
          fc.constant(9)
        ),
        (count) => {
          const result = validateGroupSize(count)
          expect(result.valid).toBe(true)
          expect(result.error).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )

    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(0),
          fc.constant(10)
        ),
        (count) => {
          const result = validateGroupSize(count)
          expect(result.valid).toBe(false)
          expect(result.error).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject non-integer values', () => {
    fc.assert(
      fc.property(nonIntegerCount, (count) => {
        const result = validateGroupSize(count)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }),
      { numRuns: 200 }
    )
  })
})
