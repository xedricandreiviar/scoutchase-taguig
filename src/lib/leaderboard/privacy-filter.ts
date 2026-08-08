/**
 * Privacy filter for leaderboard entries.
 *
 * For users where is_minor = true, only display_name is revealed.
 * PII fields (full_name, school, troop_unit_number) are redacted.
 *
 * Requirements: 21.7
 */

import type { LeaderboardEntry } from './sort'

/**
 * Applies privacy protection for minors.
 * Entries for is_minor=true will have PII fields cleared —
 * only display_name, total_points, last_point_date, category, rank, and user_id are preserved.
 */
export function applyPrivacyFilter(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.map((entry) => {
    if (!entry.is_minor) {
      return entry
    }

    return {
      ...entry,
      full_name: null,
      school: null,
      troop_unit_number: null,
    }
  })
}
