import { describe, it, expect } from 'vitest'
import { validateRegistration, type RegistrationInput } from './registration'

function validInput(overrides?: Partial<RegistrationInput>): RegistrationInput {
  return {
    full_name: 'Juan Dela Cruz',
    email: 'juan@example.com',
    password: 'password123',
    age: 15,
    scout_section: 'Boy Scout',
    troop_unit_number: 'Troop42',
    school: 'Taguig National High School',
    guardian_email: '',
    ...overrides,
  }
}

describe('validateRegistration', () => {
  it('accepts valid input with all fields', () => {
    const result = validateRegistration(validInput())
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('accepts valid input without optional fields', () => {
    const result = validateRegistration(
      validInput({ troop_unit_number: '', school: '' })
    )
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  // Full name validation
  describe('full_name', () => {
    it('rejects empty full name', () => {
      const result = validateRegistration(validInput({ full_name: '' }))
      expect(result.valid).toBe(false)
      expect(result.errors.full_name).toBeDefined()
    })

    it('rejects name shorter than 2 characters', () => {
      const result = validateRegistration(validInput({ full_name: 'A' }))
      expect(result.valid).toBe(false)
      expect(result.errors.full_name).toContain('at least 2')
    })

    it('rejects name longer than 100 characters', () => {
      const result = validateRegistration(
        validInput({ full_name: 'A'.repeat(101) })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.full_name).toContain('at most 100')
    })

    it('accepts name with exactly 2 characters', () => {
      const result = validateRegistration(validInput({ full_name: 'Jo' }))
      expect(result.valid).toBe(true)
    })

    it('accepts name with exactly 100 characters', () => {
      const result = validateRegistration(
        validInput({ full_name: 'A'.repeat(100) })
      )
      expect(result.valid).toBe(true)
    })
  })

  // Email validation
  describe('email', () => {
    it('rejects empty email', () => {
      const result = validateRegistration(validInput({ email: '' }))
      expect(result.valid).toBe(false)
      expect(result.errors.email).toBeDefined()
    })

    it('rejects invalid email format', () => {
      const result = validateRegistration(validInput({ email: 'not-an-email' }))
      expect(result.valid).toBe(false)
      expect(result.errors.email).toContain('valid email')
    })
  })

  // Password validation
  describe('password', () => {
    it('rejects empty password', () => {
      const result = validateRegistration(validInput({ password: '' }))
      expect(result.valid).toBe(false)
      expect(result.errors.password).toBeDefined()
    })

    it('rejects password shorter than 8 characters', () => {
      const result = validateRegistration(validInput({ password: 'short' }))
      expect(result.valid).toBe(false)
      expect(result.errors.password).toContain('at least 8')
    })

    it('accepts password with exactly 8 characters', () => {
      const result = validateRegistration(validInput({ password: '12345678' }))
      expect(result.valid).toBe(true)
    })
  })

  // Age validation
  describe('age', () => {
    it('rejects empty age', () => {
      const result = validateRegistration(validInput({ age: '' }))
      expect(result.valid).toBe(false)
      expect(result.errors.age).toBeDefined()
    })

    it('rejects age below 7', () => {
      const result = validateRegistration(validInput({ age: 6 }))
      expect(result.valid).toBe(false)
      expect(result.errors.age).toContain('at least 7')
    })

    it('rejects age above 99', () => {
      const result = validateRegistration(validInput({ age: 100 }))
      expect(result.valid).toBe(false)
      expect(result.errors.age).toContain('at most 99')
    })

    it('accepts age 7', () => {
      const result = validateRegistration(
        validInput({ age: 7, guardian_email: 'guardian@example.com' })
      )
      expect(result.valid).toBe(true)
    })

    it('accepts age 99', () => {
      const result = validateRegistration(validInput({ age: 99 }))
      expect(result.valid).toBe(true)
    })

    it('rejects non-integer age', () => {
      const result = validateRegistration(validInput({ age: '15.5' }))
      expect(result.valid).toBe(false)
      expect(result.errors.age).toContain('whole number')
    })

    it('handles string age correctly', () => {
      const result = validateRegistration(validInput({ age: '20' }))
      expect(result.valid).toBe(true)
    })
  })

  // Scout section validation
  describe('scout_section', () => {
    it('rejects empty section', () => {
      const result = validateRegistration(validInput({ scout_section: '' }))
      expect(result.valid).toBe(false)
      expect(result.errors.scout_section).toBeDefined()
    })

    it('rejects invalid section', () => {
      const result = validateRegistration(
        validInput({ scout_section: 'Invalid Section' })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.scout_section).toContain('valid scout section')
    })

    it('accepts all valid sections', () => {
      const sections = [
        'Cub Scout',
        'Boy Scout',
        'Senior Scout',
        'Rover Scout',
        'Adult Leader',
        'Not a Scout yet',
      ]
      for (const section of sections) {
        const result = validateRegistration(validInput({ scout_section: section }))
        expect(result.valid).toBe(true)
      }
    })
  })

  // Troop/unit number validation
  describe('troop_unit_number', () => {
    it('accepts empty troop number (optional)', () => {
      const result = validateRegistration(validInput({ troop_unit_number: '' }))
      expect(result.valid).toBe(true)
    })

    it('rejects troop number with special characters', () => {
      const result = validateRegistration(
        validInput({ troop_unit_number: 'Troop-42!' })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.troop_unit_number).toBeDefined()
    })

    it('rejects troop number longer than 20 characters', () => {
      const result = validateRegistration(
        validInput({ troop_unit_number: 'A'.repeat(21) })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.troop_unit_number).toBeDefined()
    })

    it('accepts valid alphanumeric troop number', () => {
      const result = validateRegistration(
        validInput({ troop_unit_number: 'Troop42ABC' })
      )
      expect(result.valid).toBe(true)
    })

    it('accepts troop number with exactly 20 characters', () => {
      const result = validateRegistration(
        validInput({ troop_unit_number: 'A'.repeat(20) })
      )
      expect(result.valid).toBe(true)
    })
  })

  // Guardian email validation
  describe('guardian_email', () => {
    it('requires guardian email when age < 12', () => {
      const result = validateRegistration(
        validInput({ age: 10, guardian_email: '' })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.guardian_email).toContain('required')
    })

    it('rejects invalid guardian email format', () => {
      const result = validateRegistration(
        validInput({ age: 10, guardian_email: 'not-valid' })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.guardian_email).toContain('valid guardian email')
    })

    it('accepts valid guardian email when age < 12', () => {
      const result = validateRegistration(
        validInput({ age: 10, guardian_email: 'parent@example.com' })
      )
      expect(result.valid).toBe(true)
    })

    it('does not require guardian email when age >= 12', () => {
      const result = validateRegistration(
        validInput({ age: 12, guardian_email: '' })
      )
      expect(result.valid).toBe(true)
    })

    it('does not require guardian email when age is 11 (boundary)', () => {
      const result = validateRegistration(
        validInput({ age: 11, guardian_email: 'guardian@example.com' })
      )
      expect(result.valid).toBe(true)
    })

    it('requires guardian email at age 11', () => {
      const result = validateRegistration(
        validInput({ age: 11, guardian_email: '' })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.guardian_email).toContain('required')
    })
  })

  // Multiple errors
  it('returns all errors for multiple invalid fields', () => {
    const result = validateRegistration({
      full_name: '',
      email: '',
      password: '',
      age: '',
      scout_section: '',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.full_name).toBeDefined()
    expect(result.errors.email).toBeDefined()
    expect(result.errors.password).toBeDefined()
    expect(result.errors.age).toBeDefined()
    expect(result.errors.scout_section).toBeDefined()
  })
})
