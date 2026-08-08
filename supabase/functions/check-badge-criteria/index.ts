/**
 * Supabase Edge Function: check-badge-criteria
 *
 * Triggered after point/action events to evaluate whether a user qualifies
 * for any new badges. Fetches user activity stats, checks each badge's
 * criteria_json against the user's profile, and awards any newly qualified
 * badges (inserts into user_badges, creates notification).
 *
 * Validates: Requirements 11.2
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BadgeCriteria {
  type:
    | 'sites_visited'
    | 'history_challenges'
    | 'service_hours'
    | 'env_challenges'
    | 'all_trails_in_district'
    | 'referrals_with_challenge'
    | 'culture_challenges'
    | 'total_points'
  threshold: number
}

interface UserActivityProfile {
  sitesVisited: number
  historyChallenges: number
  serviceHours: number
  envChallenges: number
  trailsCompleted: number
  totalTrails: number
  referralsWithChallenge: number
  cultureChallenges: number
  totalPoints: number
}

interface BadgeRow {
  id: string
  name: string
  criteria_json: BadgeCriteria[]
}

// ─── Badge Evaluation Logic ──────────────────────────────────────────────────

function evaluateBadgeCriteria(
  profile: UserActivityProfile,
  criteria: BadgeCriteria[]
): boolean {
  if (criteria.length === 0) {
    return false
  }

  return criteria.every((criterion) => {
    if (criterion.type === 'all_trails_in_district') {
      return profile.totalTrails > 0 && profile.trailsCompleted >= profile.totalTrails
    }

    const value = getProfileValue(profile, criterion.type)
    return value >= criterion.threshold
  })
}

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
      return profile.trailsCompleted
    case 'referrals_with_challenge':
      return profile.referralsWithChallenge
    case 'culture_challenges':
      return profile.cultureChallenges
    case 'total_points':
      return profile.totalPoints
  }
}

// ─── Edge Function Handler ───────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const { user_id } = await req.json()

    if (!user_id || typeof user_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'missing_user_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for DB operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ─── Step 1: Fetch user activity stats ─────────────────────────────────

    // Get user's total points and service hours from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('total_points, total_service_hours')
      .eq('id', user_id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'user_not_found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Count sites visited (QR scans)
    const { count: sitesVisited } = await supabase
      .from('qr_scans')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)

    // Count history-related challenges completed (approved submissions for history challenges)
    const { count: historyChallenges } = await supabase
      .from('submissions')
      .select('*, challenges!inner(heritage_site_id, heritage_sites!inner(trail_id, trails!inner(theme)))', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', user_id)
      .eq('status', 'approved')
      .ilike('challenges.heritage_sites.trails.theme', '%history%')

    // Count environment-themed challenges completed
    const { count: envChallenges } = await supabase
      .from('submissions')
      .select('*, challenges!inner(heritage_site_id, heritage_sites!inner(trail_id, trails!inner(theme)))', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', user_id)
      .eq('status', 'approved')
      .ilike('challenges.heritage_sites.trails.theme', '%environment%')

    // Count culture-related challenges completed
    const { count: cultureChallenges } = await supabase
      .from('submissions')
      .select('*, challenges!inner(heritage_site_id, heritage_sites!inner(trail_id, trails!inner(theme)))', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', user_id)
      .eq('status', 'approved')
      .ilike('challenges.heritage_sites.trails.theme', '%culture%')

    // Count total trails and completed trails in the user's district
    const { count: totalTrails } = await supabase
      .from('trails')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    // A trail is completed if all its heritage sites have been scanned
    // We fetch trails and check which ones the user has fully completed
    const { data: allTrails } = await supabase
      .from('trails')
      .select('id, site_count')
      .eq('is_active', true)

    let trailsCompleted = 0
    if (allTrails && allTrails.length > 0) {
      for (const trail of allTrails) {
        // Count sites in this trail that the user has scanned
        const { count: scannedSitesInTrail } = await supabase
          .from('qr_scans')
          .select('*, heritage_sites!inner(trail_id)', { count: 'exact', head: true })
          .eq('user_id', user_id)
          .eq('heritage_sites.trail_id', trail.id)

        if (scannedSitesInTrail && trail.site_count > 0 && scannedSitesInTrail >= trail.site_count) {
          trailsCompleted++
        }
      }
    }

    // Count referrals where the referred user completed at least 1 challenge
    const { data: referrals } = await supabase
      .from('referrals')
      .select('referred_user_id')
      .eq('referrer_id', user_id)
      .not('referred_user_id', 'is', null)

    let referralsWithChallenge = 0
    if (referrals && referrals.length > 0) {
      for (const referral of referrals) {
        if (referral.referred_user_id) {
          const { count: challengeCount } = await supabase
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', referral.referred_user_id)
            .eq('status', 'approved')

          if (challengeCount && challengeCount > 0) {
            referralsWithChallenge++
          }
        }
      }
    }

    // Build the user activity profile
    const activityProfile: UserActivityProfile = {
      sitesVisited: sitesVisited ?? 0,
      historyChallenges: historyChallenges ?? 0,
      serviceHours: Number(profile.total_service_hours) || 0,
      envChallenges: envChallenges ?? 0,
      trailsCompleted,
      totalTrails: totalTrails ?? 0,
      referralsWithChallenge,
      cultureChallenges: cultureChallenges ?? 0,
      totalPoints: profile.total_points ?? 0,
    }

    // ─── Step 2: Get all badges and user's existing badges ─────────────────

    const { data: allBadges, error: badgesError } = await supabase
      .from('badges')
      .select('id, name, criteria_json')

    if (badgesError || !allBadges) {
      return new Response(
        JSON.stringify({ error: 'failed_to_fetch_badges' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get already-earned badge IDs for this user
    const { data: earnedBadges } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', user_id)

    const earnedBadgeIds = new Set((earnedBadges ?? []).map((b) => b.badge_id))

    // ─── Step 3: Evaluate and award new badges ─────────────────────────────

    const newlyAwardedBadges: string[] = []

    for (const badge of allBadges as BadgeRow[]) {
      // Skip already-earned badges
      if (earnedBadgeIds.has(badge.id)) {
        continue
      }

      // Evaluate criteria
      const criteria = badge.criteria_json as BadgeCriteria[]
      if (!criteria || !Array.isArray(criteria)) {
        continue
      }

      const qualifies = evaluateBadgeCriteria(activityProfile, criteria)

      if (qualifies) {
        // Award the badge
        const { error: awardError } = await supabase
          .from('user_badges')
          .insert({
            user_id,
            badge_id: badge.id,
            earned_at: new Date().toISOString(),
          })

        if (awardError) {
          // Skip if duplicate (race condition)
          if (awardError.code === '23505') {
            continue
          }
          console.error(`Failed to award badge ${badge.name}:`, awardError)
          continue
        }

        // Create notification for the user
        await supabase
          .from('notifications')
          .insert({
            user_id,
            title: 'Badge Earned!',
            body: `Congratulations! You earned the "${badge.name}" badge.`,
            type: 'badge_earned',
            reference_id: badge.id,
          })

        newlyAwardedBadges.push(badge.name)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id,
        badges_awarded: newlyAwardedBadges,
        badges_awarded_count: newlyAwardedBadges.length,
        profile: activityProfile,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('check-badge-criteria error:', err)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
