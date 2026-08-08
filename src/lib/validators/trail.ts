/**
 * Trail site count validation.
 *
 * Validates that a trail has between 2 and 30 sites assigned.
 * Validates: Requirements 8.4 (admin can assign 2-30 sites per trail)
 * Validates: Requirements 8.5 (reject trail with fewer than 2 sites)
 */

export interface TrailValidationResult {
  valid: boolean
  error?: string
}

const MIN_TRAIL_SITES = 2
const MAX_TRAIL_SITES = 30

/**
 * Validates the number of sites assigned to a trail.
 *
 * @param count - Number of heritage sites assigned to the trail
 * @returns Validation result with error message if invalid
 */
export function validateTrailSiteCount(count: number): TrailValidationResult {
  if (!Number.isInteger(count)) {
    return {
      valid: false,
      error: 'Site count must be a whole number.',
    }
  }

  if (count < MIN_TRAIL_SITES) {
    return {
      valid: false,
      error: `A trail must have at least ${MIN_TRAIL_SITES} heritage sites assigned.`,
    }
  }

  if (count > MAX_TRAIL_SITES) {
    return {
      valid: false,
      error: `A trail cannot have more than ${MAX_TRAIL_SITES} heritage sites.`,
    }
  }

  return { valid: true }
}
