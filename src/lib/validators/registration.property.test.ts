import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateRegistration, SCOUT_SECTIONS, type RegistrationInput } from './registration'

/**
 * Property 1: Registration input validation
 *
 * For any registration input with a full name, age, scout section, and optional troop/unit number,
 * the validation function SHALL accept the input if and only if the name is between 2 and 100
 * characters, age is between 7 and 99, section is one of the allowed values, and if a troop/unit
 * number is provided it matches `^[a-zA-Z0-9]{1,20}$`.
 *
 * **Validates: Requirements 1.1**
 */
describe('Property 1: Registration input validation', () => {
  // --- Generators ---

  /** Generate a valid full name (2-100 non-whitespace-only characters) */
  const validName = fc.stringOf(fc.char(), { minLength: 2, maxLength: 100 }).filter(
    (s) => s.trim().length >= 2 && s.trim().length <= 100
  )

  /** Generate an invalid name: too short (0-1 trimmed chars) */
  const tooShortName = fc.stringOf(fc.char(), { minLength: 0, maxLength: 10 }).filter(
    (s) => s.trim().length < 2
  )

  /** Generate an invalid name: too long (>100 trimmed chars) */
  const tooLongName = fc
    .stringOf(
      fc.oneof(fc.hexa(), fc.constant('a')),
      { minLength: 101, maxLength: 200 }
    )

  /** Generate a valid age (integer 7-99) */
  const validAge = fc.integer({ min: 7, max: 99 })

  /** Generate an invalid age: too young (<7) or too old (>99) */
  const invalidAge = fc.oneof(
    fc.integer({ min: -100, max: 6 }),
    fc.integer({ min: 100, max: 999 })
  )

  /** Generate a valid scout section */
  const validSection = fc.constantFrom(...SCOUT_SECTIONS)

  /** Generate an invalid scout section */
  const invalidSection = fc
    .string({ minLength: 1, maxLength: 50 })
    .filter((s) => !(SCOUT_SECTIONS as readonly string[]).includes(s))

  /** Generate a valid troop/unit number: alphanumeric, 1-20 chars */
  const validTroopNumber = fc.stringOf(
    fc.oneof(
      fc.integer({ min: 0x30, max: 0x39 }).map((c) => String.fromCharCode(c)), // 0-9
      fc.integer({ min: 0x41, max: 0x5a }).map((c) => String.fromCharCode(c)), // A-Z
      fc.integer({ min: 0x61, max: 0x7a }).map((c) => String.fromCharCode(c))  // a-z
    ),
    { minLength: 1, maxLength: 20 }
  )

  /** Alphanumeric char generator */
  const alphanumChar = fc.oneof(
    fc.integer({ min: 0x30, max: 0x39 }).map((c) => String.fromCharCode(c)), // 0-9
    fc.integer({ min: 0x41, max: 0x5a }).map((c) => String.fromCharCode(c)), // A-Z
    fc.integer({ min: 0x61, max: 0x7a }).map((c) => String.fromCharCode(c))  // a-z
  )

  /** Generate an invalid troop/unit number (contains special chars or >20 chars) */
  const invalidTroopNumber = fc.oneof(
    // Contains special characters
    fc.string({ minLength: 1, maxLength: 20 }).filter(
      (s) => s.trim().length > 0 && !/^[a-zA-Z0-9]{1,20}$/.test(s.trim())
    ),
    // Too long (>20 alphanumeric chars)
    fc.stringOf(alphanumChar, { minLength: 21, maxLength: 30 })
  )

  /** Generate a valid email (satisfies basic email regex) */
  const validEmail = fc
    .tuple(
      fc.stringOf(alphanumChar, { minLength: 1, maxLength: 10 }),
      fc.stringOf(alphanumChar, { minLength: 1, maxLength: 10 }),
      fc.stringOf(alphanumChar, { minLength: 2, maxLength: 5 })
    )
    .map(([local, domain, tld]) => `${local}@${domain}.${tld}`)

  /** Generate a valid password (8+ chars) */
  const validPassword = fc.string({ minLength: 8, maxLength: 50 })

  /** Helper to create a fully valid base input */
  const validBaseInput = (overrides: Partial<RegistrationInput> = {}): fc.Arbitrary<RegistrationInput> =>
    fc.record({
      full_name: fc.constant(overrides.full_name ?? undefined).chain((v) => v !== undefined ? fc.constant(v) : validName),
      email: fc.constant(overrides.email ?? undefined).chain((v) => v !== undefined ? fc.constant(v) : validEmail),
      password: fc.constant(overrides.password ?? undefined).chain((v) => v !== undefined ? fc.constant(v) : validPassword),
      age: fc.constant(overrides.age ?? undefined).chain((v) => v !== undefined ? fc.constant(v) : validAge.map((a) => a >= 12 ? a : 12)),
      scout_section: fc.constant(overrides.scout_section ?? undefined).chain((v) => v !== undefined ? fc.constant(v) : validSection),
      troop_unit_number: fc.constant(overrides.troop_unit_number ?? undefined).chain((v) => v !== undefined ? fc.constant(v) : fc.constant(undefined)),
      guardian_email: fc.constant(overrides.guardian_email ?? undefined).chain((v) => v !== undefined ? fc.constant(v) : fc.constant(undefined)),
    }) as unknown as fc.Arbitrary<RegistrationInput>

  it('should accept any input where name is 2-100 chars, age 7-99, section valid, and troop number valid or absent', () => {
    fc.assert(
      fc.property(
        validName,
        validAge,
        validSection,
        fc.option(validTroopNumber, { nil: undefined }),
        validEmail,
        validPassword,
        fc.option(validEmail, { nil: undefined }),
        (name, age, section, troopNumber, email, password, guardianEmail) => {
          const input: RegistrationInput = {
            full_name: name,
            age,
            scout_section: section,
            troop_unit_number: troopNumber,
            email,
            password,
            guardian_email: age < 12 ? (guardianEmail ?? email) : guardianEmail,
          }

          const result = validateRegistration(input)

          // Should not have errors for name, age, section, or troop fields
          expect(result.errors.full_name).toBeUndefined()
          expect(result.errors.age).toBeUndefined()
          expect(result.errors.scout_section).toBeUndefined()
          expect(result.errors.troop_unit_number).toBeUndefined()
        }
      ),
      { numRuns: 200 }
    )
  })

  it('should reject any input with name shorter than 2 characters (trimmed)', () => {
    fc.assert(
      fc.property(
        tooShortName,
        validAge.filter((a) => a >= 12),
        validSection,
        validEmail,
        validPassword,
        (name, age, section, email, password) => {
          const input: RegistrationInput = {
            full_name: name,
            age,
            scout_section: section,
            email,
            password,
          }

          const result = validateRegistration(input)
          expect(result.valid).toBe(false)
          expect(result.errors.full_name).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject any input with name longer than 100 characters (trimmed)', () => {
    fc.assert(
      fc.property(
        tooLongName,
        validAge.filter((a) => a >= 12),
        validSection,
        validEmail,
        validPassword,
        (name, age, section, email, password) => {
          const input: RegistrationInput = {
            full_name: name,
            age,
            scout_section: section,
            email,
            password,
          }

          const result = validateRegistration(input)
          expect(result.valid).toBe(false)
          expect(result.errors.full_name).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject any input with age outside 7-99 range', () => {
    fc.assert(
      fc.property(
        validName,
        invalidAge,
        validSection,
        validEmail,
        validPassword,
        (name, age, section, email, password) => {
          const input: RegistrationInput = {
            full_name: name,
            age,
            scout_section: section,
            email,
            password,
          }

          const result = validateRegistration(input)
          expect(result.errors.age).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject any input with an invalid scout section', () => {
    fc.assert(
      fc.property(
        validName,
        validAge.filter((a) => a >= 12),
        invalidSection,
        validEmail,
        validPassword,
        (name, age, section, email, password) => {
          const input: RegistrationInput = {
            full_name: name,
            age,
            scout_section: section,
            email,
            password,
          }

          const result = validateRegistration(input)
          expect(result.valid).toBe(false)
          expect(result.errors.scout_section).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject any input with an invalid troop/unit number format', () => {
    fc.assert(
      fc.property(
        validName,
        validAge.filter((a) => a >= 12),
        validSection,
        invalidTroopNumber,
        validEmail,
        validPassword,
        (name, age, section, troopNumber, email, password) => {
          const input: RegistrationInput = {
            full_name: name,
            age,
            scout_section: section,
            troop_unit_number: troopNumber,
            email,
            password,
          }

          const result = validateRegistration(input)
          expect(result.valid).toBe(false)
          expect(result.errors.troop_unit_number).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should accept troop/unit number when absent (undefined or empty)', () => {
    fc.assert(
      fc.property(
        validName,
        validAge.filter((a) => a >= 12),
        validSection,
        validEmail,
        validPassword,
        (name, age, section, email, password) => {
          const input: RegistrationInput = {
            full_name: name,
            age,
            scout_section: section,
            troop_unit_number: undefined,
            email,
            password,
          }

          const result = validateRegistration(input)
          expect(result.errors.troop_unit_number).toBeUndefined()
        }
      ),
      { numRuns: 50 }
    )
  })

  // Boundary value tests
  it('should accept name at exact boundary lengths (2 and 100 chars)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('ab', 'a'.repeat(100)),
        validAge.filter((a) => a >= 12),
        validSection,
        validEmail,
        validPassword,
        (name, age, section, email, password) => {
          const input: RegistrationInput = {
            full_name: name,
            age,
            scout_section: section,
            email,
            password,
          }

          const result = validateRegistration(input)
          expect(result.errors.full_name).toBeUndefined()
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should accept age at exact boundary values (7 and 99)', () => {
    fc.assert(
      fc.property(
        validName,
        fc.constantFrom(7, 99),
        validSection,
        validEmail,
        validPassword,
        fc.option(validEmail, { nil: undefined }),
        (name, age, section, email, password, guardianEmail) => {
          const input: RegistrationInput = {
            full_name: name,
            age,
            scout_section: section,
            email,
            password,
            // age 7 requires guardian email
            guardian_email: age < 12 ? (guardianEmail ?? email) : guardianEmail,
          }

          const result = validateRegistration(input)
          expect(result.errors.age).toBeUndefined()
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should accept troop/unit number at exact max length (20 alphanumeric chars)', () => {
    fc.assert(
      fc.property(
        validName,
        validAge.filter((a) => a >= 12),
        validSection,
        fc.stringOf(alphanumChar, { minLength: 20, maxLength: 20 }),
        validEmail,
        validPassword,
        (name, age, section, troopNumber, email, password) => {
          const input: RegistrationInput = {
            full_name: name,
            age,
            scout_section: section,
            troop_unit_number: troopNumber,
            email,
            password,
          }

          const result = validateRegistration(input)
          expect(result.errors.troop_unit_number).toBeUndefined()
        }
      ),
      { numRuns: 50 }
    )
  })
})
