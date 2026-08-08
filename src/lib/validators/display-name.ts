/**
 * Display name validation logic.
 * Requirements 4.3, 4.4: 3-30 characters, letters/numbers/spaces/hyphens only.
 */

export interface DisplayNameValidationResult {
  valid: boolean
  error?: string
}

const DISPLAY_NAME_REGEX = /^[a-zA-Z0-9 -]+$/

export function validateDisplayName(name: string): DisplayNameValidationResult {
  if (!name || name.length === 0) {
    return { valid: false, error: 'Display name is required' }
  }

  if (name.length < 3) {
    return { valid: false, error: 'Display name must be at least 3 characters' }
  }

  if (name.length > 30) {
    return { valid: false, error: 'Display name must be at most 30 characters' }
  }

  if (!DISPLAY_NAME_REGEX.test(name)) {
    return {
      valid: false,
      error: 'Display name can only contain letters, numbers, spaces, and hyphens',
    }
  }

  return { valid: true }
}
