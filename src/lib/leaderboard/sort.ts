/**
 * Leaderboard sorting logic.
 *
 * Ranked by total points descending with ties broken by earlier date of last point earned.
 * Requirements: 11.4
 */

export interface LeaderboardEntry {
  user_id: string
  display_name: string
  full_name?: string | null
  school?: string | null
  troop_unit_number?: string | null
  total_points: number
  last_point_date: string | null
  is_minor: boolean
  category: LeaderboardCategory
  rank?: number
}

export type LeaderboardCategory =
  | 'individual'
  | 'patrol_troop'
  | 'school'
  | 'rover_senior'

/**
 * Sorts leaderboard entries by:
 * 1. Total points descending
 * 2. Tie-break: earlier last_point_date (the user who earned their last point earlier ranks higher)
 *
 * Returns a new sorted array with rank assigned (1-indexed).
 */
export function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    // Primary: descending by total_points
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points
    }

    // Tie-break: earlier last_point_date ranks higher
    // null dates sort to the end
    if (a.last_point_date === null && b.last_point_date === null) return 0
    if (a.last_point_date === null) return 1
    if (b.last_point_date === null) return -1

    const dateA = new Date(a.last_point_date).getTime()
    const dateB = new Date(b.last_point_date).getTime()

    return dateA - dateB
  })

  // Assign ranks (1-indexed)
  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }))
}
