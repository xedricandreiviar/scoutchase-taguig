/**
 * Rover Scout moderation scope.
 *
 * Determines whether a Rover_Scout can moderate a submission based on the
 * author's role. Rover_Scout is restricted to moderating only Cub_Scout
 * and Boy_Scout submissions.
 *
 * Validates: Requirements 18.3, 18.4
 * Property 24: Rover Scout moderation scope
 */

import type { UserRole } from '@/stores/auth'

/** Roles that a Rover_Scout is allowed to moderate */
const MODERATABLE_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'Cub_Scout',
  'Boy_Scout',
])

/**
 * Returns whether a Rover_Scout can moderate a submission from the given author role.
 *
 * @param authorRole - The role of the submission's author
 * @returns true if the author is Cub_Scout or Boy_Scout, false otherwise
 */
export function canRoverModerate(authorRole: UserRole): boolean {
  return MODERATABLE_ROLES.has(authorRole)
}
