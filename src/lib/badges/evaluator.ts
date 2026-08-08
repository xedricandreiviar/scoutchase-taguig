/**
 * Badge criteria evaluation for ScoutChase Taguig.
 *
 * Evaluates a user's activity profile against badge criteria defined in criteria_json.
 * A badge is awarded if and only if ALL criteria in the badge's criteria_json are met.
 *
 * Validates: Requirements 11.2
 */

/**
 * Represents a user's aggregated activity stats used for badge evaluation.
 */
export interface UserActivityProfile {
  /** Number of heritage sites visited (QR scans) */
  sitesVisited: number
  /** Number of history-related challenges completed */
  historyChallenges: number
  /** Total verified service hours */
  serviceHours: number
  /** Number of environment-themed challenges completed */
  envChallenges: number
  /** Number of trails completed by the user */
  trailsCompleted: number
  /** Total number of trails in the user's district */
  totalTrails: number
  /** Number of referrals where the referred user completed at least 1 challenge */
  referralsWithChallenge: number
  /** Number of culture-related challenges completed */
  cultureChallenges: number
  /** Total accumulated points */
  totalPoints: number
}

/**
 * A single criterion from a badge's criteria_json.
 * Each criterion specifies a type (matching a field in UserActivityProfile)
 * and a threshold value that must be met or exceeded.
 */
export interface BadgeCriteria {
  /** The type of criterion, maps to a UserActivityProfile field */
  type:
    | 'sites_visited'
    | 'history_challenges'
    | 'service_hours'
    | 'env_challenges'
    | 'all_trails_in_district'
    | 'referrals_with_challenge'
    | 'culture_challenges'
    | 'total_points'
  /** The threshold value that must be met or exceeded */
  threshold: number
}

/**
 * Maps a BadgeCriteria type to the corresponding value in UserActivityProfile.
 */
function getProfileValue(profile: UserActivityProfile, criteriaType: BadgeCriteria['type']): number {
  switch (criteriaType) {
    case 'sites_visited':
      return profile.sitesVisited
    case 'history_challenges':
      return profile.historyChallenges
    case 'service_hours':
      return profile.serviceHours
    case 'env_challenges':
      return profile.envChallenges
    case 'all_trails_in_district':
      // For "all trails in district", the threshold is the total trails count.
      // The user meets this criterion if trailsCompleted >= totalTrails AND totalTrails > 0
      return profile.trailsCompleted
    case 'referrals_with_challenge':
      return profile.referralsWithChallenge
    case 'culture_challenges':
      return profile.cultureChallenges
    case 'total_points':
      return profile.totalPoints
  }
}

/**
 * Evaluates whether a user's activity profile meets ALL criteria in the badge's criteria_json.
 *
 * For the "all_trails_in_district" criterion type:
 * - The user must have completed trails >= threshold AND totalTrails must be > 0
 *   (to avoid awarding the badge when there are no trails)
 *
 * @param profile - The user's aggregated activity stats
 * @param criteria - Array of badge criteria from criteria_json
 * @returns true if and only if ALL criteria are met
 */
export function evaluateBadgeCriteria(
  profile: UserActivityProfile,
  criteria: BadgeCriteria[]
): boolean {
  if (criteria.length === 0) {
    return false
  }

  return criteria.every((criterion) => {
    if (criterion.type === 'all_trails_in_district') {
      // Special case: must have completed ALL trails and there must be at least 1 trail
      return profile.totalTrails > 0 && profile.trailsCompleted >= profile.totalTrails
    }

    const value = getProfileValue(profile, criterion.type)
    return value >= criterion.threshold
  })
}

/**
 * Badge definition as stored in the badges table.
 */
export interface BadgeDefinition {
  name: string
  description: string
  criteria: BadgeCriteria[]
}

/**
 * All badge definitions for ScoutChase Taguig.
 * These correspond to the criteria_json stored in the badges table.
 *
 * From Requirements 11.2:
 * - Heritage Explorer: visit 5 heritage sites
 * - History Detective: complete 3 history-related Challenges
 * - Community Volunteer: log 20 verified service hours
 * - Environmental Steward: complete 3 environment-themed Challenges
 * - Trail Conqueror: complete all Trails in a district
 * - Scout Ambassador: invite 5 users who each complete at least 1 Challenge
 * - Cultural Guardian: complete 5 culture-related Challenges
 * - ScoutChase Champion: accumulate 1000 total points
 */
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    name: 'Heritage Explorer',
    description: 'Visit 5 heritage sites',
    criteria: [{ type: 'sites_visited', threshold: 5 }],
  },
  {
    name: 'History Detective',
    description: 'Complete 3 history-related Challenges',
    criteria: [{ type: 'history_challenges', threshold: 3 }],
  },
  {
    name: 'Community Volunteer',
    description: 'Log 20 verified service hours',
    criteria: [{ type: 'service_hours', threshold: 20 }],
  },
  {
    name: 'Environmental Steward',
    description: 'Complete 3 environment-themed Challenges',
    criteria: [{ type: 'env_challenges', threshold: 3 }],
  },
  {
    name: 'Trail Conqueror',
    description: 'Complete all Trails in a district',
    criteria: [{ type: 'all_trails_in_district', threshold: 1 }],
  },
  {
    name: 'Scout Ambassador',
    description: 'Invite 5 users who each complete at least 1 Challenge',
    criteria: [{ type: 'referrals_with_challenge', threshold: 5 }],
  },
  {
    name: 'Cultural Guardian',
    description: 'Complete 5 culture-related Challenges',
    criteria: [{ type: 'culture_challenges', threshold: 5 }],
  },
  {
    name: 'ScoutChase Champion',
    description: 'Accumulate 1000 total points',
    criteria: [{ type: 'total_points', threshold: 1000 }],
  },
]
