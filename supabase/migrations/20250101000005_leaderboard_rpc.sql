-- Leaderboard RPC: get_leaderboard(p_category, p_limit, p_offset)
-- Returns top entries per category with last_point_date derived from points_ledger.
-- Requirements: 11.4, 11.5, 21.7

CREATE OR REPLACE FUNCTION get_leaderboard(
  p_category TEXT DEFAULT 'individual',
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  full_name TEXT,
  school TEXT,
  troop_unit_number TEXT,
  total_points INTEGER,
  last_point_date TIMESTAMPTZ,
  is_minor BOOLEAN,
  category TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clamp limit to max 100
  IF p_limit > 100 THEN
    p_limit := 100;
  END IF;
  IF p_limit < 1 THEN
    p_limit := 1;
  END IF;
  IF p_offset < 0 THEN
    p_offset := 0;
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    COALESCE(p.display_name, p.full_name) AS display_name,
    CASE WHEN p.is_minor THEN NULL ELSE p.full_name END AS full_name,
    CASE WHEN p.is_minor THEN NULL ELSE p.school END AS school,
    CASE WHEN p.is_minor THEN NULL ELSE p.troop_unit_number END AS troop_unit_number,
    p.total_points,
    (SELECT MAX(pl.created_at) FROM points_ledger pl WHERE pl.user_id = p.id) AS last_point_date,
    p.is_minor,
    p_category AS category
  FROM profiles p
  WHERE
    p.total_points > 0
    AND (
      CASE p_category
        WHEN 'individual' THEN TRUE
        WHEN 'patrol_troop' THEN p.troop_unit_number IS NOT NULL
        WHEN 'school' THEN p.school IS NOT NULL
        WHEN 'rover_senior' THEN p.role IN ('Senior_Scout', 'Rover_Scout')
        ELSE TRUE
      END
    )
  ORDER BY
    p.total_points DESC,
    (SELECT MAX(pl.created_at) FROM points_ledger pl WHERE pl.user_id = p.id) ASC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Index to support efficient last_point_date lookups
CREATE INDEX IF NOT EXISTS idx_points_ledger_user_created
  ON points_ledger(user_id, created_at DESC);
