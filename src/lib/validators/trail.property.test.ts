import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateTrailSiteCount } from './trail'

/**
 * Property 21: Trail site count validation
 *
 * For any trail creation or update operation with an assigned site list, the validator
 * SHALL accept if the list contains between 2 and 30 sites (inclusive) and reject otherwise.
 *
 * **Validates: Requirements 8.4, 8.5**
 */
describe('Property 21: Trail site count validation', () => {
  // --- Generators ---

  /** Generate a valid site count in range [2, 30] */
  const validSiteCount = fc.integer({ min: 2, max: 30 })

  /** Generate a count below the minimum (less than 2) */
  const tooFewSites = fc.integer({ min: -100, max: 1 })

  /** Generate a count above the maximum (greater than 30) */
  const tooManySites = fc.integer({ min: 31, max: 1000 })

  /** Generate a non-integer number */
  const nonIntegerCount = fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true })
    .filter((n) => !Number.isInteger(n))

  it('should accept any integer count between 2 and 30 inclusive', () => {
    fc.assert(
      fc.property(validSiteCount, (count) => {
        const result = validateTrailSiteCount(count)
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      }),
      { numRuns: 200 }
    )
  })

  it('should reject any count below 2', () => {
    fc.assert(
      fc.property(tooFewSites, (count) => {
        const result = validateTrailSiteCount(count)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }),
      { numRuns: 100 }
    )
  })

  it('should reject any count above 30', () => {
    fc.assert(
      fc.property(tooManySites, (count) => {
        const result = validateTrailSiteCount(count)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }),
      { numRuns: 100 }
    )
  })

  it('should accept boundary values 2 and 30, reject 1 and 31', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(2),
          fc.constant(30)
        ),
        (count) => {
          const result = validateTrailSiteCount(count)
          expect(result.valid).toBe(true)
          expect(result.error).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )

    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(1),
          fc.constant(31)
        ),
        (count) => {
          const result = validateTrailSiteCount(count)
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
        const result = validateTrailSiteCount(count)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }),
      { numRuns: 200 }
    )
  })
})
