import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateDisplayName } from './display-name'

/**
 * Property 6: Display name validation
 *
 * For any string, the display name validator SHALL accept it if and only if its length is
 * between 3 and 30 characters and it contains only letters, numbers, spaces, and hyphens.
 *
 * **Validates: Requirements 4.3, 4.4**
 */
describe('Property 6: Display name validation', () => {
  // --- Generators ---

  /** Valid display name characters: [a-zA-Z0-9 -] */
  const validChar = fc.oneof(
    fc.integer({ min: 0x41, max: 0x5a }).map((c) => String.fromCharCode(c)), // A-Z
    fc.integer({ min: 0x61, max: 0x7a }).map((c) => String.fromCharCode(c)), // a-z
    fc.integer({ min: 0x30, max: 0x39 }).map((c) => String.fromCharCode(c)), // 0-9
    fc.constant(' '),
    fc.constant('-')
  )

  /** Generate a valid display name (length 3-30, only valid chars) */
  const validDisplayName = fc.stringOf(validChar, { minLength: 3, maxLength: 30 })

  /** Generate a string that is too short (length 0-2) using only valid chars */
  const tooShortName = fc.stringOf(validChar, { minLength: 0, maxLength: 2 })

  /** Generate a string that is too long (length 31+) using only valid chars */
  const tooLongName = fc.stringOf(validChar, { minLength: 31, maxLength: 60 })

  /** Generate a character NOT in [a-zA-Z0-9 -] */
  const invalidChar = fc.char().filter((c) => !/^[a-zA-Z0-9 -]$/.test(c))

  it('should accept any string with length 3-30 containing only letters, numbers, spaces, and hyphens', () => {
    fc.assert(
      fc.property(validDisplayName, (name) => {
        const result = validateDisplayName(name)
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      }),
      { numRuns: 200 }
    )
  })

  it('should reject any string with length less than 3', () => {
    fc.assert(
      fc.property(tooShortName, (name) => {
        const result = validateDisplayName(name)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }),
      { numRuns: 100 }
    )
  })

  it('should reject any string with length greater than 30', () => {
    fc.assert(
      fc.property(tooLongName, (name) => {
        const result = validateDisplayName(name)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }),
      { numRuns: 100 }
    )
  })

  it('should reject any string containing invalid characters regardless of length', () => {
    fc.assert(
      fc.property(
        // Build a string of valid length (3-30) but inject at least one invalid char
        fc.tuple(
          fc.stringOf(validChar, { minLength: 2, maxLength: 28 }),
          invalidChar,
          fc.stringOf(validChar, { minLength: 0, maxLength: 10 })
        ).map(([prefix, bad, suffix]) => (prefix + bad + suffix).slice(0, 30))
          .filter((s) => s.length >= 3 && s.length <= 30),
        (name) => {
          const result = validateDisplayName(name)
          expect(result.valid).toBe(false)
          expect(result.error).toBeDefined()
        }
      ),
      { numRuns: 200 }
    )
  })

  it('should accept strings at exact boundary lengths (3 and 30 chars)', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.stringOf(validChar, { minLength: 3, maxLength: 3 }),
          fc.stringOf(validChar, { minLength: 30, maxLength: 30 })
        ),
        (name) => {
          const result = validateDisplayName(name)
          expect(result.valid).toBe(true)
          expect(result.error).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})
