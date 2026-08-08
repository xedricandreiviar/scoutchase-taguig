import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateServiceLog, ServiceLogInput } from './service-log'

/**
 * Property 14: Service log input validation
 *
 * For any service log input, the validator SHALL accept if and only if description is
 * between 20 and 500 characters, duration is between 0.5 and 24 hours in 0.5-hour increments,
 * date_performed is not in the future, and if a photo is provided it passes file upload
 * validation rules (JPEG/PNG, max 5MB).
 *
 * **Validates: Requirements 10.2**
 */
describe('Property 14: Service log input validation', () => {
  // --- Helpers ---

  /** Get today's date in YYYY-MM-DD format */
  function getTodayStr(): string {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  }

  /** Generate a past or today date string in YYYY-MM-DD format */
  const pastOrTodayDate = fc
    .integer({ min: 1, max: 3650 }) // up to ~10 years in the past
    .map((daysAgo) => {
      const d = new Date()
      d.setDate(d.getDate() - daysAgo)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })

  /** Today's date as a constant */
  const todayDate = fc.constant(getTodayStr())

  /** Valid non-future date: either past or today */
  const validDate = fc.oneof(pastOrTodayDate, todayDate)

  /** Future date (at least 1 day ahead) */
  const futureDate = fc.integer({ min: 1, max: 365 }).map((daysAhead) => {
    const d = new Date()
    d.setDate(d.getDate() + daysAhead)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  // --- Description generators ---

  /** Valid description: 20-500 characters (non-whitespace-only) */
  const validDescription = fc
    .stringOf(fc.char().filter((c) => c.trim().length > 0 || c === ' '), {
      minLength: 20,
      maxLength: 500,
    })
    .filter((s) => s.trim().length >= 20 && s.trim().length <= 500)

  /** Description too short: less than 20 chars after trim */
  const tooShortDescription = fc
    .stringOf(fc.char().filter((c) => c.trim().length > 0), {
      minLength: 1,
      maxLength: 19,
    })

  /** Description too long: more than 500 chars after trim */
  const tooLongDescription = fc
    .stringOf(fc.char().filter((c) => c.trim().length > 0), {
      minLength: 501,
      maxLength: 600,
    })

  // --- Duration generators ---

  /** Valid duration: 0.5 to 24 in 0.5 increments */
  const validDuration = fc.integer({ min: 1, max: 48 }).map((n) => n * 0.5)

  /** Duration not in 0.5 increments (e.g., 1.3, 2.7) */
  const invalidIncrementDuration = fc
    .double({ min: 0.5, max: 24, noNaN: true })
    .filter((d) => !Number.isInteger(d * 2))

  /** Duration out of range: too low */
  const tooLowDuration = fc.double({ min: 0.01, max: 0.49, noNaN: true })

  /** Duration out of range: too high */
  const tooHighDuration = fc.double({ min: 24.01, max: 100, noNaN: true })

  // --- Mission ID generator ---
  const validMissionId = fc.uuid()

  // --- Valid input generator (all constraints met) ---
  const validServiceLogInput: fc.Arbitrary<ServiceLogInput> = fc.record({
    description: validDescription,
    duration_hours: validDuration,
    date_performed: validDate,
    mission_id: validMissionId,
  })

  // --- Tests ---

  it('should accept valid inputs where all constraints are met', () => {
    fc.assert(
      fc.property(validServiceLogInput, (input) => {
        const result = validateServiceLog(input)
        expect(result.valid).toBe(true)
        expect(Object.keys(result.errors)).toHaveLength(0)
      }),
      { numRuns: 200 }
    )
  })

  it('should reject descriptions shorter than 20 characters', () => {
    fc.assert(
      fc.property(
        tooShortDescription,
        validDuration,
        validDate,
        validMissionId,
        (description, duration_hours, date_performed, mission_id) => {
          const result = validateServiceLog({
            description,
            duration_hours,
            date_performed,
            mission_id,
          })
          expect(result.valid).toBe(false)
          expect(result.errors.description).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject descriptions longer than 500 characters', () => {
    fc.assert(
      fc.property(
        tooLongDescription,
        validDuration,
        validDate,
        validMissionId,
        (description, duration_hours, date_performed, mission_id) => {
          const result = validateServiceLog({
            description,
            duration_hours,
            date_performed,
            mission_id,
          })
          expect(result.valid).toBe(false)
          expect(result.errors.description).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject durations not in 0.5-hour increments', () => {
    fc.assert(
      fc.property(
        validDescription,
        invalidIncrementDuration,
        validDate,
        validMissionId,
        (description, duration_hours, date_performed, mission_id) => {
          const result = validateServiceLog({
            description,
            duration_hours,
            date_performed,
            mission_id,
          })
          expect(result.valid).toBe(false)
          expect(result.errors.duration_hours).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject durations below 0.5 hours', () => {
    fc.assert(
      fc.property(
        validDescription,
        tooLowDuration,
        validDate,
        validMissionId,
        (description, duration_hours, date_performed, mission_id) => {
          const result = validateServiceLog({
            description,
            duration_hours,
            date_performed,
            mission_id,
          })
          expect(result.valid).toBe(false)
          expect(result.errors.duration_hours).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject durations above 24 hours', () => {
    fc.assert(
      fc.property(
        validDescription,
        tooHighDuration,
        validDate,
        validMissionId,
        (description, duration_hours, date_performed, mission_id) => {
          const result = validateServiceLog({
            description,
            duration_hours,
            date_performed,
            mission_id,
          })
          expect(result.valid).toBe(false)
          expect(result.errors.duration_hours).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject dates in the future', () => {
    fc.assert(
      fc.property(
        validDescription,
        validDuration,
        futureDate,
        validMissionId,
        (description, duration_hours, date_performed, mission_id) => {
          const result = validateServiceLog({
            description,
            duration_hours,
            date_performed,
            mission_id,
          })
          expect(result.valid).toBe(false)
          expect(result.errors.date_performed).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})
