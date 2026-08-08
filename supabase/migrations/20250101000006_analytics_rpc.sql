-- Analytics RPC: get_analytics_summary(p_start_date, p_end_date)
-- Returns aggregated platform metrics for the admin analytics dashboard.
-- Requirements: 15.1, 15.2, 15.4

CREATE OR REPLACE FUNCTION get_analytics_summary(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  v_total_participants BIGINT;
  v_participants_by_role JSON;
  v_active_sites BIGINT;
  v_total_qr_scans BIGINT;
  v_daily_scans JSON;
  v_weekly_scans JSON;
  v_completed_challenges BIGINT;
  v_pending_reviews BIGINT;
  v_verified_service_hours NUMERIC;
  v_weekly_signups JSON;
  v_cumulative_signups BIGINT;
  v_retention_rate NUMERIC;
  v_partner_count BIGINT;
  v_satisfaction_rating NUMERIC;
BEGIN
  -- Validate date range (max 365 days)
  IF p_end_date - p_start_date > 365 THEN
    RAISE EXCEPTION 'Date range cannot exceed 365 days';
  END IF;

  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Start date must be before or equal to end date';
  END IF;

  -- Total registered participants
  SELECT COUNT(*) INTO v_total_participants
  FROM profiles
  WHERE created_at::DATE <= p_end_date;

  -- Participants segmented by role
  SELECT json_object_agg(role, cnt) INTO v_participants_by_role
  FROM (
    SELECT role::TEXT, COUNT(*) AS cnt
    FROM profiles
    WHERE created_at::DATE <= p_end_date
    GROUP BY role
  ) sub;

  -- Active heritage sites
  SELECT COUNT(*) INTO v_active_sites
  FROM heritage_sites
  WHERE is_active = true;

  -- Total QR scans in date range
  SELECT COUNT(*) INTO v_total_qr_scans
  FROM qr_scans
  WHERE scanned_at::DATE BETWEEN p_start_date AND p_end_date;

  -- Daily QR scans (last 30 days within range, or full range if shorter)
  SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.scan_date), '[]'::JSON)
  INTO v_daily_scans
  FROM (
    SELECT scanned_at::DATE AS scan_date, COUNT(*) AS scan_count
    FROM qr_scans
    WHERE scanned_at::DATE BETWEEN GREATEST(p_start_date, p_end_date - 30) AND p_end_date
    GROUP BY scanned_at::DATE
    ORDER BY scanned_at::DATE
  ) sub;

  -- Weekly QR scans
  SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.week_start), '[]'::JSON)
  INTO v_weekly_scans
  FROM (
    SELECT DATE_TRUNC('week', scanned_at)::DATE AS week_start, COUNT(*) AS scan_count
    FROM qr_scans
    WHERE scanned_at::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY DATE_TRUNC('week', scanned_at)::DATE
    ORDER BY DATE_TRUNC('week', scanned_at)::DATE
  ) sub;

  -- Completed challenges (approved submissions) in date range
  SELECT COUNT(*) INTO v_completed_challenges
  FROM submissions
  WHERE status = 'approved'
    AND reviewed_at::DATE BETWEEN p_start_date AND p_end_date;

  -- Pending review items (submissions + service logs)
  SELECT (
    (SELECT COUNT(*) FROM submissions WHERE status = 'pending')
    +
    (SELECT COUNT(*) FROM service_logs WHERE status = 'pending_verification')
  ) INTO v_pending_reviews;

  -- Total verified service hours in date range
  SELECT COALESCE(SUM(duration_hours), 0) INTO v_verified_service_hours
  FROM service_logs
  WHERE status = 'verified'
    AND verified_at::DATE BETWEEN p_start_date AND p_end_date;

  -- Weekly sign-ups
  SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.week_start), '[]'::JSON)
  INTO v_weekly_signups
  FROM (
    SELECT DATE_TRUNC('week', created_at)::DATE AS week_start, COUNT(*) AS signup_count
    FROM profiles
    WHERE created_at::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY DATE_TRUNC('week', created_at)::DATE
    ORDER BY DATE_TRUNC('week', created_at)::DATE
  ) sub;

  -- Cumulative sign-ups (total up to end_date)
  SELECT COUNT(*) INTO v_cumulative_signups
  FROM profiles
  WHERE created_at::DATE <= p_end_date;

  -- Retention rate: % of users active in the last 30 days (had at least one scan, submission, or service log)
  SELECT CASE
    WHEN v_total_participants = 0 THEN 0
    ELSE ROUND(
      (SELECT COUNT(DISTINCT active_user)::NUMERIC FROM (
        SELECT user_id AS active_user FROM qr_scans WHERE scanned_at >= (p_end_date - INTERVAL '30 days')
        UNION
        SELECT user_id AS active_user FROM submissions WHERE created_at >= (p_end_date - INTERVAL '30 days')
        UNION
        SELECT user_id AS active_user FROM service_logs WHERE created_at >= (p_end_date - INTERVAL '30 days')
      ) active_users
      ) / v_total_participants * 100, 1
    )
  END INTO v_retention_rate;

  -- Partner organization count
  SELECT COUNT(*) INTO v_partner_count
  FROM partners
  WHERE is_active = true;

  -- Average satisfaction rating (placeholder: derived from challenge completion rate)
  -- In a real system this would come from a feedback/survey table.
  -- Using avg points per active user as a proxy metric (0-5 scale normalized).
  SELECT CASE
    WHEN v_total_participants = 0 THEN 0
    ELSE LEAST(5.0, ROUND(
      (SELECT COALESCE(AVG(total_points), 0) FROM profiles WHERE total_points > 0) / 200.0, 1
    ))
  END INTO v_satisfaction_rating;

  -- Build result JSON
  result := json_build_object(
    'total_participants', v_total_participants,
    'participants_by_role', COALESCE(v_participants_by_role, '{}'::JSON),
    'active_sites', v_active_sites,
    'total_qr_scans', v_total_qr_scans,
    'daily_scans', v_daily_scans,
    'weekly_scans', v_weekly_scans,
    'completed_challenges', v_completed_challenges,
    'pending_reviews', v_pending_reviews,
    'verified_service_hours', v_verified_service_hours,
    'weekly_signups', v_weekly_signups,
    'cumulative_signups', v_cumulative_signups,
    'retention_rate', v_retention_rate,
    'partner_count', v_partner_count,
    'satisfaction_rating', v_satisfaction_rating
  );

  RETURN result;
END;
$$;
