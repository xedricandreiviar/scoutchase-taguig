/**
 * Group trail attempt size validation.
 *
 * Validates that a group trail attempt invites between 1 and 9 users,
 * for a maximum group size of 10 members including the leader.
 *
 * Validates: Requirements 17.1
 */

export interface GroupTrailValidationResult {
  valid: boolean
  error?: string
}

const MIN_INVITEES = 1
const MAX_INVITEES = 9
const MAX_GROUP_SIZE = 10

/**
 * Validates the number of invitees for a group trail attempt.
 *
 * @param inviteeCount - Number of users being invited (excluding the leader)
 * @returns Validation result with error message if invalid
 *
 * Rules:
 * - The leader is always included (counts as 1 member)
 * - Must invite between 1 and 9 other users
 * - Total group size (leader + invitees) cannot exceed 10
 */
export function validateGroupSize(inviteeCount: number): GroupTrailValidationResult {
  if (!Number.isInteger(inviteeCount)) {
    return {
      valid: false,
      error: 'Invitee count must be a whole number.',
    }
  }

  if (inviteeCount < MIN_INVITEES) {
    return {
      valid: false,
      error: `You must invite at least ${MIN_INVITEES} user to create a group trail attempt.`,
    }
  }

  if (inviteeCount > MAX_INVITEES) {
    return {
      valid: false,
      error: `A group trail attempt can have at most ${MAX_GROUP_SIZE} members including the leader. You can invite up to ${MAX_INVITEES} users.`,
    }
  }

  return { valid: true }
}
