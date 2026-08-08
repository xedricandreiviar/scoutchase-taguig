/**
 * Group trail progress calculation utilities.
 *
 * Calculates aggregate group progress for group trail attempts.
 * Progress is based on the union of heritage sites unlocked by any group member.
 *
 * Validates: Requirements 17.4, 17.5
 */

export interface GroupProgressResult {
  /** Percentage of trail sites unlocked by at least one member (0-100) */
  progress: number
  /** True when every trail site has been unlocked by at least one member */
  isComplete: boolean
  /** Number of unique sites unlocked across all members */
  uniqueSitesUnlocked: number
}

/**
 * Calculates group trail progress from member unlock data.
 *
 * @param memberUnlocks - Array of arrays, where each inner array contains
 *   the site IDs unlocked by a single member
 * @param totalSites - Total number of heritage sites in the trail
 * @returns Group progress result with percentage, completion flag, and unique site count
 *
 * Edge cases:
 * - If totalSites is 0 or negative, returns 0 progress and not complete
 * - If memberUnlocks is empty, returns 0 progress
 * - Duplicate site IDs within a member's unlocks are deduplicated
 */
export function calculateGroupProgress(
  memberUnlocks: string[][],
  totalSites: number
): GroupProgressResult {
  if (totalSites <= 0) {
    return { progress: 0, isComplete: false, uniqueSitesUnlocked: 0 }
  }

  if (memberUnlocks.length === 0) {
    return { progress: 0, isComplete: false, uniqueSitesUnlocked: 0 }
  }

  // Calculate the union of all member unlocks
  const unionSet = new Set<string>()
  for (const unlocks of memberUnlocks) {
    for (const siteId of unlocks) {
      unionSet.add(siteId)
    }
  }

  const uniqueSitesUnlocked = Math.min(unionSet.size, totalSites)
  const progress = Math.round((uniqueSitesUnlocked / totalSites) * 100)
  const isComplete = uniqueSitesUnlocked >= totalSites

  return { progress, isComplete, uniqueSitesUnlocked }
}

/**
 * Calculates the number of sites unlocked by a specific member.
 *
 * @param memberSiteIds - Array of site IDs unlocked by this member
 * @returns Count of unique sites unlocked (deduplicates)
 */
export function getMemberUnlockCount(memberSiteIds: string[]): number {
  return new Set(memberSiteIds).size
}
