import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { assignRole, requiresGuardianEmail } from './role-assignment'

/**
 * Property 2: Role assignment from registration
 *
 * For any registration with a scout section selection and optional troop/unit number,
 * the assigned role SHALL be:
 * (a) the corresponding scout role if the section is a scout section AND a valid troop/unit number is provided,
 * (b) `Adult_Leader` if "Adult Leader" is selected,
 * (c) `Guest` if "Not a Scout yet" is selected, or
 * (d) `Guest` if a scout section is selected but no troop/unit number is provided.
 * Additionally, for any age < 12, guardian_email SHALL be required.
 *
 * **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6**
 */
describe('Property 2: Role assignment from registration', () => {
  // --- Constants ---
  const SCOUT_SECTIONS = ['Cub Scout', 'Boy Scout', 'Senior Scout', 'Rover Scout'] as const
  const SECTION_TO_ROLE: Record<string, string> = {
    'Cub Scout': 'Cub_Scout',
    'Boy Scout': 'Boy_Scout',
    'Senior Scout': 'Senior_Scout',
    'Rover Scout': 'Rover_Scout',
  }

  // --- Generators ---

  /** Alphanumeric character generator */
  const alphanumChar = fc.oneof(
    fc.integer({ min: 0x30, max: 0x39 }).map((c) => String.fromCharCode(c)), // 0-9
    fc.integer({ min: 0x41, max: 0x5a }).map((c) => String.fromCharCode(c)), // A-Z
    fc.integer({ min: 0x61, max: 0x7a }).map((c) => String.fromCharCode(c))  // a-z
  )

  /** Generate a valid troop/unit number: alphanumeric, 1-20 chars */
  const validTroopNumber = fc.stringOf(alphanumChar, { minLength: 1, maxLength: 20 })

  /** Generate an empty/whitespace-only troop number (treated as no troop) */
  const emptyTroopNumber = fc.oneof(
    fc.constant(''),
    fc.constant('   '),
    fc.constant('\t'),
    fc.constant('  \t  ')
  )

  /** Generate a valid scout section */
  const scoutSection = fc.constantFrom(...SCOUT_SECTIONS)

  /** Generate an arbitrary section string (valid or invalid) */
  const arbitrarySection = fc.oneof(
    scoutSection,
    fc.constant('Not a Scout yet'),
    fc.constant('Adult Leader'),
    fc.string({ minLength: 1, maxLength: 30 }).filter(
      (s) => !SCOUT_SECTIONS.includes(s as typeof SCOUT_SECTIONS[number]) &&
             s !== 'Not a Scout yet' &&
             s !== 'Adult Leader'
    )
  )

  /** Generate a valid age (7-99) */
  const validAge = fc.integer({ min: 7, max: 99 })

  // --- Property Tests ---

  it('(a) scout section + valid troop → corresponding scout role', () => {
    fc.assert(
      fc.property(
        scoutSection,
        validTroopNumber,
        (section, troop) => {
          const result = assignRole(section, troop)
          expect(result.role).toBe(SECTION_TO_ROLE[section])
          expect(result.message).toBeUndefined()
        }
      ),
      { numRuns: 200 }
    )
  })

  it('(b) "Adult Leader" → Adult_Leader regardless of troop', () => {
    fc.assert(
      fc.property(
        fc.option(validTroopNumber, { nil: undefined }),
        (troop) => {
          const result = assignRole('Adult Leader', troop)
          expect(result.role).toBe('Adult_Leader')
          expect(result.message).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('(c) "Not a Scout yet" → Guest regardless of troop', () => {
    fc.assert(
      fc.property(
        fc.option(validTroopNumber, { nil: undefined }),
        (troop) => {
          const result = assignRole('Not a Scout yet', troop)
          expect(result.role).toBe('Guest')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('(d) scout section + no troop (undefined/empty/whitespace) → Guest with message', () => {
    fc.assert(
      fc.property(
        scoutSection,
        fc.oneof(fc.constant(undefined), emptyTroopNumber),
        (section, troop) => {
          const result = assignRole(section, troop)
          expect(result.role).toBe('Guest')
          expect(result.message).toBeDefined()
          expect(result.message).toContain('troop/unit number is required')
        }
      ),
      { numRuns: 200 }
    )
  })

  it('unknown/invalid sections → Guest', () => {
    const invalidSection = fc.string({ minLength: 1, maxLength: 30 }).filter(
      (s) => !SCOUT_SECTIONS.includes(s as typeof SCOUT_SECTIONS[number]) &&
             s !== 'Not a Scout yet' &&
             s !== 'Adult Leader'
    )

    fc.assert(
      fc.property(
        invalidSection,
        fc.option(validTroopNumber, { nil: undefined }),
        (section, troop) => {
          const result = assignRole(section, troop)
          expect(result.role).toBe('Guest')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('role assignment is deterministic: same inputs always produce same output', () => {
    fc.assert(
      fc.property(
        arbitrarySection,
        fc.option(validTroopNumber, { nil: undefined }),
        (section, troop) => {
          const result1 = assignRole(section, troop)
          const result2 = assignRole(section, troop)
          expect(result1.role).toBe(result2.role)
          expect(result1.message).toBe(result2.message)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('guardian email is required for any age < 12, not required for age >= 12', () => {
    fc.assert(
      fc.property(
        validAge,
        (age) => {
          const required = requiresGuardianEmail(age)
          if (age < 12) {
            expect(required).toBe(true)
          } else {
            expect(required).toBe(false)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('guardian requirement boundary: age 11 requires, age 12 does not', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(11, 12),
        (age) => {
          const required = requiresGuardianEmail(age)
          expect(required).toBe(age < 12)
        }
      ),
      { numRuns: 20 }
    )
  })
})
