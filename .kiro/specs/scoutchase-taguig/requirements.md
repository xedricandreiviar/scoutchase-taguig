# Requirements Document

## Introduction

ScoutChase Taguig is a digital heritage-exploration and community-engagement platform built for the Boy Scouts of the Philippines (BSP) – Taguig City Council. Heritage sites, parks, monuments, and cultural spots around Taguig City each receive a QR code. Scanning a code unlocks historical content, quizzes, missions, and community service opportunities tied to that location. Completing trails and missions earns digital badges, points, and leaderboard rank. The platform serves two goals: (1) teach people about Taguig's heritage and encourage real community service, and (2) act as a membership recruitment and retention tool for BSP.

The platform is a full dynamic web application (React + TypeScript PWA) backed by Supabase (Postgres, Auth, Storage, Realtime), hosted on Vercel (frontend) and Supabase (backend), with in-browser QR scanning and map integration via Leaflet or Google Maps.

## Glossary

- **Platform**: The ScoutChase Taguig web application as a whole
- **Guest**: A non-authenticated visitor or a registered non-Scout user with limited access
- **Cub_Scout**: A registered user in the Cub Scout section (ages 6–11), linked to a guardian account
- **Boy_Scout**: A registered user in the Boy Scout section with full trail and mission access
- **Senior_Scout**: A registered user in the Senior Scout section who can lead group trail attempts
- **Rover_Scout**: A registered user in the Rover Scout section who can moderate submissions and mentor younger sections
- **Adult_Leader**: A registered adult user who verifies service hours and views their unit members' progress
- **Council_Admin**: An administrator with full control over sites, trails, badges, users, partners, and analytics
- **Heritage_Site**: A physical location in Taguig City registered in the platform with associated heritage content
- **Trail**: A themed collection of Heritage Sites forming a guided exploration path
- **Challenge**: A task tied to a Heritage Site that users complete for points (quiz, photo upload, reflection, etc.)
- **Submission**: A user-provided response to a Challenge that requires review before points are awarded
- **Service_Mission**: A community service activity linked to a Trail (clean-up drive, tree planting, etc.)
- **Service_Log**: A user's recorded community service hours with description and optional photo proof
- **Badge**: A digital achievement token earned by completing specific criteria
- **Digital_Passport**: A user's profile page showing visited sites, completed challenges, service hours, badges, points, and rank
- **QR_Code**: A unique, cryptographically signed code physically placed at a Heritage Site
- **Leaderboard**: A ranked listing of users or groups by accumulated points
- **Review_Queue**: A list of pending Submissions and Service Logs awaiting verification by authorized roles
- **Partner**: An external organization supporting the ScoutChase initiative
- **Announcement**: A notification or news item published by Council Admins

## Requirements

### Requirement 1: User Registration

**User Story:** As a prospective participant, I want to register an account so that I can track my progress and earn achievements.

#### Acceptance Criteria

1. WHEN a user submits the registration form, THE Platform SHALL create an account requiring: full name (between 2 and 100 characters), age (between 7 and 99), Scout section selection (Cub Scout, Boy Scout, Senior Scout, Rover Scout, Adult Leader, or "Not a Scout yet"), and optionally school and troop/unit number (alphanumeric, up to 20 characters).
2. WHEN a user selects "Not a Scout yet" as their section, THE Platform SHALL assign the Guest role to that account.
3. WHEN a user selects a Scout section (Cub Scout, Boy Scout, Senior Scout, or Rover Scout) and provides a troop/unit number, THE Platform SHALL assign the corresponding role (Cub_Scout, Boy_Scout, Senior_Scout, or Rover_Scout) to that account.
4. WHEN a user selects "Adult Leader" as their section, THE Platform SHALL assign the Adult_Leader role to that account.
5. IF a user selects a Scout section (Cub Scout, Boy Scout, Senior Scout, or Rover Scout) and does not provide a troop/unit number, THEN THE Platform SHALL assign the Guest role and display a message indicating that a troop/unit number is required for full Scout access.
6. WHEN a user under 12 years of age registers, THE Platform SHALL require a guardian email address and store the guardian association on the account so that the guardian receives a notification email upon successful registration.
7. IF registration data fails validation, THEN THE Platform SHALL display one error message per invalid field indicating the reason for rejection, and SHALL preserve all previously entered valid data in the form.

---

### Requirement 2: Authentication

**User Story:** As a registered user, I want to log in securely so that I can access my personalized content.

#### Acceptance Criteria

1. WHEN a user provides valid credentials, THE Platform SHALL authenticate the user and redirect to their Digital Passport within 3 seconds.
2. WHEN a user provides invalid credentials, THE Platform SHALL display a generic error message ("Invalid email or password") without revealing whether the email or password was incorrect.
3. IF a user fails authentication 5 times consecutively for the same email address, THEN THE Platform SHALL lock the account for 15 minutes and display a message indicating the lockout duration.
4. WHEN a user requests a password reset, THE Platform SHALL send a verification link to the registered email address that expires after 15 minutes.
5. WHILE a user session is active, THE Platform SHALL maintain authentication state across page reloads using Supabase session tokens with a session duration of 24 hours.
6. WHEN a user session expires after 24 hours of inactivity, THE Platform SHALL redirect the user to the login page with a message indicating the session has expired.

---

### Requirement 3: Role-Based Access Control

**User Story:** As a platform administrator, I want role-based permissions so that each user type sees only the content and features appropriate to their role.

#### Acceptance Criteria

1. THE Platform SHALL enforce role-based access control for all protected routes and API endpoints using the roles: Guest, Cub_Scout, Boy_Scout, Senior_Scout, Rover_Scout, Adult_Leader, and Council_Admin, enforced both at the frontend (route guards) and backend (Supabase Row Level Security policies).
2. WHILE a Guest is authenticated, THE Platform SHALL restrict access to one introductory Challenge and view-only Heritage Site content, hiding navigation items for Trails, Service Missions, and Leaderboards.
3. WHILE a Cub_Scout is authenticated, THE Platform SHALL display simplified Trail views (shorter descriptions, fewer map details) and only Challenges tagged as difficulty level "Easy."
4. WHILE a Boy_Scout is authenticated, THE Platform SHALL grant full access to all Trails, Challenges of all difficulty levels, and Service Missions.
5. WHILE a Senior_Scout is authenticated, THE Platform SHALL grant full access and display the "Create Group Trail Attempt" action on Trail pages.
6. WHILE a Rover_Scout is authenticated, THE Platform SHALL grant full access, display the Review Queue for Submissions from Cub_Scout and Boy_Scout users, and enable the mentoring panel listing Cub_Scout and Boy_Scout members in the same council.
7. WHILE an Adult_Leader is authenticated, THE Platform SHALL allow verification of Service Logs and Submissions only for members belonging to the same troop/unit, and display a unit member progress view.
8. WHILE a Council_Admin is authenticated, THE Platform SHALL grant full administrative access to all management dashboards including content, users, analytics, and partner management.
9. IF an unauthenticated or unauthorized user attempts to access a protected route or API endpoint, THEN THE Platform SHALL deny access with a 403 Forbidden response and redirect frontend users to the login page.

---

### Requirement 4: Digital Passport (User Profile)

**User Story:** As a participant, I want a personal profile page so that I can see my accomplishments and progress at a glance.

#### Acceptance Criteria

1. THE Platform SHALL display a Digital Passport for each authenticated user showing: visited Heritage Sites (count and list of site names), completed Challenges (count and list of challenge names), total verified service hours (displayed as whole hours and minutes), earned Badges (count and badge icons), accumulated points (integer value), and current leaderboard rank (numeric position). WHEN any field has no data, THE Platform SHALL display a zero count or empty list for that field.
2. WHEN a user completes a Challenge or earns a Badge, THE Platform SHALL update the Digital Passport within 5 seconds without requiring a page refresh.
3. THE Platform SHALL allow users to set a display name between 3 and 30 characters (letters, numbers, spaces, and hyphens only) and an optional profile avatar image (JPEG or PNG, maximum 2 MB file size, maximum 512×512 pixels).
4. IF a user submits a display name that does not meet the length or character requirements, THEN THE Platform SHALL reject the input and display an error message indicating the specific validation failure.
5. IF a profile avatar upload fails due to invalid format or exceeding the size limit, THEN THE Platform SHALL reject the upload, retain the current avatar (or default avatar if none was previously set), and display an error message indicating the reason for rejection.

---

### Requirement 5: Interactive Heritage Map

**User Story:** As a participant, I want an interactive map showing all heritage sites so that I can plan my exploration routes.

#### Acceptance Criteria

1. THE Platform SHALL display a pannable and zoomable map showing pin markers for all active Heritage Sites, with initial map load completing within 5 seconds on a 3G connection.
2. WHEN a user taps a pin marker, THE Platform SHALL display a popup with the Heritage Site name, trail affiliation, and lock/unlock status.
3. THE Platform SHALL allow filtering map pins by Trail theme (Foundations of Taguig, Heroes and Patriots, Faith and Culture, Lakeshore Communities, Nature and Environmental Conservation, Modern Taguig, Public Art and Monuments) and SHALL display a message indicating no sites match when a selected filter returns zero results.
4. WHEN a Heritage Site is unlocked by the user, THE Platform SHALL display that pin with a distinct marker icon or color that is different from locked site pins.
5. IF the map data fails to load, THEN THE Platform SHALL display an error message indicating the map is unavailable and provide a retry option.

---

### Requirement 6: QR Code Verification System

**User Story:** As a participant at a heritage site, I want to scan the QR code so that I can verify my presence and unlock site content.

#### Acceptance Criteria

1. WHEN a user activates the scanner, THE Platform SHALL request device camera permission and, upon grant, detect QR codes in the video stream using in-browser scanning within 5 seconds of camera activation.
2. IF the user denies camera permission, THEN THE Platform SHALL display a message explaining that camera access is required for QR scanning and provide instructions to re-enable it in device settings.
3. WHEN a valid, cryptographically signed QR code is scanned, THE Platform SHALL verify the HMAC-SHA256 signature server-side, confirm the Heritage Site identity, and unlock that site's content page within 3 seconds of scan detection.
4. IF a QR code signature verification fails, THEN THE Platform SHALL reject the scan and display an error message indicating the code is invalid or tampered.
5. IF a QR code does not match any registered Heritage Site, THEN THE Platform SHALL display a "Site not found" error.
6. IF the scanner does not detect a QR code within 30 seconds of activation, THEN THE Platform SHALL display a timeout message with a retry option and a suggestion to ensure the QR code is visible and undamaged.
7. THE Platform SHALL log each successful QR scan with timestamp, user identifier, and Heritage Site identifier.
8. IF a user scans a QR code for a Heritage Site they have already unlocked, THEN THE Platform SHALL navigate directly to the site content page without awarding duplicate points or creating a duplicate unlock record.

---

### Requirement 7: Heritage Site Content Pages

**User Story:** As a participant who scanned a QR code, I want to explore rich content about that heritage site so that I can learn about Taguig's history.

#### Acceptance Criteria

1. WHEN a Heritage Site is unlocked, THE Platform SHALL display: a historical write-up (maximum 2000 characters), a photo gallery (1 to 10 images), an optional audio narration player, an optional embedded video, and a historical timeline (1 to 20 entries).
2. IF an optional content section (audio narration or embedded video) has no content configured for a Heritage Site, THEN THE Platform SHALL hide that section without displaying an empty placeholder or error.
3. THE Platform SHALL display a quiz or reflection question (1 to 3 questions) at the end of each Heritage Site content page.
4. WHEN a Council_Admin edits Heritage Site content through the admin interface, THE Platform SHALL update the public content within 60 seconds without requiring code deployment.
5. IF media content (images, audio, or video) fails to load on the Heritage Site content page, THEN THE Platform SHALL display a fallback message indicating the content is temporarily unavailable while keeping the remaining page content accessible.
6. THE Platform SHALL render the Heritage Site content page to first meaningful paint within 4 seconds on a 3G connection.

---

### Requirement 8: Heritage Discovery Trails

**User Story:** As a participant, I want themed trails grouping related sites so that I can follow a structured exploration path.

#### Acceptance Criteria

1. THE Platform SHALL organize Heritage Sites into themed Trails with the following default themes: Foundations of Taguig, Heroes and Patriots, Faith and Culture, Lakeshore Communities, Nature and Environmental Conservation, Modern Taguig, and Public Art and Monuments.
2. WHEN a user opens a Trail page, THE Platform SHALL display: a Trail overview description (maximum 500 characters), a map showing only that Trail's sites, a progress bar indicating the percentage of Heritage Sites unlocked out of the total Heritage Sites in that Trail, and a list of Heritage Sites showing each site as either locked or unlocked.
3. WHEN a user unlocks all Heritage Sites in a Trail, THE Platform SHALL mark that Trail as completed and award the user Trail completion bonus points equal to 50 points per Trail completed.
4. WHEN a Council_Admin creates a new Trail, THE Platform SHALL allow assigning a minimum of 2 and a maximum of 30 existing Heritage Sites to that Trail.
5. IF a Council_Admin attempts to save a Trail with fewer than 2 Heritage Sites assigned, THEN THE Platform SHALL prevent saving and display an error message indicating the minimum site requirement is not met.

---

### Requirement 9: Heritage Challenges and Missions

**User Story:** As a participant, I want engaging challenges at each site so that I can earn points while learning.

#### Acceptance Criteria

1. THE Platform SHALL support the following Challenge types per Heritage Site: trivia quiz, observation task, photo documentation upload, puzzle, reflection journal entry, short local-interview submission, and storytelling submission.
2. WHILE a Cub_Scout is accessing Challenges, THE Platform SHALL present a simplified version that reduces the number of trivia questions to no more than 3, limits text response length to 200 characters, and uses multiple-choice format instead of free-text where applicable.
3. WHILE a Boy_Scout, Senior_Scout, or Rover_Scout is accessing Challenges, THE Platform SHALL present the standard difficulty version with up to 5 trivia questions and text responses up to 500 characters.
4. WHEN a user submits a Challenge response that requires review (photo upload, interview, storytelling, reflection journal), THE Platform SHALL place the Submission in the Review Queue with status "pending."
5. WHEN a user submits a photo documentation upload, THE Platform SHALL accept only JPEG or PNG files with a maximum file size of 5 MB and a minimum resolution of 480×480 pixels.
6. IF a user submits a photo that exceeds 5 MB or is in an unsupported format, THEN THE Platform SHALL reject the upload, display an error message indicating the size or format constraint violated, and retain any accompanying text the user entered.
7. WHEN a user submits a trivia quiz or puzzle response, THE Platform SHALL evaluate it and display the result within 3 seconds of submission, awarding the designated points for each correct answer.
8. WHEN an Adult_Leader or Council_Admin approves a pending Submission, THE Platform SHALL award the associated points and mark the Challenge as completed.
9. WHEN an Adult_Leader or Council_Admin rejects a pending Submission, THE Platform SHALL notify the user with a reason (minimum 10 characters) and allow resubmission up to a maximum of 3 attempts per Challenge.
10. IF a user has reached the maximum resubmission attempts for a Challenge, THEN THE Platform SHALL mark the Challenge as "failed" and prevent further submissions for that Challenge.

---

### Requirement 10: Community Service Integration

**User Story:** As a participant, I want to log and verify community service hours so that I can build my service record.

#### Acceptance Criteria

1. THE Platform SHALL link each Trail to one or more Service Missions (clean-up drives, tree planting, waste segregation, heritage documentation, oral history collection, environmental campaigns).
2. WHEN a user logs service hours, THE Platform SHALL require: a description of the activity (between 20 and 500 characters), duration in hours (between 0.5 and 24 hours in 0.5-hour increments), date performed (not in the future), and an optional photo proof upload (JPEG or PNG, maximum 5 MB).
3. WHEN a Service Log is submitted, THE Platform SHALL place it in the Review Queue with status "pending verification."
4. WHEN an Adult_Leader or Council_Admin verifies a Service Log, THE Platform SHALL add the verified hours to the user's Digital Passport running total and award 10 points per verified hour.
5. IF an Adult_Leader or Council_Admin rejects a Service Log, THEN THE Platform SHALL notify the user with a reason (minimum 10 characters) and allow resubmission up to a maximum of 3 attempts per Service Log.
6. IF a user has reached the maximum resubmission attempts for a Service Log, THEN THE Platform SHALL mark the Service Log as "rejected" and prevent further resubmissions.
7. THE Platform SHALL display verified service hours as a running total on the Digital Passport, showing total hours rounded to one decimal place.

---

### Requirement 11: Digital Recognition and Achievement System

**User Story:** As a participant, I want to earn badges and climb leaderboards so that I feel motivated to keep exploring.

#### Acceptance Criteria

1. THE Platform SHALL award points for: completed Challenges (50 points each), verified service hours (10 points per hour, maximum 500 points per calendar month), Trail completions (100 points per Trail), and event participation (25 points per event attended).
2. WHEN a user meets the defined criteria for a Badge, THE Platform SHALL award the corresponding Badge. Badge criteria are: Heritage Explorer (visit 5 heritage sites), History Detective (complete 3 history-related Challenges), Community Volunteer (log 20 verified service hours), Environmental Steward (complete 3 environment-themed Challenges), Trail Conqueror (complete all Trails in a district), Scout Ambassador (invite 5 users who each complete at least 1 Challenge), Cultural Guardian (complete 5 culture-related Challenges), and ScoutChase Champion (accumulate 1000 total points).
3. WHEN a user earns a Badge, THE Platform SHALL generate a downloadable digital certificate in PNG or PDF format, with a maximum file size of 5 MB, containing the user's name, badge name, and date earned.
4. THE Platform SHALL display Leaderboards filterable by: individual, patrol/troop, school, and Rover Circle/Senior Outfit, showing the top 100 entries per category ranked by total points in descending order, with ties broken by the earlier date of last point earned.
5. WHEN points or Badge status change for any user, THE Platform SHALL update the affected Leaderboard entries within 5 seconds using Supabase Realtime subscriptions.
6. IF certificate generation fails, THEN THE Platform SHALL display an error message indicating the failure and allow the user to retry the download without losing the earned Badge record.

---

### Requirement 12: Membership Recruitment and Retention

**User Story:** As a Council Admin, I want the platform to recruit new Scouts so that BSP membership grows.

#### Acceptance Criteria

1. THE Platform SHALL display a public-facing "Join Scouting" page accessible without authentication that includes at minimum: a description of BSP Scouting, a list of local units with their meeting locations and contact information, and a call-to-action to begin the introductory Challenge.
2. WHEN a Guest completes the introductory Challenge, THE Platform SHALL display a "Ready to become a Scout?" prompt within 3 seconds of completion, showing the name and location of the nearest local unit, a contact method for that unit, and instructions for the next registration step.
3. THE Platform SHALL support a "Bring-a-Friend" referral system where each registered user can generate a unique referral link, and WHEN a new user registers through that link within 90 days of generation, THE Platform SHALL attribute the registration to the referring user.
4. IF a new registration is associated with more than one referral source, THEN THE Platform SHALL attribute the registration to the referral link used during the actual registration session.
5. WHEN a Council_Admin creates a community ScoutChase event or school heritage-challenge event, THE Platform SHALL track the number of participants who joined the event, the number who completed the event challenge, and the number of new registrations attributed to that event.
6. WHEN a Council_Admin views recruitment data, THE Platform SHALL display a summary including: total referrals per user, total new registrations per event, and guest-to-Scout conversion count for a selected date range of up to 365 days.

---

### Requirement 13: Partnerships and Stakeholder Engagement

**User Story:** As a visitor, I want to see supporting organizations so that I understand the initiative's backing.

#### Acceptance Criteria

1. THE Platform SHALL display a public Partners page listing all supporting organizations with their logo (maximum file size of 500 KB, displayed at a uniform height of 80px with proportional width), name, and description blurb (maximum 200 characters), ordered alphabetically by organization name.
2. WHEN a Council_Admin adds, edits, or removes a Partner, THE Platform SHALL reflect the change on the public Partners page within 60 seconds without code deployment.
3. IF a Council_Admin submits a Partner entry with a missing name, missing logo, or a description blurb exceeding 200 characters, THEN THE Platform SHALL reject the submission and display an error message indicating which fields are invalid.

---

### Requirement 14: Admin Dashboard — Content Management

**User Story:** As a Council Admin, I want to manage all platform content so that the experience stays current without developer involvement.

#### Acceptance Criteria

1. WHILE a Council_Admin is authenticated, THE Platform SHALL provide a content editor for Heritage Sites supporting rich-text write-ups (maximum 10,000 characters), photo uploads (maximum 10 MB per file, formats: JPEG, PNG), audio uploads (maximum 50 MB per file), video uploads (maximum 200 MB per file), and timeline entries (maximum 50 entries per site), with a preview function before publishing.
2. WHILE a Council_Admin is authenticated, THE Platform SHALL allow creation, editing, and deletion of Trails and assignment of up to 50 Heritage Sites per Trail via a drag-and-drop or list-based ordering interface.
3. WHILE a Council_Admin is authenticated, THE Platform SHALL allow creation and configuration of Challenges with type selection from a predefined list and difficulty level selection (Easy, Medium, Hard).
4. WHILE a Council_Admin is authenticated, THE Platform SHALL allow creation and management of Service Missions linked to Trails.
5. WHILE a Council_Admin is authenticated, THE Platform SHALL allow creation, editing, and manual awarding of Badges to individual users or groups of users by selection.
6. WHILE a Council_Admin is authenticated, THE Platform SHALL allow management of user accounts including role assignment and account deactivation, with changes taking effect within 60 seconds.
7. WHILE a Council_Admin is authenticated, THE Platform SHALL allow publishing of Announcements (maximum 2,000 characters) to the notification feed, with published content visible to end users within 60 seconds.
8. IF a Council_Admin attempts to delete a Trail, Heritage Site, or Challenge that is referenced by other content, THEN THE Platform SHALL display a dependency warning listing the affected items and require explicit confirmation before proceeding.
9. WHEN a Council_Admin saves, publishes, or deletes any content item, THE Platform SHALL display a success or failure confirmation message within 3 seconds indicating the outcome of the operation.
10. IF a Council_Admin uploads a media file that exceeds the allowed size limit or uses an unsupported format, THEN THE Platform SHALL reject the upload and display an error message indicating the file constraint that was violated.

---

### Requirement 15: Admin Dashboard — Analytics and Monitoring

**User Story:** As a Council Admin, I want analytics so that I can monitor platform usage and measure impact.

#### Acceptance Criteria

1. WHILE a Council_Admin is authenticated, THE Platform SHALL display an analytics dashboard showing: total registered participants (segmented by role), number of active Heritage Sites, total QR scans (with daily and weekly trend charts), completed Challenges count, pending Review Queue items count, total verified service hours, new membership sign-ups (per week and cumulative), retention rate (percentage of users active in the last 30 days out of total registered), partner organization count, and average participant satisfaction rating.
2. WHEN a Council_Admin selects a date range filter (up to 365 days), THE Platform SHALL recalculate and display all analytics metrics for the selected date range within 10 seconds.
3. WHEN a Council_Admin requests a data export, THE Platform SHALL generate a CSV file containing the currently displayed analytics data and initiate a download within 10 seconds.
4. THE Platform SHALL update analytics dashboard data within 60 seconds of underlying data changes.
5. IF analytics data fails to load, THEN THE Platform SHALL display an error message for the affected metric while continuing to display successfully loaded metrics.

---

### Requirement 16: Notifications and Announcements

**User Story:** As a participant, I want to receive notifications about new content so that I stay informed and engaged.

#### Acceptance Criteria

1. THE Platform SHALL display a notifications feed showing the most recent 50 items, ordered by date descending, including: Announcements, new Trail launches, upcoming events, and new Badge availability.
2. WHEN a Council_Admin publishes an Announcement, THE Platform SHALL make it visible to all targeted users within 60 seconds.
3. WHEN a user's Submission or Service Log is approved or rejected, THE Platform SHALL send a notification to that user within 60 seconds including the item name and the approval/rejection status.
4. THE Platform SHALL track read/unread state for each notification per user and display an unread count badge on the notifications icon.
5. WHEN a user marks a notification as read, THE Platform SHALL update the unread count immediately.
6. IF a user is offline when a notification is generated, THEN THE Platform SHALL queue the notification and deliver it when the user next opens the application.

---

### Requirement 17: Group Trail Attempts

**User Story:** As a Senior Scout, I want to lead group trail explorations so that I can guide my peers through heritage sites together.

#### Acceptance Criteria

1. WHILE a Senior_Scout is authenticated, THE Platform SHALL allow creation of a group Trail attempt by inviting between 1 and 9 other registered users, for a maximum group size of 10 members including the leader.
2. WHEN an invited user receives a group Trail attempt invitation, THE Platform SHALL require the invited user to accept the invitation before being added as a participating member of the group attempt.
3. IF an invited user declines or does not respond to the invitation within 72 hours, THEN THE Platform SHALL mark that invitation as expired and notify the group leader.
4. WHILE a group Trail attempt is active, THE Platform SHALL display the count of Heritage Sites unlocked by each individual member and the count of Heritage Sites unlocked by at least one group member out of the total Heritage Sites in the Trail.
5. WHEN every Heritage Site in the Trail has been unlocked by at least one participating member of the group, THE Platform SHALL mark the group attempt as completed for all participating members.
6. IF the group leader leaves or is removed from a group Trail attempt, THEN THE Platform SHALL cancel the group attempt and notify all remaining participating members.

---

### Requirement 18: Rover Scout Mentoring

**User Story:** As a Rover Scout, I want to mentor younger Scouts so that I can fulfill my service commitment while supporting their development.

#### Acceptance Criteria

1. WHILE a Rover_Scout is authenticated, THE Platform SHALL display a paginated list (maximum 50 entries per page) of Cub_Scout and Boy_Scout users who are active members within the same council as the Rover_Scout.
2. WHEN a Rover_Scout reviews a Submission in the Review Queue, THE Platform SHALL allow adding a feedback comment between 1 and 1000 characters in length, visible to the submitting user.
3. WHILE a Rover_Scout is moderating, THE Platform SHALL restrict moderation to Submissions from Cub_Scout and Boy_Scout users only.
4. IF a Rover_Scout attempts to moderate a Submission from a Senior_Scout, another Rover_Scout, or an Adult_Leader, THEN THE Platform SHALL reject the action and display an error message indicating that moderation is restricted to Cub_Scout and Boy_Scout submissions.
5. IF a Rover_Scout submits feedback with fewer than 1 character or more than 1000 characters, THEN THE Platform SHALL reject the submission and display an error message indicating the permitted character length range.
6. IF no Cub_Scout or Boy_Scout users are active within the Rover_Scout's council, THEN THE Platform SHALL display an empty-state message indicating that no mentees are currently available.

---

### Requirement 19: Mobile-First Responsive Design

**User Story:** As a participant using a mobile phone, I want the platform to work well on my device so that I can use it in the field.

#### Acceptance Criteria

1. THE Platform SHALL render all pages in a mobile-first responsive layout that adapts to screen widths from 320px to 1920px without requiring horizontal scrolling and without clipping or overlapping interactive content.
2. THE Platform SHALL function as a Progressive Web App (PWA) installable on mobile devices with offline access to previously loaded Heritage Site text content and images.
3. IF the user attempts to access Heritage Site content that has not been previously loaded while offline, THEN THE Platform SHALL display an indication that the content is unavailable offline and requires a network connection.
4. THE Platform SHALL use tap targets with a minimum size of 44×44 pixels for all interactive elements.
5. THE Platform SHALL load the initial page content to Largest Contentful Paint within 3 seconds on a 3G mobile connection (1.6 Mbps download speed).

---

### Requirement 20: Accessibility

**User Story:** As a user with accessibility needs, I want the platform to be usable with assistive technology so that I can participate fully.

#### Acceptance Criteria

1. THE Platform SHALL meet WCAG 2.1 Level AA contrast ratios (minimum 4.5:1 for normal text, 3:1 for large text) for all text and interactive elements.
2. THE Platform SHALL provide alternative text for all images and icons that describes the content or function of the element (maximum 125 characters), and SHALL use empty alt attributes for purely decorative images.
3. THE Platform SHALL support keyboard navigation for all interactive features with a visible focus indicator (minimum 2px outline) and SHALL prevent keyboard traps on any element.
4. THE Platform SHALL use semantic HTML and ARIA attributes to support screen reader navigation.
5. THE Platform SHALL use a minimum body font size of 16px with scalable text that remains readable without content loss or horizontal scrolling when zoomed up to 200% in the browser.
6. THE Platform SHALL ensure all interactive elements (buttons, links, form controls) have a minimum touch/click target area of 44×44 CSS pixels.

---

### Requirement 21: Security

**User Story:** As a platform operator, I want the system to be secure so that user data is protected and QR codes cannot be spoofed.

#### Acceptance Criteria

1. THE Platform SHALL sign each QR code using HMAC-SHA256 with a server-side secret key of at least 256 bits, and SHALL verify the signature server-side before granting any points or completing any scan action.
2. THE Platform SHALL enforce Row Level Security (RLS) policies on all Supabase database tables to restrict data access by user role, ensuring that no user can read or modify records belonging to another user unless their role explicitly grants cross-user access.
3. THE Platform SHALL reject user-submitted text content that contains HTML tags or script fragments, truncate text fields exceeding 2000 characters, and strip or escape any markup before storage and rendering.
4. THE Platform SHALL restrict uploaded files to image types (JPEG, PNG, WebP) with a maximum file size of 5 MB per upload, and store them in Supabase Storage with access policies that allow only the uploading user and admin roles to view or delete the file.
5. IF a user attempts to access a resource beyond their role permissions, THEN THE Platform SHALL return a 403 Forbidden response and log the attempt including the user identifier and the requested resource.
6. IF a QR code scan request contains a QR code that has already been redeemed by the same user, THEN THE Platform SHALL reject the request and return a response indicating the code has already been used.
7. THE Platform SHALL classify accounts belonging to users under the age of 13 as minor accounts and SHALL exclude minor accounts from any public leaderboard display that reveals personally identifiable information beyond a display name.

---

### Requirement 22: Scalability and Replicability

**User Story:** As a BSP national organization member, I want the platform to be replicable so that other councils can adopt it.

#### Acceptance Criteria

1. THE Platform SHALL use environment-based configuration for council-specific branding (council name, logo, and color scheme), heritage site data, and content so that a new council deployment requires only configuration changes and no modifications to application source code.
2. THE Platform SHALL separate heritage content from application logic using a database-driven content model so that heritage site entries, descriptions, and media can be managed independently of application code.
3. WHILE serving 500 or more concurrent authenticated or anonymous user sessions, THE Platform SHALL maintain page load times of 3 seconds or less and API response times of 2 seconds or less.
4. IF the number of concurrent user sessions exceeds 500, THEN THE Platform SHALL continue serving existing sessions without data loss and SHALL return an informative message to new users indicating temporary capacity limits.

---

### Requirement 23: QR Code Generation and Management

**User Story:** As a Council Admin, I want to generate and manage QR codes so that I can deploy them to physical heritage sites.

#### Acceptance Criteria

1. WHEN a Council_Admin creates a new Heritage Site, THE Platform SHALL generate a unique, cryptographically signed QR code for that site.
2. THE Platform SHALL provide downloadable QR code images in PNG format at minimum 300 DPI with minimum dimensions of 1200×1200 pixels.
3. WHEN a Council_Admin deactivates a Heritage Site, THE Platform SHALL invalidate the associated QR code so that scanning it returns a "site inactive" message.
4. WHEN a Council_Admin requests regeneration of a QR code for an existing Heritage Site, THE Platform SHALL generate a new cryptographically signed QR code and invalidate the previously associated QR code within 5 seconds.
5. IF QR code generation fails, THEN THE Platform SHALL display an error message indicating the failure reason and retain the Heritage Site record without an associated QR code.

---

### Requirement 24: Content Parsing and Display

**User Story:** As a Council Admin, I want to write rich heritage content so that site pages are informative and engaging.

#### Acceptance Criteria

1. THE Platform SHALL parse Heritage Site content stored in rich-text JSON format and render it as valid HTML5 on the Heritage Site content page.
2. WHEN the Platform parses rich-text content, THE Platform SHALL produce semantic HTML preserving headings (h1–h4), paragraphs, ordered lists, unordered lists, bold, italic, hyperlinks, and embedded media references (images and videos).
3. WHEN a Council_Admin saves Heritage Site content edits, THE Platform SHALL convert the HTML back into the stored rich-text JSON format within 2 seconds.
4. THE Platform SHALL ensure that parsing stored rich-text JSON to HTML and then converting that HTML back to rich-text JSON produces a structurally identical DOM output when re-parsed (round-trip property).
5. THE Platform SHALL sanitize all rendered Heritage Site HTML output to remove executable scripts and disallowed attributes before displaying to users.
6. IF the Platform encounters malformed or unparseable rich-text JSON for a Heritage Site, THEN THE Platform SHALL display an error message indicating the content could not be loaded and SHALL preserve the stored content unchanged.
7. THE Platform SHALL accept Heritage Site rich-text content up to 500,000 characters in stored JSON length and SHALL reject content exceeding this limit with an error message indicating the size constraint.
