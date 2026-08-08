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
