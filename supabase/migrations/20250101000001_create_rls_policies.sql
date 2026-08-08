-- ScoutChase Taguig: Row Level Security (RLS) Policies
-- Migration: Enable RLS and create role-based access policies for all tables
-- Requirements: 3.1, 3.9, 21.2, 21.5

-- =============================================================================
-- HELPER FUNCTION: Get current user's role from their profile
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: Get current user's troop/unit number
CREATE OR REPLACE FUNCTION get_user_troop()
RETURNS TEXT AS $$
  SELECT troop_unit_number FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE heritage_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_trail_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_trail_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PROFILES TABLE POLICIES
-- Users can read/update own profile; Council_Admin can read/update all
-- =============================================================================

-- Users can read their own profile
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT
  USING (id = auth.uid());

-- Council_Admin can read all profiles
CREATE POLICY profiles_select_admin ON profiles
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Users can insert their own profile (during registration)
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Council_Admin can update any profile (role assignment, account management)
CREATE POLICY profiles_update_admin ON profiles
  FOR UPDATE
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can delete profiles (account deactivation)
CREATE POLICY profiles_delete_admin ON profiles
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- HERITAGE_SITES TABLE POLICIES
-- All authenticated can read active sites; Council_Admin can CRUD
-- =============================================================================

-- All authenticated users can read active heritage sites
CREATE POLICY heritage_sites_select_active ON heritage_sites
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- Council_Admin can read all heritage sites (including inactive)
CREATE POLICY heritage_sites_select_admin ON heritage_sites
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can insert heritage sites
CREATE POLICY heritage_sites_insert_admin ON heritage_sites
  FOR INSERT
  WITH CHECK (get_user_role() = 'Council_Admin');

-- Council_Admin can update heritage sites
CREATE POLICY heritage_sites_update_admin ON heritage_sites
  FOR UPDATE
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can delete heritage sites
CREATE POLICY heritage_sites_delete_admin ON heritage_sites
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- TRAILS TABLE POLICIES
-- All authenticated can read active trails; Council_Admin can CRUD
-- =============================================================================

-- All authenticated users can read active trails
CREATE POLICY trails_select_active ON trails
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- Council_Admin can read all trails (including inactive)
CREATE POLICY trails_select_admin ON trails
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can insert trails
CREATE POLICY trails_insert_admin ON trails
  FOR INSERT
  WITH CHECK (get_user_role() = 'Council_Admin');

-- Council_Admin can update trails
CREATE POLICY trails_update_admin ON trails
  FOR UPDATE
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can delete trails
CREATE POLICY trails_delete_admin ON trails
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- CHALLENGES TABLE POLICIES
-- All authenticated can read; Council_Admin can CRUD
-- =============================================================================

-- All authenticated users can read challenges
CREATE POLICY challenges_select_authenticated ON challenges
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Council_Admin can insert challenges
CREATE POLICY challenges_insert_admin ON challenges
  FOR INSERT
  WITH CHECK (get_user_role() = 'Council_Admin');

-- Council_Admin can update challenges
CREATE POLICY challenges_update_admin ON challenges
  FOR UPDATE
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can delete challenges
CREATE POLICY challenges_delete_admin ON challenges
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- SUBMISSIONS TABLE POLICIES
-- Users can read/create own; reviewer roles can read assigned; Council_Admin all
-- =============================================================================

-- Users can read their own submissions
CREATE POLICY submissions_select_own ON submissions
  FOR SELECT
  USING (user_id = auth.uid());

-- Rover_Scout can read submissions from Cub_Scout and Boy_Scout users (review queue)
CREATE POLICY submissions_select_rover_reviewer ON submissions
  FOR SELECT
  USING (
    get_user_role() = 'Rover_Scout'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = submissions.user_id
      AND profiles.role IN ('Cub_Scout', 'Boy_Scout')
    )
  );

-- Adult_Leader can read submissions from users in same troop/unit
CREATE POLICY submissions_select_adult_leader ON submissions
  FOR SELECT
  USING (
    get_user_role() = 'Adult_Leader'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = submissions.user_id
      AND profiles.troop_unit_number = get_user_troop()
      AND profiles.troop_unit_number IS NOT NULL
    )
  );

-- Council_Admin can read all submissions
CREATE POLICY submissions_select_admin ON submissions
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Users can create their own submissions
CREATE POLICY submissions_insert_own ON submissions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Rover_Scout can update submissions they review (approve/reject Cub/Boy Scout submissions)
CREATE POLICY submissions_update_rover_reviewer ON submissions
  FOR UPDATE
  USING (
    get_user_role() = 'Rover_Scout'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = submissions.user_id
      AND profiles.role IN ('Cub_Scout', 'Boy_Scout')
    )
  );

-- Adult_Leader can update submissions for users in same troop/unit
CREATE POLICY submissions_update_adult_leader ON submissions
  FOR UPDATE
  USING (
    get_user_role() = 'Adult_Leader'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = submissions.user_id
      AND profiles.troop_unit_number = get_user_troop()
      AND profiles.troop_unit_number IS NOT NULL
    )
  );

-- Council_Admin can update all submissions
CREATE POLICY submissions_update_admin ON submissions
  FOR UPDATE
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can delete submissions
CREATE POLICY submissions_delete_admin ON submissions
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- SERVICE_MISSIONS TABLE POLICIES
-- All authenticated can read; Council_Admin can CRUD
-- =============================================================================

-- All authenticated users can read active service missions
CREATE POLICY service_missions_select_authenticated ON service_missions
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- Council_Admin can read all service missions (including inactive)
CREATE POLICY service_missions_select_admin ON service_missions
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can insert service missions
CREATE POLICY service_missions_insert_admin ON service_missions
  FOR INSERT
  WITH CHECK (get_user_role() = 'Council_Admin');

-- Council_Admin can update service missions
CREATE POLICY service_missions_update_admin ON service_missions
  FOR UPDATE
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can delete service missions
CREATE POLICY service_missions_delete_admin ON service_missions
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- SERVICE_LOGS TABLE POLICIES
-- Users can read/create own; Adult_Leader can read for own troop; Council_Admin all
-- =============================================================================

-- Users can read their own service logs
CREATE POLICY service_logs_select_own ON service_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Adult_Leader can read service logs for users in same troop/unit
CREATE POLICY service_logs_select_adult_leader ON service_logs
  FOR SELECT
  USING (
    get_user_role() = 'Adult_Leader'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = service_logs.user_id
      AND profiles.troop_unit_number = get_user_troop()
      AND profiles.troop_unit_number IS NOT NULL
    )
  );

-- Council_Admin can read all service logs
CREATE POLICY service_logs_select_admin ON service_logs
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Users can create their own service logs
CREATE POLICY service_logs_insert_own ON service_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Adult_Leader can update service logs for users in same troop/unit (verify/reject)
CREATE POLICY service_logs_update_adult_leader ON service_logs
  FOR UPDATE
  USING (
    get_user_role() = 'Adult_Leader'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = service_logs.user_id
      AND profiles.troop_unit_number = get_user_troop()
      AND profiles.troop_unit_number IS NOT NULL
    )
  );

-- Council_Admin can update all service logs
CREATE POLICY service_logs_update_admin ON service_logs
  FOR UPDATE
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can delete service logs
CREATE POLICY service_logs_delete_admin ON service_logs
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- BADGES TABLE POLICIES
-- All authenticated can read; Council_Admin can manage
-- =============================================================================

-- All authenticated users can read badges
CREATE POLICY badges_select_authenticated ON badges
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Council_Admin can insert badges
CREATE POLICY badges_insert_admin ON badges
  FOR INSERT
  WITH CHECK (get_user_role() = 'Council_Admin');

-- Council_Admin can update badges
CREATE POLICY badges_update_admin ON badges
  FOR UPDATE
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can delete badges
CREATE POLICY badges_delete_admin ON badges
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- USER_BADGES TABLE POLICIES
-- All authenticated can read; Council_Admin can manage
-- =============================================================================

-- All authenticated users can read user_badges (for leaderboard/profile visibility)
CREATE POLICY user_badges_select_authenticated ON user_badges
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Council_Admin can insert user_badges (manual awarding)
CREATE POLICY user_badges_insert_admin ON user_badges
  FOR INSERT
  WITH CHECK (get_user_role() = 'Council_Admin');

-- Council_Admin can delete user_badges
CREATE POLICY user_badges_delete_admin ON user_badges
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- POINTS_LEDGER TABLE POLICIES
-- Users can read own entries; Council_Admin all
-- =============================================================================

-- Users can read their own points ledger entries
CREATE POLICY points_ledger_select_own ON points_ledger
  FOR SELECT
  USING (user_id = auth.uid());

-- Council_Admin can read all points ledger entries
CREATE POLICY points_ledger_select_admin ON points_ledger
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can insert points ledger entries
CREATE POLICY points_ledger_insert_admin ON points_ledger
  FOR INSERT
  WITH CHECK (get_user_role() = 'Council_Admin');

-- Council_Admin can delete points ledger entries
CREATE POLICY points_ledger_delete_admin ON points_ledger
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- PARTNERS TABLE POLICIES
-- Public read (all authenticated); Council_Admin can CRUD
-- =============================================================================

-- All authenticated users can read active partners
CREATE POLICY partners_select_active ON partners
  FOR SELECT
  USING (is_active = true);

-- Council_Admin can read all partners (including inactive)
CREATE POLICY partners_select_admin ON partners
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can insert partners
CREATE POLICY partners_insert_admin ON partners
  FOR INSERT
  WITH CHECK (get_user_role() = 'Council_Admin');

-- Council_Admin can update partners
CREATE POLICY partners_update_admin ON partners
  FOR UPDATE
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can delete partners
CREATE POLICY partners_delete_admin ON partners
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- ANNOUNCEMENTS TABLE POLICIES
-- Authenticated can read published; Council_Admin can CRUD
-- =============================================================================

-- Authenticated users can read published announcements
CREATE POLICY announcements_select_published ON announcements
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_published = true);

-- Council_Admin can read all announcements (including drafts)
CREATE POLICY announcements_select_admin ON announcements
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can insert announcements
CREATE POLICY announcements_insert_admin ON announcements
  FOR INSERT
  WITH CHECK (get_user_role() = 'Council_Admin');

-- Council_Admin can update announcements
CREATE POLICY announcements_update_admin ON announcements
  FOR UPDATE
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can delete announcements
CREATE POLICY announcements_delete_admin ON announcements
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- QR_SCANS TABLE POLICIES
-- Users can read/create own; Council_Admin all
-- =============================================================================

-- Users can read their own QR scans
CREATE POLICY qr_scans_select_own ON qr_scans
  FOR SELECT
  USING (user_id = auth.uid());

-- Council_Admin can read all QR scans
CREATE POLICY qr_scans_select_admin ON qr_scans
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Users can create their own QR scan records
CREATE POLICY qr_scans_insert_own ON qr_scans
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Council_Admin can delete QR scans
CREATE POLICY qr_scans_delete_admin ON qr_scans
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- NOTIFICATIONS TABLE POLICIES
-- Users can read/update own (mark as read); system can create
-- =============================================================================

-- Users can read their own notifications
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Council_Admin can read all notifications
CREATE POLICY notifications_select_admin ON notifications
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Users can update their own notifications (mark as read)
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Council_Admin can insert notifications (system-generated)
CREATE POLICY notifications_insert_admin ON notifications
  FOR INSERT
  WITH CHECK (get_user_role() = 'Council_Admin');

-- Council_Admin can delete notifications
CREATE POLICY notifications_delete_admin ON notifications
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- GROUP_TRAIL_ATTEMPTS TABLE POLICIES
-- Members can read; leader can manage; Council_Admin all
-- =============================================================================

-- Leaders can read their own group trail attempts
CREATE POLICY group_trail_attempts_select_leader ON group_trail_attempts
  FOR SELECT
  USING (leader_id = auth.uid());

-- Members can read group trail attempts they belong to
CREATE POLICY group_trail_attempts_select_member ON group_trail_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_trail_members
      WHERE group_trail_members.attempt_id = group_trail_attempts.id
      AND group_trail_members.user_id = auth.uid()
    )
  );

-- Council_Admin can read all group trail attempts
CREATE POLICY group_trail_attempts_select_admin ON group_trail_attempts
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Senior_Scout and above can create group trail attempts
CREATE POLICY group_trail_attempts_insert_senior ON group_trail_attempts
  FOR INSERT
  WITH CHECK (
    leader_id = auth.uid()
    AND get_user_role() IN ('Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin')
  );

-- Leader can update their own group trail attempts
CREATE POLICY group_trail_attempts_update_leader ON group_trail_attempts
  FOR UPDATE
  USING (leader_id = auth.uid());

-- Council_Admin can update all group trail attempts
CREATE POLICY group_trail_attempts_update_admin ON group_trail_attempts
  FOR UPDATE
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can delete group trail attempts
CREATE POLICY group_trail_attempts_delete_admin ON group_trail_attempts
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- GROUP_TRAIL_MEMBERS TABLE POLICIES
-- Members can read; leader can manage; Council_Admin all
-- =============================================================================

-- Users can read their own membership records
CREATE POLICY group_trail_members_select_own ON group_trail_members
  FOR SELECT
  USING (user_id = auth.uid());

-- Leaders can read members of their group trail attempts
CREATE POLICY group_trail_members_select_leader ON group_trail_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_trail_attempts
      WHERE group_trail_attempts.id = group_trail_members.attempt_id
      AND group_trail_attempts.leader_id = auth.uid()
    )
  );

-- Council_Admin can read all group trail members
CREATE POLICY group_trail_members_select_admin ON group_trail_members
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Leader can invite members to their group trail attempts
CREATE POLICY group_trail_members_insert_leader ON group_trail_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_trail_attempts
      WHERE group_trail_attempts.id = group_trail_members.attempt_id
      AND group_trail_attempts.leader_id = auth.uid()
    )
  );

-- Council_Admin can insert group trail members
CREATE POLICY group_trail_members_insert_admin ON group_trail_members
  FOR INSERT
  WITH CHECK (get_user_role() = 'Council_Admin');

-- Members can update their own invitation status (accept/decline)
CREATE POLICY group_trail_members_update_own ON group_trail_members
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Leader can update members of their group trail attempts
CREATE POLICY group_trail_members_update_leader ON group_trail_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_trail_attempts
      WHERE group_trail_attempts.id = group_trail_members.attempt_id
      AND group_trail_attempts.leader_id = auth.uid()
    )
  );

-- Council_Admin can update all group trail members
CREATE POLICY group_trail_members_update_admin ON group_trail_members
  FOR UPDATE
  USING (get_user_role() = 'Council_Admin');

-- Leader can remove members from their group trail attempts
CREATE POLICY group_trail_members_delete_leader ON group_trail_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_trail_attempts
      WHERE group_trail_attempts.id = group_trail_members.attempt_id
      AND group_trail_attempts.leader_id = auth.uid()
    )
  );

-- Council_Admin can delete group trail members
CREATE POLICY group_trail_members_delete_admin ON group_trail_members
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- REFERRALS TABLE POLICIES
-- Users can read/create own; Council_Admin all
-- =============================================================================

-- Users can read their own referrals (as referrer)
CREATE POLICY referrals_select_own ON referrals
  FOR SELECT
  USING (referrer_id = auth.uid() OR referred_user_id = auth.uid());

-- Council_Admin can read all referrals
CREATE POLICY referrals_select_admin ON referrals
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Users can create their own referral links
CREATE POLICY referrals_insert_own ON referrals
  FOR INSERT
  WITH CHECK (referrer_id = auth.uid());

-- Council_Admin can update referrals (e.g., mark as redeemed)
CREATE POLICY referrals_update_admin ON referrals
  FOR UPDATE
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can delete referrals
CREATE POLICY referrals_delete_admin ON referrals
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');

-- =============================================================================
-- EVENTS TABLE POLICIES
-- Authenticated can read active; Council_Admin can CRUD
-- =============================================================================

-- All authenticated users can read active events
CREATE POLICY events_select_active ON events
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- Council_Admin can read all events (including inactive)
CREATE POLICY events_select_admin ON events
  FOR SELECT
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can insert events
CREATE POLICY events_insert_admin ON events
  FOR INSERT
  WITH CHECK (get_user_role() = 'Council_Admin');

-- Council_Admin can update events
CREATE POLICY events_update_admin ON events
  FOR UPDATE
  USING (get_user_role() = 'Council_Admin');

-- Council_Admin can delete events
CREATE POLICY events_delete_admin ON events
  FOR DELETE
  USING (get_user_role() = 'Council_Admin');
