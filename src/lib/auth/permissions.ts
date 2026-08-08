/**
 * Role-resource permission map defining which roles can access which routes/resources.
 * Implements RBAC requirements 3.1–3.9.
 */

import type { UserRole } from '@/stores/auth'

/**
 * Permission map: route/resource path pattern → allowed roles.
 * Routes not listed here are considered public.
 */
export const PERMISSIONS: Record<string, UserRole[]> = {
  // App routes (authenticated users)
  '/app/passport': ['Guest', 'Cub_Scout', 'Boy_Scout', 'Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin'],
  '/app/map': ['Guest', 'Cub_Scout', 'Boy_Scout', 'Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin'],
  '/app/scan': ['Guest', 'Cub_Scout', 'Boy_Scout', 'Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin'],
  '/app/notifications': ['Guest', 'Cub_Scout', 'Boy_Scout', 'Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin'],

  // Trails - Guest restricted (view-only heritage site content, no full trail access)
  '/app/trails': ['Cub_Scout', 'Boy_Scout', 'Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin'],

  // Challenges - filtered by difficulty per role (Guest gets one introductory only)
  '/app/challenges': ['Guest', 'Cub_Scout', 'Boy_Scout', 'Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin'],

  // Heritage site content - all authenticated roles can view
  '/app/sites': ['Guest', 'Cub_Scout', 'Boy_Scout', 'Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin'],

  // Service missions - not for Guest or Cub_Scout (Cub_Scout gets simplified trails only)
  '/app/service': ['Boy_Scout', 'Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin'],

  // Leaderboard - not for Guest
  '/app/leaderboard': ['Cub_Scout', 'Boy_Scout', 'Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin'],

  // Badges
  '/app/badges': ['Cub_Scout', 'Boy_Scout', 'Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin'],

  // Group trail attempts - Senior Scout and above
  '/app/group-trails': ['Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin'],

  // Mentoring panel - Rover Scout only (plus Council_Admin)
  '/app/mentoring': ['Rover_Scout', 'Council_Admin'],

  // Events
  '/app/events': ['Cub_Scout', 'Boy_Scout', 'Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin'],

  // Referral
  '/app/referral': ['Cub_Scout', 'Boy_Scout', 'Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin'],

  // Review Queue - Rover_Scout (for Cub/Boy), Adult_Leader, Council_Admin
  '/app/review-queue': ['Rover_Scout', 'Adult_Leader', 'Council_Admin'],

  // Admin routes - Council_Admin only
  '/admin/dashboard': ['Council_Admin'],
  '/admin/sites': ['Council_Admin'],
  '/admin/trails': ['Council_Admin'],
  '/admin/challenges': ['Council_Admin'],
  '/admin/missions': ['Council_Admin'],
  '/admin/badges': ['Council_Admin'],
  '/admin/users': ['Council_Admin'],
  '/admin/announcements': ['Council_Admin'],
  '/admin/partners': ['Council_Admin'],
  '/admin/events': ['Council_Admin'],
  '/admin/review-queue': ['Council_Admin'],
  '/admin/qr-codes': ['Council_Admin'],
  '/admin/export': ['Council_Admin'],
}

/**
 * Checks if a user with the given role has access to the specified resource.
 *
 * @param userRole - The role of the current user
 * @param resource - The route/resource path to check (e.g., '/app/trails')
 * @returns true if the role is in the resource's permission set, false otherwise
 */
export function hasAccess(userRole: UserRole, resource: string): boolean {
  // Find the most specific matching permission entry
  // Try exact match first
  const allowedRoles = PERMISSIONS[resource]
  if (allowedRoles) {
    return allowedRoles.includes(userRole)
  }

  // Try prefix matching for dynamic routes (e.g., /app/trails/:trailId matches /app/trails)
  const segments = resource.split('/')
  while (segments.length > 1) {
    segments.pop()
    const prefix = segments.join('/')
    const prefixRoles = PERMISSIONS[prefix]
    if (prefixRoles) {
      return prefixRoles.includes(userRole)
    }
  }

  // No permission entry found - route is either public or not protected
  return true
}

/**
 * Returns the navigation items that should be visible for a given role.
 * Used for filtering navigation menus based on role.
 */
export interface NavItem {
  path: string
  label: string
  icon?: string
}

const APP_NAV_ITEMS: NavItem[] = [
  { path: '/app/passport', label: 'Digital Passport' },
  { path: '/app/map', label: 'Heritage Map' },
  { path: '/app/scan', label: 'QR Scanner' },
  { path: '/app/trails', label: 'Trails' },
  { path: '/app/service', label: 'Service Missions' },
  { path: '/app/leaderboard', label: 'Leaderboard' },
  { path: '/app/badges', label: 'Badges' },
  { path: '/app/group-trails', label: 'Group Trails' },
  { path: '/app/mentoring', label: 'Mentoring' },
  { path: '/app/events', label: 'Events' },
  { path: '/app/referral', label: 'Referral' },
  { path: '/app/notifications', label: 'Notifications' },
]

/**
 * Returns the filtered navigation items visible to the given role.
 */
export function getVisibleNavItems(userRole: UserRole): NavItem[] {
  return APP_NAV_ITEMS.filter((item) => hasAccess(userRole, item.path))
}
