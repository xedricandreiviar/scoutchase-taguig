/**
 * Registration form validation logic.
 * Pure functions that can be tested independently of React or Supabase.
 */

export const SCOUT_SECTIONS = [
  'Cub Scout',
  'Boy Scout',
  'Senior Scout',
  'Rover Scout',
  'Adult Leader',
  'Not a Scout yet',
] as const

export type ScoutSection = (typeof SCOUT_SECTIONS)[number]

export interface RegistrationInput {
  full_name: string
  email: string
  password: string
  age: number | string
  scout_section: string
  troop_unit_number?: string
  school?: string
  guardian_email?: string
}

export interface RegistrationErrors {
  full_name?: string
  email?: string
  password?: string
  age?: string
  scout_section?: string
  troop_unit_number?: string
  guardian_email?: string
}

export interface ValidationResult {
  valid: boolean
  errors: RegistrationErrors
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TROOP_UNIT_REGEX = /^[a-zA-Z0-9]{1,20}$/

export function validateRegistration(input: RegistrationInput): ValidationResult {
  const errors: RegistrationErrors = {}

  // Full name: required, 2-100 characters
  if (!input.full_name || input.full_name.trim().length === 0) {
    errors.full_name = 'Full name is required'
  } else if (input.full_name.trim().length < 2) {
    errors.full_name = 'Full name must be at least 2 characters'
  } else if (input.full_name.trim().length > 100) {
    errors.full_name = 'Full name must be at most 100 characters'
  }

  // Email: required, valid format
  if (!input.email || input.email.trim().length === 0) {
    errors.email = 'Email is required'
  } else if (!EMAIL_REGEX.test(input.email.trim())) {
    errors.email = 'Please enter a valid email address'
  }

  // Password: required, minimum 8 characters
  if (!input.password || input.password.length === 0) {
    errors.password = 'Password is required'
  } else if (input.password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }

  // Age: required, integer 7-99
  const ageRaw = input.age
  const ageNum = typeof ageRaw === 'string' ? Number(ageRaw) : ageRaw
  if (ageRaw === '' || ageRaw === undefined || ageRaw === null) {
    errors.age = 'Age is required'
  } else if (isNaN(ageNum) || !Number.isInteger(ageNum)) {
    errors.age = 'Age must be a whole number'
  } else if (ageNum < 7) {
    errors.age = 'Age must be at least 7'
  } else if (ageNum > 99) {
    errors.age = 'Age must be at most 99'
  }

  // Scout section: required, must be one of allowed values
  if (!input.scout_section || input.scout_section.trim().length === 0) {
    errors.scout_section = 'Scout section selection is required'
  } else if (!SCOUT_SECTIONS.includes(input.scout_section as ScoutSection)) {
    errors.scout_section = 'Please select a valid scout section'
  }

  // Troop/unit number: optional, but if provided must match pattern
  if (input.troop_unit_number && input.troop_unit_number.trim().length > 0) {
    if (!TROOP_UNIT_REGEX.test(input.troop_unit_number.trim())) {
      errors.troop_unit_number =
        'Troop/unit number must be alphanumeric and up to 20 characters'
    }
  }

  // Guardian email: required if age < 12
  if (!isNaN(ageNum) && Number.isInteger(ageNum) && ageNum >= 7 && ageNum < 12) {
    if (!input.guardian_email || input.guardian_email.trim().length === 0) {
      errors.guardian_email = 'Guardian email is required for users under 12'
    } else if (!EMAIL_REGEX.test(input.guardian_email.trim())) {
      errors.guardian_email = 'Please enter a valid guardian email address'
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}
