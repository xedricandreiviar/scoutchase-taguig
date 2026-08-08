/**
 * Formats service hours for display on the Digital Passport.
 * Always shows exactly 1 decimal place as per Requirement 10.7.
 *
 * @param hours - Total service hours (number)
 * @returns Formatted string with exactly 1 decimal place (e.g., "12.5")
 */
export function formatServiceHours(hours: number | null | undefined): string {
  const value = hours ?? 0
  return value.toFixed(1)
}
