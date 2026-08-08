-- ScoutChase Taguig: Digital Passport RPC Function
-- Migration: Create get_user_passport RPC for aggregated passport data
-- Requirements: 4.1

-- =============================================================================
-- RPC: get_user_passport(p_user_id UUID)
-- Returns aggregated passport data: visited sites, completed challenges,
-- verified service hours, earned badges, points ledger, and leaderboard rank.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_passport(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  v_visited_sites JSON;
  v_completed_challenges JSON;
  v_service_hours JSON;
  v_earned_badges JSON;
  v_points_ledger JSON;
  v_rank INTEGER;
BEGIN
  -- Visited Heritage Sites (from qr_scans joined with heritage_sites)
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_visited_sites
  FROM (
    SELECT
      qs.heritage_site_id AS site_id,
      hs.name AS site_name,
      qs.scanned_at
    FROM qr_scans qs
    JOIN heritage_sites hs ON hs.id = qs.heritage_site_id
    WHERE qs.user_id = p_user_id
    ORDER BY qs.scanned_at DESC
  ) t;

  -- Completed Challenges (approved submissions)
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_completed_challenges
  FROM (
    SELECT
      s.challenge_id,
      c.title AS challenge_name,
      s.reviewed_at AS completed_at,
      s.points_awarded
    FROM submissions s
    JOIN challenges c ON c.id = s.challenge_id
    WHERE s.user_id = p_user_id
      AND s.status = 'approved'
    ORDER BY s.reviewed_at DESC
  ) t;

  -- Verified Service Hours
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_service_hours
  FROM (
    SELECT
      sl.id AS log_id,
      sl.description,
      sl.duration_hours,
      sl.verified_at
    FROM service_logs sl
    WHERE sl.user_id = p_user_id
      AND sl.status = 'verified'
    ORDER BY sl.verified_at DESC
  ) t;

  -- Earned Badges
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_earned_badges
  FROM (
    SELECT
      ub.badge_id,
      b.name AS badge_name,
      b.icon_url,
      ub.earned_at
    FROM user_badges ub
    JOIN badges b ON b.id = ub.badge_id
    WHERE ub.user_id = p_user_id
    ORDER BY ub.earned_at DESC
  ) t;

  -- Points Ledger
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_points_ledger
  FROM (
    SELECT
      pl.id,
      pl.amount,
      pl.reason,
      pl.created_at
    FROM points_ledger pl
    WHERE pl.user_id = p_user_id
    ORDER BY pl.created_at DESC
  ) t;

  -- Leaderboard Rank (numeric position based on total_points descending)
  SELECT rank_position
  INTO v_rank
  FROM (
    SELECT
      id,
      RANK() OVER (ORDER BY total_points DESC) AS rank_position
    FROM profiles
    WHERE total_points > 0
  ) ranked
  WHERE ranked.id = p_user_id;

  -- Assemble result
  result := json_build_object(
    'visited_sites', v_visited_sites,
    'completed_challenges', v_completed_challenges,
    'service_hours', v_service_hours,
    'earned_badges', v_earned_badges,
    'points_ledger', v_points_ledger,
    'rank', v_rank
  );

  RETURN result;
END;
$$;
