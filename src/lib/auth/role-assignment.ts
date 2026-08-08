/**
 * Role assignment logic for the registration flow.
 * Derives a UserRole from the scout section and troop/unit number provided during registration.
 */

export type UserRole =
  | 'Guest'
  | 'Cub_Scout'
  | 'Boy_Scout'
  | 'Senior_Scout'
  | 'Rover_Scout'
  | 'Adult_Leader'
  | 'Council_Admin'

export interface RoleAssignmentResult {
  role: UserRole
  message?: string
}

const SECTION_TO_ROLE: Record<string, UserRole> = {
  'Cub Scout': 'Cub_Scout',
  'Boy Scout': 'Boy_Scout',
  'Senior Scout': 'Senior_Scout',
  'Rover Scout': 'Rover_Scout',
}

/**
 * Assigns a role based on the scout section selected and whether a troop/unit number was provided.
 *
 * Rules:
 * - "Not a Scout yet" → Guest
 * - "Adult Leader" → Adult_Leader (no troop required)
 * - Scout section (Cub/Boy/Senior/Rover) + valid troop → corresponding scout role
 * - Scout section without troop → Guest with a message indicating troop is required for full access
 */
export function assignRole(section: string, troopUnitNumber?: string): RoleAssignmentResult {
  // "Not a Scout yet" always maps to Guest
  if (section === 'Not a Scout yet') {
    return { role: 'Guest' }
  }

  // "Adult Leader" maps directly without needing a troop
  if (section === 'Adult Leader') {
    return { role: 'Adult_Leader' }
  }

  // Scout sections require a troop/unit number for full role assignment
  const scoutRole = SECTION_TO_ROLE[section]

  if (scoutRole) {
    const hasTroop = troopUnitNumber != null && troopUnitNumber.trim().length > 0

    if (hasTroop) {
      return { role: scoutRole }
    }

    return {
      role: 'Guest',
      message: 'A troop/unit number is required for full Scout access. You have been assigned Guest access until your troop is verified.',
    }
  }

  // Unknown section defaults to Guest
  return { role: 'Guest' }
}

/**
 * Determines whether a guardian email is required based on age.
 * Returns true if the user is under 12 years old.
 */
export function requiresGuardianEmail(age: number): boolean {
  return age < 12
}
