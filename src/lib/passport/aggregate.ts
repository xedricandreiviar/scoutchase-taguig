/**
 * Passport data aggregation logic.
 * Pure function that takes raw query results and produces formatted passport stats.
 * Requirements: 4.1
 */

export interface VisitedSite {
  site_id: string
  site_name: string
  scanned_at: string
}

export interface CompletedChallenge {
  challenge_id: string
  challenge_name: string
  completed_at: string
  points_awarded: number
}

export interface ServiceHourEntry {
  log_id: string
  description: string
  duration_hours: number
  verified_at: string
}

export interface EarnedBadge {
  badge_id: string
  badge_name: string
  icon_url: string
  earned_at: string
}

export interface PointsLedgerEntry {
  id: string
  amount: number
  reason: string
  created_at: string
}

export interface RawPassportData {
  visited_sites: VisitedSite[]
  completed_challenges: CompletedChallenge[]
  service_hours: ServiceHourEntry[]
  earned_badges: EarnedBadge[]
  points_ledger: PointsLedgerEntry[]
  rank: number | null
}

export interface PassportStats {
  visitedSites: {
    count: number
    list: VisitedSite[]
  }
  completedChallenges: {
    count: number
    list: CompletedChallenge[]
  }
  serviceHours: {
    totalHours: number
    totalMinutes: number
    displayHours: number
    displayMinutes: number
    list: ServiceHourEntry[]
  }
  earnedBadges: {
    count: number
    list: EarnedBadge[]
  }
  totalPoints: number
  rank: number | null
}

/**
 * Aggregates raw passport data into formatted stats for display.
 * When no data exists, returns zero counts and empty lists (Req 4.1).
 */
export function aggregatePassportData(raw: RawPassportData): PassportStats {
  const visitedSites = raw.visited_sites ?? []
  const completedChallenges = raw.completed_challenges ?? []
  const serviceHours = raw.service_hours ?? []
  const earnedBadges = raw.earned_badges ?? []
  const pointsLedger = raw.points_ledger ?? []

  // Calculate total service hours from verified entries
  const totalHoursDecimal = serviceHours.reduce(
    (sum, entry) => sum + entry.duration_hours,
    0
  )
  const totalMinutesRaw = Math.round(totalHoursDecimal * 60)
  const displayHours = Math.floor(totalMinutesRaw / 60)
  const displayMinutes = totalMinutesRaw % 60

  // Calculate total points from the ledger
  const totalPoints = pointsLedger.reduce(
    (sum, entry) => sum + entry.amount,
    0
  )

  return {
    visitedSites: {
      count: visitedSites.length,
      list: visitedSites,
    },
    completedChallenges: {
      count: completedChallenges.length,
      list: completedChallenges,
    },
    serviceHours: {
      totalHours: totalHoursDecimal,
      totalMinutes: totalMinutesRaw,
      displayHours,
      displayMinutes,
      list: serviceHours,
    },
    earnedBadges: {
      count: earnedBadges.length,
      list: earnedBadges,
    },
    totalPoints,
    rank: raw.rank ?? null,
  }
}
