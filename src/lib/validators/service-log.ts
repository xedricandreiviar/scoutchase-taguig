/**
 * Service log input validation.
 *
 * Validates: Requirements 10.2
 * - Description: 20-500 characters
 * - Duration: 0.5-24 hours in 0.5-hour increments
 * - Date performed: not in the future
 * - Photo proof: optional, JPEG/PNG, max 5MB
 */

export interface ServiceLogInput {
  description: string
  duration_hours: number
  date_performed: string // ISO date string (YYYY-MM-DD)
  mission_id: string
  photo_proof?: File | null
}

export interface ServiceLogValidationResult {
  valid: boolean
  errors: Record<string, string>
}

const MIN_DESCRIPTION_LENGTH = 20
const MAX_DESCRIPTION_LENGTH = 500
const MIN_DURATION = 0.5
const MAX_DURATION = 24
const DURATION_INCREMENT = 0.5
const MAX_PHOTO_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png']

/**
 * Validates a service log input object.
 * Returns a result indicating whether input is valid, along with field-level errors.
 */
export function validateServiceLog(input: ServiceLogInput): ServiceLogValidationResult {
  const errors: Record<string, string> = {}

  // Validate description
  if (!input.description || input.description.trim().length === 0) {
    errors.description = 'Description is required.'
  } else if (input.description.trim().length < MIN_DESCRIPTION_LENGTH) {
    errors.description = `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`
  } else if (input.description.trim().length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters.`
  }

  // Validate duration
  if (input.duration_hours === undefined || input.duration_hours === null) {
    errors.duration_hours = 'Duration is required.'
  } else if (typeof input.duration_hours !== 'number' || isNaN(input.duration_hours)) {
    errors.duration_hours = 'Duration must be a number.'
  } else if (input.duration_hours < MIN_DURATION) {
    errors.duration_hours = `Duration must be at least ${MIN_DURATION} hours.`
  } else if (input.duration_hours > MAX_DURATION) {
    errors.duration_hours = `Duration must not exceed ${MAX_DURATION} hours.`
  } else if (!isValidIncrement(input.duration_hours)) {
    errors.duration_hours = `Duration must be in ${DURATION_INCREMENT}-hour increments.`
  }

  // Validate date
  if (!input.date_performed) {
    errors.date_performed = 'Date performed is required.'
  } else {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(input.date_performed)) {
      errors.date_performed = 'Date must be in YYYY-MM-DD format.'
    } else {
      const parsed = new Date(input.date_performed + 'T00:00:00')
      if (isNaN(parsed.getTime())) {
        errors.date_performed = 'Date is not valid.'
      } else if (isFutureDate(input.date_performed)) {
        errors.date_performed = 'Date cannot be in the future.'
      }
    }
  }

  // Validate mission_id
  if (!input.mission_id || input.mission_id.trim().length === 0) {
    errors.mission_id = 'Service mission is required.'
  }

  // Validate optional photo proof
  if (input.photo_proof) {
    if (!ALLOWED_PHOTO_TYPES.includes(input.photo_proof.type)) {
      errors.photo_proof = 'Photo must be JPEG or PNG format.'
    } else if (input.photo_proof.size > MAX_PHOTO_SIZE) {
      errors.photo_proof = 'Photo must not exceed 5MB.'
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Checks whether a duration value is a valid 0.5-hour increment.
 */
function isValidIncrement(value: number): boolean {
  // Multiply by 2 and check it's an integer to handle floating-point precision
  const doubled = value * 2
  return Number.isInteger(doubled)
}

/**
 * Checks whether a date string (YYYY-MM-DD) is in the future relative to today.
 */
function isFutureDate(dateStr: string): boolean {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return dateStr > todayStr
}
