-- FILE: 20250101000000_create_core_schema.sql
-- ScoutChase Taguig: Core Database Schema
-- Migration: Create enum types, core tables, and performance indexes
-- Requirements: 1.1, 3.1, 21.2

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE user_role AS ENUM (
  'Guest', 'Cub_Scout', 'Boy_Scout', 'Senior_Scout',
  'Rover_Scout', 'Adult_Leader', 'Council_Admin'
);

CREATE TYPE challenge_type AS ENUM (
  'trivia_quiz', 'observation', 'photo_documentation',
  'puzzle', 'reflection_journal', 'interview', 'storytelling'
);

CREATE TYPE difficulty_level AS ENUM ('Easy', 'Medium', 'Hard');

CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected', 'failed');

CREATE TYPE service_log_status AS ENUM ('pending_verification', 'verified', 'rejected');

CREATE TYPE group_attempt_status AS ENUM ('active', 'completed', 'cancelled');

CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Trails table (created before heritage_sites due to FK dependency)
CREATE TABLE trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  theme TEXT NOT NULL,
  description TEXT CHECK (char_length(description) <= 500),
  site_count INTEGER NOT NULL DEFAULT 0,
  bonus_points INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Events table (created before referrals due to FK dependency)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  max_participants INTEGER,
  created_by UUID NOT NULL,
  participant_count INTEGER NOT NULL DEFAULT 0,
  challenge_completions INTEGER NOT NULL DEFAULT 0,
  new_registrations INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  display_name TEXT CHECK (char_length(display_name) BETWEEN 3 AND 30),
  age INTEGER NOT NULL CHECK (age BETWEEN 7 AND 99),
  role user_role NOT NULL DEFAULT 'Guest',
  scout_section TEXT,
  troop_unit_number TEXT CHECK (troop_unit_number ~ '^[a-zA-Z0-9]{1,20}$'),
  school TEXT,
  avatar_url TEXT,
  guardian_email TEXT,
  council_id UUID,
  is_minor BOOLEAN GENERATED ALWAYS AS (age < 13) STORED,
  total_points INTEGER NOT NULL DEFAULT 0,
  total_service_hours NUMERIC(6,1) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from events.created_by to profiles after profiles is created
ALTER TABLE events
  ADD CONSTRAINT events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id);

-- Heritage Sites table
CREATE TABLE heritage_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT CHECK (char_length(description) <= 2000),
  content_json JSONB,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  trail_id UUID REFERENCES trails(id),
  photo_gallery TEXT[] DEFAULT '{}',
  audio_url TEXT,
  video_url TEXT,
  timeline JSONB DEFAULT '[]',
  qr_code_payload TEXT UNIQUE,
  qr_code_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Challenges table
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  heritage_site_id UUID NOT NULL REFERENCES heritage_sites(id) ON DELETE CASCADE,
  type challenge_type NOT NULL,
  difficulty difficulty_level NOT NULL DEFAULT 'Medium',
  title TEXT NOT NULL,
  description TEXT,
  content_json JSONB NOT NULL,
  points_reward INTEGER NOT NULL DEFAULT 50,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Submissions table
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  response_json JSONB NOT NULL,
  photo_url TEXT,
  status submission_status NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES profiles(id),
  reviewer_feedback TEXT CHECK (char_length(reviewer_feedback) >= 10),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- Service Missions table
CREATE TABLE service_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  mission_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service Logs table
CREATE TABLE service_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES service_missions(id),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 20 AND 500),
  duration_hours NUMERIC(4,1) NOT NULL CHECK (duration_hours BETWEEN 0.5 AND 24),
  date_performed DATE NOT NULL CHECK (date_performed <= CURRENT_DATE),
  photo_url TEXT,
  status service_log_status NOT NULL DEFAULT 'pending_verification',
  verifier_id UUID REFERENCES profiles(id),
  rejection_reason TEXT CHECK (char_length(rejection_reason) >= 10),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ
);

-- Badges table
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  criteria_json JSONB NOT NULL,
  icon_url TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Badges table
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  certificate_url TEXT,
  UNIQUE(user_id, badge_id)
);

-- Points Ledger table
CREATE TABLE points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partners table
CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT CHECK (char_length(description) <= 200),
  logo_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Announcements table
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  author_id UUID NOT NULL REFERENCES profiles(id),
  target_roles user_role[] DEFAULT '{}'::user_role[],
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- QR Scans table
CREATE TABLE qr_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  heritage_site_id UUID NOT NULL REFERENCES heritage_sites(id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, heritage_site_id)
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL,
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Group Trail Attempts table
CREATE TABLE group_trail_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID NOT NULL REFERENCES trails(id),
  leader_id UUID NOT NULL REFERENCES profiles(id),
  status group_attempt_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Group Trail Members table
CREATE TABLE group_trail_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES group_trail_attempts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  invitation_status invitation_status NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE(attempt_id, user_id)
);

-- Referrals table
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id),
  referred_user_id UUID REFERENCES profiles(id),
  referral_code TEXT NOT NULL UNIQUE,
  event_id UUID REFERENCES events(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days')
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_council ON profiles(council_id);
CREATE INDEX idx_profiles_troop ON profiles(troop_unit_number);

CREATE INDEX idx_heritage_sites_trail ON heritage_sites(trail_id);
CREATE INDEX idx_heritage_sites_active ON heritage_sites(is_active);

CREATE INDEX idx_qr_scans_user ON qr_scans(user_id);
CREATE INDEX idx_qr_scans_site ON qr_scans(heritage_site_id);

CREATE INDEX idx_submissions_user ON submissions(user_id);
CREATE INDEX idx_submissions_status ON submissions(status);

CREATE INDEX idx_service_logs_user ON service_logs(user_id);
CREATE INDEX idx_service_logs_status ON service_logs(status);

CREATE INDEX idx_points_ledger_user ON points_ledger(user_id);
CREATE INDEX idx_points_ledger_created ON points_ledger(created_at);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);

CREATE INDEX idx_group_trail_members_user ON group_trail_members(user_id);

CREATE INDEX idx_referrals_code ON referrals(referral_code);

CREATE INDEX idx_announcements_published ON announcements(is_published, published_at);

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to tables with updated_at column
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_heritage_sites
  BEFORE UPDATE ON heritage_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_trails
  BEFORE UPDATE ON trails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_challenges
  BEFORE UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_partners
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- FILE: 20250101000001_create_rls_policies.sql
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

-- FILE: 20250101000002_passport_rpc.sql
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

-- FILE: 20250101000003_trail_rpc.sql
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

-- FILE: 20250101000004_award_points_rpc.sql
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

-- FILE: 20250101000005_leaderboard_rpc.sql
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

-- FILE: 20250101000006_analytics_rpc.sql
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

-- FILE: 20250101000007_storage_policies.sql
-- Storage bucket policies for file upload security hardening.
-- Restricts uploads to JPEG/PNG/WebP, max 5MB, authenticated users only.
-- Only the uploading user and admin roles can view or delete files.
--
-- Requirements: 21.4

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', false, 2097152, ARRAY['image/jpeg', 'image/png']),
  ('challenge-photos', 'challenge-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('service-proofs', 'service-proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('site-media', 'site-media', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('partner-logos', 'partner-logos', false, 524288, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('certificates', 'certificates', true, 5242880, ARRAY['image/png', 'application/pdf']),
  ('qr-codes', 'qr-codes', false, 5242880, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- AVATARS BUCKET POLICIES
-- ============================================================

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to view their own avatar, admins can view all
CREATE POLICY "Users can view own avatar or admin views all"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Council_Admin'
      )
    )
  );

-- Allow users to update/delete their own avatar
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- CHALLENGE PHOTOS BUCKET POLICIES
-- ============================================================

-- Allow authenticated users to upload challenge photos
CREATE POLICY "Users can upload challenge photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'challenge-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow uploading user and reviewers/admins to view challenge photos
CREATE POLICY "Users and reviewers can view challenge photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'challenge-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('Rover_Scout', 'Adult_Leader', 'Council_Admin')
      )
    )
  );

-- Allow uploading user to delete their own challenge photos
CREATE POLICY "Users can delete own challenge photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'challenge-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Council_Admin'
      )
    )
  );

-- ============================================================
-- SERVICE PROOFS BUCKET POLICIES
-- ============================================================

-- Allow authenticated users to upload service proofs
CREATE POLICY "Users can upload service proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'service-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow uploading user and verifiers/admins to view service proofs
CREATE POLICY "Users and verifiers can view service proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'service-proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('Adult_Leader', 'Council_Admin')
      )
    )
  );

-- Allow uploading user to delete their own service proofs
CREATE POLICY "Users can delete own service proofs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'service-proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'Council_Admin'
      )
    )
  );

-- ============================================================
-- SITE MEDIA BUCKET POLICIES (admin-managed heritage site content)
-- ============================================================

-- Only Council_Admin can upload site media
CREATE POLICY "Admins can upload site media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'site-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Council_Admin'
    )
  );

-- All authenticated users can view site media (heritage site content is public to authenticated users)
CREATE POLICY "Authenticated users can view site media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'site-media');

-- Only admins can delete site media
CREATE POLICY "Admins can delete site media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'site-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Council_Admin'
    )
  );

-- ============================================================
-- PARTNER LOGOS BUCKET POLICIES
-- ============================================================

-- Only Council_Admin can upload partner logos
CREATE POLICY "Admins can upload partner logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'partner-logos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Council_Admin'
    )
  );

-- Partner logos viewable by all authenticated users
CREATE POLICY "Authenticated users can view partner logos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'partner-logos');

-- Only admins can delete partner logos
CREATE POLICY "Admins can delete partner logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'partner-logos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Council_Admin'
    )
  );

-- ============================================================
-- CERTIFICATES BUCKET POLICIES (public read for sharing)
-- ============================================================

-- Certificates are generated by Edge Functions (service role), but users can view their own
CREATE POLICY "Users can view own certificates"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'certificates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- QR CODES BUCKET POLICIES (admin only)
-- ============================================================

-- Only admins can manage QR code images
CREATE POLICY "Admins can upload qr codes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'qr-codes'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Council_Admin'
    )
  );

CREATE POLICY "Admins can view qr codes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'qr-codes'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Council_Admin'
    )
  );

CREATE POLICY "Admins can delete qr codes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'qr-codes'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Council_Admin'
    )
  );

