import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateContentSize, MAX_CONTENT_LENGTH } from './content-validator'

/**
 * Property 27: Content size validation
 *
 * For any arbitrary string, the content size validator SHALL accept if and only if
 * its serialized length is ≤ 500,000 characters.
 *
 * **Validates: Requirements 24.7**
 */
describe('Property 27: Content size validation', () => {
  it('should accept any string with length ≤ 500,000 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: MAX_CONTENT_LENGTH }),
        (content) => {
          const result = validateContentSize(content)
          expect(result.valid).toBe(true)
          expect(result.error).toBeUndefined()
        }
      ),
      { numRuns: 200 }
    )
  })

  it('should reject any string with length > 500,000 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: MAX_CONTENT_LENGTH + 1, maxLength: MAX_CONTENT_LENGTH + 10_000 }),
        (content) => {
          const result = validateContentSize(content)
          expect(result.valid).toBe(false)
          expect(result.error).toBeDefined()
        }
      ),
      { numRuns: 200 }
    )
  })

  it('should accept empty strings', () => {
    fc.assert(
      fc.property(
        fc.constant(''),
        (content) => {
          const result = validateContentSize(content)
          expect(result.valid).toBe(true)
          expect(result.error).toBeUndefined()
        }
      ),
      { numRuns: 1 }
    )
  })

  it('should accept strings at exact boundary (500,000 characters)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: MAX_CONTENT_LENGTH, maxLength: MAX_CONTENT_LENGTH }),
        (content) => {
          const result = validateContentSize(content)
          expect(result.valid).toBe(true)
          expect(result.error).toBeUndefined()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should reject strings at boundary + 1 (500,001 characters)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: MAX_CONTENT_LENGTH + 1, maxLength: MAX_CONTENT_LENGTH + 1 }),
        (content) => {
          const result = validateContentSize(content)
          expect(result.valid).toBe(false)
          expect(result.error).toBeDefined()
        }
      ),
      { numRuns: 50 }
    )
  })
})
