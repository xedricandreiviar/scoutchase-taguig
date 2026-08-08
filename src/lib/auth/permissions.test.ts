import { describe, it, expect } from 'vitest'
import { hasAccess, getVisibleNavItems, PERMISSIONS } from './permissions'
import type { UserRole } from '@/stores/auth'

const ALL_ROLES: UserRole[] = [
  'Guest',
  'Cub_Scout',
  'Boy_Scout',
  'Senior_Scout',
  'Rover_Scout',
  'Adult_Leader',
  'Council_Admin',
]

describe('hasAccess', () => {
  it('grants Guest access to /app/passport', () => {
    expect(hasAccess('Guest', '/app/passport')).toBe(true)
  })

  it('denies Guest access to /app/trails', () => {
    expect(hasAccess('Guest', '/app/trails')).toBe(false)
  })

  it('denies Guest access to /app/leaderboard', () => {
    expect(hasAccess('Guest', '/app/leaderboard')).toBe(false)
  })

  it('grants Cub_Scout access to /app/trails', () => {
    expect(hasAccess('Cub_Scout', '/app/trails')).toBe(true)
  })

  it('denies Cub_Scout access to /app/group-trails', () => {
    expect(hasAccess('Cub_Scout', '/app/group-trails')).toBe(false)
  })

  it('grants Boy_Scout access to /app/service', () => {
    expect(hasAccess('Boy_Scout', '/app/service')).toBe(true)
  })

  it('denies Guest access to /app/service', () => {
    expect(hasAccess('Guest', '/app/service')).toBe(false)
  })

  it('grants Senior_Scout access to /app/group-trails', () => {
    expect(hasAccess('Senior_Scout', '/app/group-trails')).toBe(true)
  })

  it('grants Rover_Scout access to /app/mentoring', () => {
    expect(hasAccess('Rover_Scout', '/app/mentoring')).toBe(true)
  })

  it('denies Boy_Scout access to /app/mentoring', () => {
    expect(hasAccess('Boy_Scout', '/app/mentoring')).toBe(false)
  })

  it('grants Council_Admin access to all admin routes', () => {
    const adminRoutes = Object.keys(PERMISSIONS).filter((r) => r.startsWith('/admin'))
    for (const route of adminRoutes) {
      expect(hasAccess('Council_Admin', route)).toBe(true)
    }
  })

  it('denies non-admin roles access to admin routes', () => {
    const nonAdminRoles: UserRole[] = ['Guest', 'Cub_Scout', 'Boy_Scout', 'Senior_Scout', 'Rover_Scout', 'Adult_Leader']
    for (const role of nonAdminRoles) {
      expect(hasAccess(role, '/admin/dashboard')).toBe(false)
    }
  })

  it('handles dynamic route segments via prefix matching', () => {
    // /app/trails/:trailId should match /app/trails permission
    expect(hasAccess('Boy_Scout', '/app/trails/some-trail-id')).toBe(true)
    expect(hasAccess('Guest', '/app/trails/some-trail-id')).toBe(false)
  })

  it('returns true for unknown/public routes', () => {
    // Routes not in the PERMISSIONS map are considered public
    expect(hasAccess('Guest', '/join-scouting')).toBe(true)
    expect(hasAccess('Guest', '/partners')).toBe(true)
  })
})

describe('getVisibleNavItems', () => {
  it('returns limited items for Guest', () => {
    const items = getVisibleNavItems('Guest')
    const paths = items.map((i) => i.path)
    expect(paths).toContain('/app/passport')
    expect(paths).toContain('/app/map')
    expect(paths).toContain('/app/scan')
    expect(paths).not.toContain('/app/trails')
    expect(paths).not.toContain('/app/service')
    expect(paths).not.toContain('/app/leaderboard')
  })

  it('returns all nav items for Council_Admin', () => {
    const items = getVisibleNavItems('Council_Admin')
    expect(items.length).toBeGreaterThan(getVisibleNavItems('Guest').length)
  })

  it('does not show mentoring to Boy_Scout', () => {
    const items = getVisibleNavItems('Boy_Scout')
    const paths = items.map((i) => i.path)
    expect(paths).not.toContain('/app/mentoring')
  })

  it('shows group-trails only to Senior_Scout and above', () => {
    expect(getVisibleNavItems('Cub_Scout').map((i) => i.path)).not.toContain('/app/group-trails')
    expect(getVisibleNavItems('Boy_Scout').map((i) => i.path)).not.toContain('/app/group-trails')
    expect(getVisibleNavItems('Senior_Scout').map((i) => i.path)).toContain('/app/group-trails')
    expect(getVisibleNavItems('Rover_Scout').map((i) => i.path)).toContain('/app/group-trails')
  })
})

describe('PERMISSIONS map completeness', () => {
  it('all admin routes require Council_Admin', () => {
    const adminRoutes = Object.entries(PERMISSIONS).filter(([key]) => key.startsWith('/admin'))
    for (const [, roles] of adminRoutes) {
      expect(roles).toContain('Council_Admin')
      expect(roles).toHaveLength(1) // Only Council_Admin
    }
  })

  it('every role in PERMISSIONS is a valid UserRole', () => {
    for (const roles of Object.values(PERMISSIONS)) {
      for (const role of roles) {
        expect(ALL_ROLES).toContain(role)
      }
    }
  })
})
