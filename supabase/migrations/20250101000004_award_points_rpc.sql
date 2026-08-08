-- Award points RPC: atomically inserts a points_ledger record and updates the profile total.
-- This ensures the ledger and profile.total_points stay consistent.

CREATE OR REPLACE FUNCTION award_points(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_ref_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ledger_id UUID;
BEGIN
  -- Validate inputs
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Point amount must be positive, got %', p_amount;
  END IF;

  IF p_reason IS NULL OR p_reason = '' THEN
    RAISE EXCEPTION 'Reason is required for point awards';
  END IF;

  -- Insert ledger entry
  INSERT INTO points_ledger (user_id, amount, reason, reference_id)
  VALUES (p_user_id, p_amount, p_reason, p_ref_id)
  RETURNING id INTO v_ledger_id;

  -- Atomically update profile total points
  UPDATE profiles
  SET total_points = total_points + p_amount,
      updated_at = now()
  WHERE id = p_user_id;

  -- Verify the profile was updated (user exists)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for id %', p_user_id;
  END IF;

  RETURN v_ledger_id;
END;
$$;

-- Grant execute permission to authenticated users (RLS on points_ledger still applies for reads)
GRANT EXECUTE ON FUNCTION award_points(UUID, INTEGER, TEXT, UUID) TO authenticated;
