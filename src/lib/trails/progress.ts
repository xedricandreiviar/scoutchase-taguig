/**
 * Trail progress calculation utilities.
 *
 * Pure function for calculating trail completion percentage.
 * Validates: Requirements 8.2 (progress bar showing % unlocked)
 */

/**
 * Calculates the trail completion percentage.
 *
 * @param totalSites - Total number of heritage sites in the trail
 * @param unlockedSites - Number of sites the user has unlocked
 * @returns Percentage (0-100) of trail completion, rounded to nearest integer
 *
 * Edge cases:
 * - If totalSites is 0 or negative, returns 0
 * - If unlockedSites exceeds totalSites, caps at 100
 * - If unlockedSites is negative, treats as 0
 */
export function calculateTrailProgress(
  totalSites: number,
  unlockedSites: number
): number {
  if (totalSites <= 0) {
    return 0
  }

  const clamped = Math.max(0, Math.min(unlockedSites, totalSites))
  return Math.round((clamped / totalSites) * 100)
}

/**
 * Determines if a trail is complete (all sites unlocked).
 *
 * @param totalSites - Total number of heritage sites in the trail
 * @param unlockedSites - Number of sites the user has unlocked
 * @returns true if all sites are unlocked
 */
export function isTrailComplete(
  totalSites: number,
  unlockedSites: number
): boolean {
  if (totalSites <= 0) {
    return false
  }

  return unlockedSites >= totalSites
}
