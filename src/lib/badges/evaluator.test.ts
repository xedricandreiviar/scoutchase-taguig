import { describe, it, expect } from 'vitest'
import {
  evaluateBadgeCriteria,
  BADGE_DEFINITIONS,
  type UserActivityProfile,
  type BadgeCriteria,
} from './evaluator'

function makeProfile(overrides: Partial<UserActivityProfile> = {}): UserActivityProfile {
  return {
    sitesVisited: 0,
    historyChallenges: 0,
    serviceHours: 0,
    envChallenges: 0,
    trailsCompleted: 0,
    totalTrails: 7,
    referralsWithChallenge: 0,
    cultureChallenges: 0,
    totalPoints: 0,
    ...overrides,
  }
}

describe('evaluateBadgeCriteria', () => {
  it('returns false for empty criteria array', () => {
    const profile = makeProfile({ sitesVisited: 100 })
    expect(evaluateBadgeCriteria(profile, [])).toBe(false)
  })

  it('returns true when single criterion is exactly met', () => {
    const profile = makeProfile({ sitesVisited: 5 })
    const criteria: BadgeCriteria[] = [{ type: 'sites_visited', threshold: 5 }]
    expect(evaluateBadgeCriteria(profile, criteria)).toBe(true)
  })

  it('returns true when single criterion is exceeded', () => {
    const profile = makeProfile({ sitesVisited: 10 })
    const criteria: BadgeCriteria[] = [{ type: 'sites_visited', threshold: 5 }]
    expect(evaluateBadgeCriteria(profile, criteria)).toBe(true)
  })

  it('returns false when single criterion is not met', () => {
    const profile = makeProfile({ sitesVisited: 4 })
    const criteria: BadgeCriteria[] = [{ type: 'sites_visited', threshold: 5 }]
    expect(evaluateBadgeCriteria(profile, criteria)).toBe(false)
  })

  it('returns true only when ALL criteria are met', () => {
    const profile = makeProfile({ sitesVisited: 5, totalPoints: 1000 })
    const criteria: BadgeCriteria[] = [
      { type: 'sites_visited', threshold: 5 },
      { type: 'total_points', threshold: 1000 },
    ]
    expect(evaluateBadgeCriteria(profile, criteria)).toBe(true)
  })

  it('returns false when only some criteria are met', () => {
    const profile = makeProfile({ sitesVisited: 5, totalPoints: 500 })
    const criteria: BadgeCriteria[] = [
      { type: 'sites_visited', threshold: 5 },
      { type: 'total_points', threshold: 1000 },
    ]
    expect(evaluateBadgeCriteria(profile, criteria)).toBe(false)
  })

  describe('all_trails_in_district special handling', () => {
    it('returns true when all trails are completed', () => {
      const profile = makeProfile({ trailsCompleted: 7, totalTrails: 7 })
      const criteria: BadgeCriteria[] = [{ type: 'all_trails_in_district', threshold: 1 }]
      expect(evaluateBadgeCriteria(profile, criteria)).toBe(true)
    })

    it('returns false when not all trails are completed', () => {
      const profile = makeProfile({ trailsCompleted: 5, totalTrails: 7 })
      const criteria: BadgeCriteria[] = [{ type: 'all_trails_in_district', threshold: 1 }]
      expect(evaluateBadgeCriteria(profile, criteria)).toBe(false)
    })

    it('returns false when totalTrails is 0 (no trails exist)', () => {
      const profile = makeProfile({ trailsCompleted: 0, totalTrails: 0 })
      const criteria: BadgeCriteria[] = [{ type: 'all_trails_in_district', threshold: 1 }]
      expect(evaluateBadgeCriteria(profile, criteria)).toBe(false)
    })
  })
})

describe('Badge definitions', () => {
  it('Heritage Explorer: awarded when 5 sites visited', () => {
    const badge = BADGE_DEFINITIONS.find((b) => b.name === 'Heritage Explorer')!
    expect(evaluateBadgeCriteria(makeProfile({ sitesVisited: 5 }), badge.criteria)).toBe(true)
    expect(evaluateBadgeCriteria(makeProfile({ sitesVisited: 4 }), badge.criteria)).toBe(false)
  })

  it('History Detective: awarded when 3 history challenges completed', () => {
    const badge = BADGE_DEFINITIONS.find((b) => b.name === 'History Detective')!
    expect(evaluateBadgeCriteria(makeProfile({ historyChallenges: 3 }), badge.criteria)).toBe(true)
    expect(evaluateBadgeCriteria(makeProfile({ historyChallenges: 2 }), badge.criteria)).toBe(false)
  })

  it('Community Volunteer: awarded when 20 service hours logged', () => {
    const badge = BADGE_DEFINITIONS.find((b) => b.name === 'Community Volunteer')!
    expect(evaluateBadgeCriteria(makeProfile({ serviceHours: 20 }), badge.criteria)).toBe(true)
    expect(evaluateBadgeCriteria(makeProfile({ serviceHours: 19.9 }), badge.criteria)).toBe(false)
  })

  it('Environmental Steward: awarded when 3 env challenges completed', () => {
    const badge = BADGE_DEFINITIONS.find((b) => b.name === 'Environmental Steward')!
    expect(evaluateBadgeCriteria(makeProfile({ envChallenges: 3 }), badge.criteria)).toBe(true)
    expect(evaluateBadgeCriteria(makeProfile({ envChallenges: 2 }), badge.criteria)).toBe(false)
  })

  it('Trail Conqueror: awarded when all trails in district completed', () => {
    const badge = BADGE_DEFINITIONS.find((b) => b.name === 'Trail Conqueror')!
    expect(
      evaluateBadgeCriteria(makeProfile({ trailsCompleted: 7, totalTrails: 7 }), badge.criteria)
    ).toBe(true)
    expect(
      evaluateBadgeCriteria(makeProfile({ trailsCompleted: 6, totalTrails: 7 }), badge.criteria)
    ).toBe(false)
  })

  it('Scout Ambassador: awarded when 5 referrals each with 1+ challenge', () => {
    const badge = BADGE_DEFINITIONS.find((b) => b.name === 'Scout Ambassador')!
    expect(
      evaluateBadgeCriteria(makeProfile({ referralsWithChallenge: 5 }), badge.criteria)
    ).toBe(true)
    expect(
      evaluateBadgeCriteria(makeProfile({ referralsWithChallenge: 4 }), badge.criteria)
    ).toBe(false)
  })

  it('Cultural Guardian: awarded when 5 culture challenges completed', () => {
    const badge = BADGE_DEFINITIONS.find((b) => b.name === 'Cultural Guardian')!
    expect(evaluateBadgeCriteria(makeProfile({ cultureChallenges: 5 }), badge.criteria)).toBe(true)
    expect(evaluateBadgeCriteria(makeProfile({ cultureChallenges: 4 }), badge.criteria)).toBe(false)
  })

  it('ScoutChase Champion: awarded when 1000 total points accumulated', () => {
    const badge = BADGE_DEFINITIONS.find((b) => b.name === 'ScoutChase Champion')!
    expect(evaluateBadgeCriteria(makeProfile({ totalPoints: 1000 }), badge.criteria)).toBe(true)
    expect(evaluateBadgeCriteria(makeProfile({ totalPoints: 999 }), badge.criteria)).toBe(false)
  })

  it('contains exactly 8 badge definitions', () => {
    expect(BADGE_DEFINITIONS).toHaveLength(8)
  })

  it('each badge has a name, description, and non-empty criteria', () => {
    for (const badge of BADGE_DEFINITIONS) {
      expect(badge.name).toBeTruthy()
      expect(badge.description).toBeTruthy()
      expect(badge.criteria.length).toBeGreaterThan(0)
    }
  })
})
