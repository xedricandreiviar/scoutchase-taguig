-- ScoutChase Taguig: Trail Progress & Completion RPC Functions
-- Migration: Create get_trail_progress and complete_trail_check RPCs
-- Requirements: 8.2, 8.3

-- =============================================================================
-- RPC: get_trail_progress(p_user_id UUID, p_trail_id UUID)
-- Returns the user's progress on a specific trail: unlocked/total site counts,
-- completion percentage, and whether the trail is marked as completed.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_trail_progress(p_user_id UUID, p_trail_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_sites INTEGER;
  v_unlocked_sites INTEGER;
  v_is_completed BOOLEAN;
  v_percentage INTEGER;
BEGIN
  -- Count total active sites in the trail
  SELECT COUNT(*)
  INTO v_total_sites
  FROM heritage_sites
  WHERE trail_id = p_trail_id
    AND is_active = true;

  -- Count sites the user has unlocked in this trail
  SELECT COUNT(*)
  INTO v_unlocked_sites
  FROM qr_scans qs
  JOIN heritage_sites hs ON hs.id = qs.heritage_site_id
  WHERE qs.user_id = p_user_id
    AND hs.trail_id = p_trail_id
    AND hs.is_active = true;

  -- Calculate percentage (avoid division by zero)
  IF v_total_sites = 0 THEN
    v_percentage := 0;
  ELSE
    v_percentage := ROUND((v_unlocked_sites::NUMERIC / v_total_sites) * 100);
  END IF;

  -- Check if trail is completed
  v_is_completed := (v_total_sites > 0 AND v_unlocked_sites >= v_total_sites);

  RETURN json_build_object(
    'trail_id', p_trail_id,
    'total_sites', v_total_sites,
    'unlocked_sites', v_unlocked_sites,
    'percentage', v_percentage,
    'is_completed', v_is_completed
  );
END;
$$;

-- =============================================================================
-- RPC: complete_trail_check(p_user_id UUID, p_trail_id UUID)
-- Checks if the user has completed a trail. If completed and bonus not yet
-- awarded, awards 50-point trail completion bonus and records in points_ledger.
-- Returns whether the bonus was awarded.
-- Requirements: 8.3 (award 50-point bonus on trail completion)
-- =============================================================================

CREATE OR REPLACE FUNCTION complete_trail_check(p_user_id UUID, p_trail_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_sites INTEGER;
  v_unlocked_sites INTEGER;
  v_bonus_already_awarded BOOLEAN;
  v_bonus_points INTEGER := 50;
  v_bonus_awarded BOOLEAN := false;
BEGIN
  -- Count total active sites in the trail
  SELECT COUNT(*)
  INTO v_total_sites
  FROM heritage_sites
  WHERE trail_id = p_trail_id
    AND is_active = true;

  -- Count sites the user has unlocked in this trail
  SELECT COUNT(*)
  INTO v_unlocked_sites
  FROM qr_scans qs
  JOIN heritage_sites hs ON hs.id = qs.heritage_site_id
  WHERE qs.user_id = p_user_id
    AND hs.trail_id = p_trail_id
    AND hs.is_active = true;

  -- If not all sites unlocked, no bonus
  IF v_total_sites = 0 OR v_unlocked_sites < v_total_sites THEN
    RETURN json_build_object(
      'trail_id', p_trail_id,
      'is_completed', false,
      'bonus_awarded', false,
      'message', 'Trail not yet completed'
    );
  END IF;

  -- Check if bonus was already awarded for this trail
  SELECT EXISTS(
    SELECT 1 FROM points_ledger
    WHERE user_id = p_user_id
      AND reason = 'trail_complete'
      AND reference_id = p_trail_id
  )
  INTO v_bonus_already_awarded;

  IF v_bonus_already_awarded THEN
    RETURN json_build_object(
      'trail_id', p_trail_id,
      'is_completed', true,
      'bonus_awarded', false,
      'message', 'Trail already completed; bonus previously awarded'
    );
  END IF;

  -- Award the bonus points
  INSERT INTO points_ledger (user_id, amount, reason, reference_id)
  VALUES (p_user_id, v_bonus_points, 'trail_complete', p_trail_id);

  -- Update user total points
  UPDATE profiles
  SET total_points = total_points + v_bonus_points,
      updated_at = now()
  WHERE id = p_user_id;

  v_bonus_awarded := true;

  RETURN json_build_object(
    'trail_id', p_trail_id,
    'is_completed', true,
    'bonus_awarded', v_bonus_awarded,
    'bonus_points', v_bonus_points,
    'message', 'Trail completed! Bonus points awarded.'
  );
END;
$$;
