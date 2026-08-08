# Implementation Plan: ScoutChase Taguig

## Overview

A phased implementation of the ScoutChase Taguig PWA platform covering project setup, authentication, heritage exploration, challenges, service tracking, gamification, admin tools, and progressive enhancement. Each phase builds incrementally on previous work, wiring all components together before moving to the next major feature set. The stack is React 18 + TypeScript + Vite with Supabase (Postgres, Auth, Storage, Realtime, Edge Functions), deployed on Vercel.

## Tasks

- [x] 1. Project setup, authentication & user profiles
  - [x] 1.1 Initialize Vite + React 18 + TypeScript project with Tailwind CSS, shadcn/ui, Zustand, React Router 6, and Vitest + fast-check
    - Create directory structure: `src/lib/`, `src/components/`, `src/pages/`, `src/stores/`, `src/hooks/`, `supabase/functions/`, `supabase/migrations/`
    - Configure `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `.env.example`
    - Install dependencies: react, react-dom, react-router-dom, zustand, @supabase/supabase-js, leaflet, react-leaflet, html5-qrcode, vite-plugin-pwa, vitest, fast-check, @testing-library/react
    - Set up shadcn/ui with BSP theme colors (Forest Green #1B5E20, Gold #FFD700, Deep Red #B71C1C, Navy #1A237E)
    - _Requirements: 19.1, 19.2, 22.1_

  - [x] 1.2 Create Supabase project configuration and database migration for core tables
    - Write SQL migration for enum types: `user_role`, `challenge_type`, `difficulty_level`, `submission_status`, `service_log_status`, `group_attempt_status`, `invitation_status`
    - Write SQL migration for tables: `profiles`, `heritage_sites`, `trails`, `challenges`, `submissions`, `service_missions`, `service_logs`, `badges`, `user_badges`, `points_ledger`, `partners`, `announcements`, `qr_scans`, `notifications`, `group_trail_attempts`, `group_trail_members`, `referrals`, `events`
    - Create all performance indexes as defined in design
    - _Requirements: 1.1, 3.1, 21.2_

  - [x] 1.3 Implement Supabase Row Level Security (RLS) policies for all tables
    - Write RLS policies enforcing role-based access for each table
    - Ensure profiles can only be read/updated by owner or Council_Admin
    - Ensure submissions/service_logs filtered by user or reviewer role
    - Ensure notifications visible only to target user
    - _Requirements: 3.1, 3.9, 21.2, 21.5_

  - [x] 1.4 Implement registration form and validation logic
    - Create `src/lib/validators/registration.ts` with full name (2-100 chars), age (7-99), section selection, troop/unit validation (`^[a-zA-Z0-9]{1,20}$`)
    - Create `src/pages/Register.tsx` with form fields, client-side validation, field-level error messages
    - Implement guardian email requirement for users under 12
    - Preserve valid data on validation failure
    - _Requirements: 1.1, 1.6, 1.7_

  - [x] 1.5 Write property test for registration input validation (Property 1)
    - **Property 1: Registration input validation**
    - Generate arbitrary names, ages, sections, troop numbers; assert validator accepts iff all constraints met
    - **Validates: Requirements 1.1**

  - [x] 1.6 Implement role assignment logic from registration data
    - Create `src/lib/auth/role-assignment.ts` implementing role derivation rules
    - Scout section + valid troop → corresponding scout role; "Not a Scout yet" → Guest; Adult Leader → Adult_Leader; scout section without troop → Guest with message
    - Wire into registration flow to set role on profile creation
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 1.7 Write property test for role assignment (Property 2)
    - **Property 2: Role assignment from registration**
    - Generate arbitrary section/troop combinations; assert correct role assignment and guardian requirement
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6**

  - [x] 1.8 Implement authentication (login, logout, session, password reset)
    - Create `src/pages/Login.tsx` with Supabase Auth email/password sign-in
    - Implement generic error messages for invalid credentials
    - Implement account lockout after 5 failed attempts (15-minute lockout) via Supabase Auth config
    - Create `src/pages/ResetPassword.tsx` with password reset flow (15-min expiry link)
    - Implement session persistence (24h duration) with auto-redirect on expiry
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 1.9 Implement RoleGuard component and route protection
    - Create `src/components/RoleGuard.tsx` that checks user role against allowed roles
    - Create `src/lib/auth/permissions.ts` defining role-resource permission map
    - Implement frontend route guards redirecting unauthorized users to login
    - Wire AuthProvider context with role-based navigation filtering
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x] 1.10 Write property test for RBAC access decisions (Property 3)
    - **Property 3: RBAC access decision correctness**
    - Generate arbitrary (role, resource) pairs; assert allow iff role in resource permission set
    - **Validates: Requirements 3.1, 3.9**

  - [x] 1.11 Implement Digital Passport page with aggregated stats
    - Create `src/pages/Passport.tsx` displaying visited sites, completed challenges, service hours, badges, points, rank
    - Create `src/lib/passport/aggregate.ts` for passport data aggregation logic
    - Create Supabase RPC function `get_user_passport(user_id)` returning aggregated data
    - Implement realtime updates via Supabase Realtime subscriptions (update within 5 seconds)
    - _Requirements: 4.1, 4.2_

  - [x] 1.12 Implement profile editing (display name and avatar upload)
    - Create `src/lib/validators/display-name.ts` (3-30 chars, letters/numbers/spaces/hyphens)
    - Create `src/lib/validators/file-upload.ts` for avatar validation (JPEG/PNG, max 2MB, max 512×512)
    - Add profile edit UI to Passport page with avatar upload to Supabase Storage
    - Display field-specific error messages on validation failure
    - _Requirements: 4.3, 4.4, 4.5_

  - [x] 1.13 Write property test for display name validation (Property 6)
    - **Property 6: Display name validation**
    - Generate arbitrary strings; assert validator accepts iff length 3-30 and chars in [a-zA-Z0-9 -]
    - **Validates: Requirements 4.3, 4.4**

  - [x] 1.14 Write property test for file upload validation (Property 11)
    - **Property 11: File upload validation**
    - Generate arbitrary file metadata (type, size, dimensions); assert acceptance iff constraints met for each context (avatar, challenge photo, service proof)
    - **Validates: Requirements 4.5, 9.5, 9.6, 21.4**

- [x] 2. Checkpoint - Verify project setup, auth & profiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Heritage sites, trails & interactive map
  - [x] 3.1 Implement Interactive Heritage Map page with Leaflet
    - Create `src/pages/Map.tsx` with pannable/zoomable Leaflet map
    - Create `src/components/HeritageMap.tsx` with pin markers for active sites
    - Implement unlocked vs locked marker differentiation (distinct icon/color)
    - Implement marker popup showing site name, trail affiliation, lock status
    - Create `src/lib/map/filter-sites.ts` for theme filtering
    - Implement trail theme filter UI with empty-state message
    - Handle map load failure with error + retry
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 3.2 Write property test for map theme filtering (Property 7)
    - **Property 7: Map theme filtering**
    - Generate arbitrary site sets with various themes and a filter; assert result contains only matching sites and empty set when no match
    - **Validates: Requirements 5.3**

  - [x] 3.3 Implement Heritage Site content pages
    - Create `src/pages/SiteContent.tsx` displaying: historical write-up (max 2000 chars), photo gallery (1-10 images), optional audio player, optional video embed, timeline (1-20 entries)
    - Hide empty optional sections without placeholder
    - Create `src/lib/content/rich-text-parser.ts` to parse rich-text JSON to semantic HTML5
    - Create `src/lib/content/sanitizer.ts` using DOMPurify to strip executable content
    - Handle media load failure with fallback message
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 24.1, 24.2, 24.5_

  - [x] 3.4 Write property test for rich-text round-trip (Property 25)
    - **Property 25: Rich-text content round-trip**
    - Generate arbitrary valid rich-text JSON; assert parse→HTML→JSON produces structurally identical output
    - **Validates: Requirements 24.1, 24.2, 24.3, 24.4**

  - [x] 3.5 Write property test for HTML sanitization (Property 26)
    - **Property 26: HTML sanitization removes all executable content**
    - Generate arbitrary HTML strings with script tags, event handlers, javascript: URLs; assert sanitizer removes all executable elements
    - **Validates: Requirements 21.3, 24.5**

  - [x] 3.6 Write property test for content size validation (Property 27)
    - **Property 27: Content size validation**
    - Generate arbitrary strings; assert validator accepts iff serialized length ≤ 500,000 characters
    - **Validates: Requirements 24.7**

  - [x] 3.7 Implement Trail listing and detail pages
    - Create `src/pages/Trails.tsx` listing all active trails with themes
    - Create `src/pages/TrailDetail.tsx` with overview, trail-specific map, progress bar, site list (locked/unlocked)
    - Create `src/lib/trails/progress.ts` calculating trail completion percentage
    - Create Supabase RPC `get_trail_progress(user_id, trail_id)`
    - Implement trail completion detection and 50-point bonus award
    - Create `src/lib/validators/trail.ts` for trail site count validation (2-30 sites)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 3.8 Write property test for trail site count validation (Property 21)
    - **Property 21: Trail site count validation**
    - Generate arbitrary site lists; assert validator accepts iff count is between 2 and 30 inclusive
    - **Validates: Requirements 8.4, 8.5**

- [x] 4. QR scan + challenge flow
  - [x] 4.1 Implement QR Scanner page with html5-qrcode
    - Create `src/pages/Scan.tsx` with camera permission request and QR scanning
    - Create `src/components/QRScanner.tsx` component with 30-second timeout
    - Handle camera permission denial with instructions message
    - Handle timeout with retry option and suggestion
    - _Requirements: 6.1, 6.2, 6.6_

  - [x] 4.2 Implement QR code verification Edge Function
    - Create `supabase/functions/verify-qr-scan/index.ts`
    - Create `src/lib/qr/hmac.ts` for HMAC-SHA256 signing and verification logic
    - Implement signature verification, site existence check, duplicate scan detection
    - On new unlock: insert qr_scans record, award points via points_ledger, return success
    - On already unlocked: return success with already_unlocked flag (no duplicate points)
    - On invalid signature: return error
    - On inactive site: return "site inactive" message
    - _Requirements: 6.3, 6.4, 6.5, 6.7, 6.8, 21.1, 21.6_

  - [x] 4.3 Write property test for QR HMAC round-trip (Property 8)
    - **Property 8: QR code HMAC round-trip**
    - Generate arbitrary site IDs; assert sign-then-verify always succeeds and any byte modification causes verification failure
    - **Validates: Requirements 6.3, 21.1**

  - [x] 4.4 Write property test for QR scan idempotency (Property 9)
    - **Property 9: QR scan idempotency**
    - Simulate duplicate scans for same user+site; assert no duplicate records and no point change
    - **Validates: Requirements 6.8, 21.6**

  - [x] 4.5 Write property test for scan log completeness (Property 10)
    - **Property 10: Scan log completeness**
    - For any successful scan, assert log record contains non-null timestamp, user_id, and heritage_site_id
    - **Validates: Requirements 6.7**

  - [x] 4.6 Implement Challenge attempt page with role-based difficulty filtering
    - Create `src/pages/ChallengeAttempt.tsx` rendering challenge based on type
    - Create `src/lib/challenges/filter.ts` filtering challenges by role (Cub_Scout → Easy only)
    - Implement Cub Scout simplified view (max 3 trivia questions, 200-char limit, multiple-choice)
    - Implement standard view for Boy_Scout/Senior_Scout/Rover_Scout (up to 5 questions, 500-char limit)
    - Support all challenge types: trivia_quiz, observation, photo_documentation, puzzle, reflection_journal, interview, storytelling
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 4.7 Write property test for Cub Scout difficulty filtering (Property 4)
    - **Property 4: Cub Scout difficulty filtering**
    - Generate arbitrary challenge sets with mixed difficulties; assert Cub_Scout filter returns only Easy challenges as a subset
    - **Validates: Requirements 3.3**

  - [x] 4.8 Implement challenge submission flow with auto-grading and review queue placement
    - Create `src/lib/challenges/quiz-scorer.ts` for trivia/puzzle auto-grading
    - Place review-requiring submissions (photo, interview, storytelling, reflection) in pending status
    - Implement photo upload validation (JPEG/PNG, max 5MB, min 480×480)
    - Display results within 3 seconds for auto-graded challenges
    - Award points immediately for auto-graded correct answers
    - _Requirements: 9.4, 9.5, 9.6, 9.7_

  - [x] 4.9 Write property test for quiz scoring correctness (Property 12)
    - **Property 12: Quiz scoring correctness**
    - Generate arbitrary answer sets and keys; assert score equals count of matches × points-per-question
    - **Validates: Requirements 9.7**

- [x] 5. Checkpoint - Verify heritage sites, trails, QR scan & challenges
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Submissions & review queue
  - [x] 6.1 Implement Review Queue page for submissions and service logs
    - Create `src/pages/admin/ReviewQueue.tsx` displaying pending submissions and service logs
    - Create `src/lib/review/attempt-limiter.ts` enforcing max attempts logic
    - Implement approve action: award points, mark challenge completed, send notification
    - Implement reject action: require feedback (min 10 chars), allow resubmission up to max attempts
    - Mark as "failed"/"rejected" and prevent further submissions at max attempts
    - Filter review scope: Adult_Leader sees own troop only, Rover_Scout sees Cub/Boy_Scout only, Council_Admin sees all
    - _Requirements: 9.8, 9.9, 9.10, 10.3, 10.5, 10.6, 3.7_

  - [x] 6.2 Write property test for review attempt limiting (Property 13)
    - **Property 13: Review attempt limiting**
    - Generate arbitrary attempt_number and max_attempts; assert resubmission allowed iff attempt < max, blocked otherwise
    - **Validates: Requirements 9.9, 9.10, 10.5, 10.6**

  - [x] 6.3 Write property test for Rover Scout moderation scope (Property 24)
    - **Property 24: Rover Scout moderation scope**
    - Generate arbitrary submissions with author roles; assert Rover_Scout can moderate iff author is Cub_Scout or Boy_Scout
    - **Validates: Requirements 18.3, 18.4**

- [x] 7. Badges, points & leaderboard
  - [x] 7.1 Implement points system and ledger
    - Create `src/lib/points/calculator.ts` implementing total point formula: challenges(×50) + service(10/hr, cap 500/month) + trails(×100) + events(×25)
    - Create `src/lib/points/service-points.ts` for service hour point calculation with monthly cap
    - Create Supabase RPC `award_points(user_id, amount, reason, ref_id)` with atomic ledger insert and profile total update
    - _Requirements: 11.1_

  - [x] 7.2 Write property test for point system calculation (Property 16)
    - **Property 16: Point system calculation**
    - Generate arbitrary activity combinations; assert total matches formula with service cap
    - **Validates: Requirements 11.1**

  - [x] 7.3 Write property test for service hour point award (Property 15)
    - **Property 15: Service hour point award calculation**
    - Generate arbitrary duration values; assert points = floor(D)×10 + (fractional≥0.5 ? 5 : 0), capped at 500/month
    - **Validates: Requirements 10.4, 11.1**

  - [x] 7.4 Implement badge criteria evaluation and award system
    - Create `src/lib/badges/evaluator.ts` checking user stats against badge criteria_json
    - Create Supabase Edge Function `check-badge-criteria` triggered after point/action events
    - Implement all badge definitions: Heritage Explorer, History Detective, Community Volunteer, Environmental Steward, Trail Conqueror, Scout Ambassador, Cultural Guardian, ScoutChase Champion
    - _Requirements: 11.2_

  - [x] 7.5 Write property test for badge criteria evaluation (Property 17)
    - **Property 17: Badge criteria evaluation**
    - Generate arbitrary user activity profiles and badge criteria; assert badge awarded iff all criteria met
    - **Validates: Requirements 11.2**

  - [x] 7.6 Implement certificate generation Edge Function
    - Create Supabase Edge Function `generate-certificate` producing PNG/PDF (max 5MB) with user name, badge name, date earned
    - Store certificate URL in user_badges table
    - Handle generation failure with error message and retry option
    - _Requirements: 11.3, 11.6_

  - [x] 7.7 Implement Leaderboard page with realtime updates
    - Create `src/pages/Leaderboard.tsx` with category filter (individual, patrol/troop, school, rover/senior)
    - Create `src/lib/leaderboard/sort.ts` for ranking logic (descending points, tie-break by earlier last_point_date)
    - Create `src/lib/leaderboard/privacy-filter.ts` excluding PII for minors (is_minor = true)
    - Create Supabase RPC `get_leaderboard(category, limit, offset)` returning top 100 per category
    - Wire Supabase Realtime for live updates within 5 seconds
    - _Requirements: 11.4, 11.5, 21.7_

  - [x] 7.8 Write property test for leaderboard ordering (Property 18)
    - **Property 18: Leaderboard ordering**
    - Generate arbitrary user sets with points and timestamps; assert descending point order with tie-break, max 100 entries
    - **Validates: Requirements 11.4**

  - [x] 7.9 Write property test for minor privacy protection (Property 19)
    - **Property 19: Minor privacy protection**
    - Generate arbitrary leaderboard outputs; assert no entry for is_minor=true reveals PII beyond display_name
    - **Validates: Requirements 21.7**

- [x] 8. Checkpoint - Verify submissions, badges, points & leaderboard
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Service-hour logging & verification
  - [x] 9.1 Implement Service Missions listing and Service Log form
    - Create `src/pages/ServiceMissions.tsx` listing missions linked to trails
    - Create `src/pages/ServiceLogForm.tsx` with: description (20-500 chars), duration (0.5-24 in 0.5 increments), date (not future), optional photo proof (JPEG/PNG, max 5MB)
    - Create `src/lib/validators/service-log.ts` for input validation
    - Place submitted logs in review queue with status "pending_verification"
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 9.2 Write property test for service log input validation (Property 14)
    - **Property 14: Service log input validation**
    - Generate arbitrary service log inputs; assert validator accepts iff all constraints met
    - **Validates: Requirements 10.2**

  - [x] 9.3 Implement service log verification flow
    - Add verify/reject actions for Adult_Leader and Council_Admin in review queue
    - On verify: add hours to passport total, award 10 points per hour via `award_points` RPC
    - On reject: require reason (min 10 chars), allow resubmission up to 3 attempts
    - Display running total on Digital Passport (1 decimal place)
    - _Requirements: 10.4, 10.5, 10.6, 10.7_

- [x] 10. Membership/recruitment pages
  - [x] 10.1 Implement "Join Scouting" public page and referral system
    - Create `src/pages/JoinScouting.tsx` (public, no auth required) with BSP description, local units list, call-to-action for introductory challenge
    - Implement "Ready to become a Scout?" prompt after introductory challenge completion
    - Create referral link generation (unique code per user, 90-day expiry)
    - Create Supabase Edge Function `process-referral` for registration attribution
    - Handle multiple referral source conflict (use the link from registration session)
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 10.2 Implement events management and tracking
    - Create `src/pages/Events.tsx` for events listing
    - Track participant count, challenge completions, new registrations per event
    - Create admin event creation UI at `src/pages/admin/Events.tsx`
    - Implement recruitment data summary view for Council_Admin (referrals per user, registrations per event, guest-to-Scout conversions)
    - _Requirements: 12.5, 12.6_

- [x] 11. Partners page
  - [x] 11.1 Implement public Partners page and admin management
    - Create `src/pages/Partners.tsx` (public) displaying partners alphabetically: logo (max 500KB, 80px height), name, description (max 200 chars)
    - Create `src/lib/partners/sort.ts` for alphabetical ordering (case-insensitive)
    - Create `src/pages/admin/Partners.tsx` for add/edit/remove with validation
    - Reflect changes within 60 seconds of admin action
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 11.2 Write property test for partners alphabetical ordering (Property 20)
    - **Property 20: Partners alphabetical ordering**
    - Generate arbitrary partner sets; assert output sorted ascending alphabetically by name (case-insensitive)
    - **Validates: Requirements 13.1**

- [x] 12. Checkpoint - Verify service hours, membership, partners
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Admin analytics dashboard
  - [x] 13.1 Implement admin content management pages
    - Create `src/pages/admin/SiteEditor.tsx` with rich-text editor (max 10,000 chars), photo/audio/video uploads, timeline entries (max 50), preview function
    - Create `src/pages/admin/Trails.tsx` for trail CRUD with drag-and-drop site ordering (2-50 sites)
    - Create `src/pages/admin/Challenges.tsx` for challenge CRUD with type and difficulty selection
    - Create `src/pages/admin/Missions.tsx` for service mission management
    - Create `src/pages/admin/Badges.tsx` for badge CRUD with manual award capability
    - Create `src/pages/admin/Users.tsx` for user management (role assignment, deactivation)
    - Create `src/pages/admin/Announcements.tsx` for publishing announcements (max 2,000 chars)
    - Implement dependency warnings before deletion (Req 14.8) and success/failure confirmations within 3 seconds
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10_

  - [x] 13.2 Implement QR code generation and management
    - Create Supabase Edge Function `generate-qr-code` producing HMAC-signed QR payload and PNG (300 DPI, 1200×1200 min)
    - Create Supabase Edge Function `regenerate-qr-code` invalidating old + creating new signed QR
    - Create `src/pages/admin/QRCodes.tsx` for QR code management UI
    - Implement downloadable QR code images in PNG format
    - Handle site deactivation (invalidate QR, return "site inactive" on scan)
    - Handle generation failure with error message
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

  - [x] 13.3 Implement analytics dashboard
    - Create `src/pages/admin/Dashboard.tsx` displaying: total participants by role, active sites, QR scans with daily/weekly trends, completed challenges, pending review items, verified service hours, new sign-ups (weekly/cumulative), retention rate (30-day active/total), partner count, satisfaction rating
    - Create Supabase RPC `get_analytics_summary(start_date, end_date)` for aggregated metrics
    - Implement date range filter (up to 365 days) with recalculation within 10 seconds
    - Create Supabase Edge Function `export-analytics-csv` for CSV data export (download within 10 seconds)
    - Handle partial load failure (show available metrics, error for failed ones)
    - Update dashboard data within 60 seconds of underlying changes
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 14. Notifications system
  - [x] 14.1 Implement notification feed and realtime delivery
    - Create `src/pages/Notifications.tsx` showing most recent 50 notifications (descending date)
    - Create `src/components/NotificationFeed.tsx` with read/unread state and unread count badge
    - Implement notification types: announcements, submission status, badge earned, trail launch, event
    - Wire Supabase Realtime for live notification delivery within 60 seconds
    - Implement mark-as-read (individual and all) with immediate unread count update
    - Queue offline notifications for delivery on reconnect
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

- [x] 15. Checkpoint - Verify admin, analytics, notifications
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Group trail attempts & mentoring
  - [x] 16.1 Implement Group Trail Attempts feature
    - Create `src/pages/GroupTrails.tsx` and `src/pages/GroupTrailDetail.tsx`
    - Implement group creation (Senior_Scout only): invite 1-9 users, max group size 10
    - Create `src/lib/validators/group-trail.ts` for group size validation
    - Implement invitation flow: accept/decline, 72-hour expiry with leader notification
    - Display per-member unlock count and group aggregate progress
    - Create `src/lib/trails/group-progress.ts` for group progress calculation
    - Implement group completion when all trail sites unlocked by at least one member
    - Handle leader departure: cancel attempt, notify all members
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

  - [x] 16.2 Write property test for group trail size validation (Property 22)
    - **Property 22: Group trail attempt size validation**
    - Generate arbitrary invitee counts; assert validator accepts iff 1 ≤ N ≤ 9
    - **Validates: Requirements 17.1**

  - [x] 16.3 Write property test for group trail progress and completion (Property 23)
    - **Property 23: Group trail progress and completion**
    - Generate arbitrary member unlock sets and trail sizes; assert progress = |union of unlocks|/N × 100 and complete iff union covers all sites
    - **Validates: Requirements 17.4, 17.5**

  - [x] 16.4 Implement Rover Scout Mentoring panel
    - Create `src/pages/Mentoring.tsx` with paginated list (max 50/page) of Cub_Scout and Boy_Scout members in same council
    - Create `src/lib/review/moderation-scope.ts` enforcing Rover moderation scope
    - Implement feedback comments (1-1000 chars) on reviewed submissions
    - Reject moderation attempts on Senior_Scout/Rover_Scout/Adult_Leader submissions with error
    - Display empty state when no mentees available
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [x] 17. Checkpoint - Verify group trails & mentoring
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. PWA, offline, accessibility & performance
  - [x] 18.1 Configure PWA with service worker and offline support
    - Configure `vite-plugin-pwa` with Workbox for service worker generation
    - Implement cache-first strategy for previously loaded heritage site text and images
    - Display offline indicator when network is unavailable
    - Show "content unavailable offline" message for unloaded content
    - Implement installability (manifest.json with BSP branding)
    - _Requirements: 19.2, 19.3_

  - [x] 18.2 Implement mobile-first responsive design and performance optimization
    - Ensure responsive layout adapts 320px-1920px without horizontal scroll or overlap
    - Set minimum tap targets to 44×44px for all interactive elements
    - Optimize for LCP < 3s on 3G (code splitting, lazy loading, image optimization)
    - Implement heritage site content page first meaningful paint < 4s on 3G
    - _Requirements: 19.1, 19.4, 19.5, 7.6_

  - [x] 18.3 Implement accessibility (WCAG 2.1 AA)
    - Enforce color contrast ratios (4.5:1 normal text, 3:1 large text)
    - Add alt text for all images/icons (max 125 chars), empty alt for decorative
    - Implement keyboard navigation with visible focus indicators (2px outline), no keyboard traps
    - Use semantic HTML and ARIA attributes throughout
    - Set minimum body font 16px with scalable text up to 200% zoom without content loss
    - Ensure 44×44px minimum touch/click targets
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

  - [x] 18.4 Implement environment-based multi-council configuration
    - Create environment-based config for council branding (name, logo, color scheme)
    - Ensure heritage content is database-driven, separate from application code
    - Validate platform handles 500+ concurrent sessions with ≤3s page load, ≤2s API response
    - Implement graceful degradation with informative message when capacity exceeded
    - _Requirements: 22.1, 22.2, 22.3, 22.4_

  - [x] 18.5 Implement security hardening
    - Implement input sanitization: reject HTML/script in user text, truncate at 2000 chars, strip markup before storage
    - Restrict file uploads to JPEG/PNG/WebP, max 5MB, with Supabase Storage access policies
    - Log unauthorized access attempts (user_id + requested resource)
    - Implement minor account protection (exclude from PII-revealing leaderboard displays)
    - _Requirements: 21.3, 21.4, 21.5, 21.7_

- [x] 19. Remaining property-based tests
  - [x] 19.1 Write property test for Digital Passport aggregation (Property 5)
    - **Property 5: Digital Passport aggregation correctness**
    - Generate arbitrary activity records; assert passport counts/totals exactly match sum/count of records
    - **Validates: Requirements 4.1**

  - [x] 19.2 Write property test for Cub Scout difficulty filtering standalone (Property 4 integration)
    - **Property 4: Cub Scout difficulty filtering** (integration-level test with component data)
    - Generate sets of challenges; assert filtered result for Cub_Scout is strict subset with only Easy
    - **Validates: Requirements 3.3**

- [x] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests validate the 27 universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The tech stack is: React 18 + TypeScript + Vite, Supabase (Postgres, Auth, Storage, Realtime, Edge Functions), Vercel, Leaflet maps, html5-qrcode, Zustand, Tailwind CSS + shadcn/ui, Vitest + fast-check
- All pure logic modules are in `src/lib/` for testability independent of UI
- Supabase Edge Functions handle server-side operations (QR verification, certificates, referrals, badge checks, CSV export)
- RLS policies enforce backend security; RoleGuard enforces frontend access control

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4"] },
    { "id": 3, "tasks": ["1.5", "1.6"] },
    { "id": 4, "tasks": ["1.7", "1.8", "1.9"] },
    { "id": 5, "tasks": ["1.10", "1.11", "1.12"] },
    { "id": 6, "tasks": ["1.13", "1.14", "3.1"] },
    { "id": 7, "tasks": ["3.2", "3.3", "3.7"] },
    { "id": 8, "tasks": ["3.4", "3.5", "3.6", "3.8", "4.1"] },
    { "id": 9, "tasks": ["4.2", "4.6"] },
    { "id": 10, "tasks": ["4.3", "4.4", "4.5", "4.7", "4.8"] },
    { "id": 11, "tasks": ["4.9", "6.1"] },
    { "id": 12, "tasks": ["6.2", "6.3", "7.1"] },
    { "id": 13, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 14, "tasks": ["7.5", "7.6", "7.7"] },
    { "id": 15, "tasks": ["7.8", "7.9", "9.1"] },
    { "id": 16, "tasks": ["9.2", "9.3", "10.1"] },
    { "id": 17, "tasks": ["10.2", "11.1"] },
    { "id": 18, "tasks": ["11.2", "13.1"] },
    { "id": 19, "tasks": ["13.2", "13.3"] },
    { "id": 20, "tasks": ["14.1"] },
    { "id": 21, "tasks": ["16.1"] },
    { "id": 22, "tasks": ["16.2", "16.3", "16.4"] },
    { "id": 23, "tasks": ["18.1", "18.2"] },
    { "id": 24, "tasks": ["18.3", "18.4", "18.5"] },
    { "id": 25, "tasks": ["19.1", "19.2"] }
  ]
}
```
