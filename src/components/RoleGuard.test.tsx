import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock supabase before importing anything that depends on it
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn().mockResolvedValue({}),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
}))

import { RoleGuard } from './RoleGuard'
import { useAuthStore } from '@/stores/auth'
import type { UserProfile } from '@/stores/auth'

const mockProfile: UserProfile = {
  id: 'user-1',
  full_name: 'Test User',
  display_name: null,
  age: 14,
  role: 'Boy_Scout',
  scout_section: 'Boy Scout',
  troop_unit_number: 'T123',
  school: null,
  avatar_url: null,
  guardian_email: null,
  council_id: null,
  total_points: 0,
  total_service_hours: 0,
}

describe('RoleGuard', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
  })

  it('renders children when user role is in allowedRoles', () => {
    useAuthStore.setState({ user: mockProfile, isAuthenticated: true })

    render(
      <RoleGuard allowedRoles={['Boy_Scout', 'Senior_Scout']}>
        <div data-testid="protected">Protected Content</div>
      </RoleGuard>
    )

    expect(screen.getByTestId('protected')).toBeInTheDocument()
  })

  it('renders fallback when user role is not in allowedRoles', () => {
    useAuthStore.setState({ user: mockProfile, isAuthenticated: true })

    render(
      <RoleGuard
        allowedRoles={['Council_Admin']}
        fallback={<div data-testid="fallback">Access Denied</div>}
      >
        <div data-testid="protected">Protected Content</div>
      </RoleGuard>
    )

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
    expect(screen.getByTestId('fallback')).toBeInTheDocument()
  })

  it('renders nothing when user is not authenticated and no fallback', () => {
    render(
      <RoleGuard allowedRoles={['Boy_Scout']}>
        <div data-testid="protected">Protected Content</div>
      </RoleGuard>
    )

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
  })

  it('renders fallback when user is not authenticated', () => {
    render(
      <RoleGuard
        allowedRoles={['Boy_Scout']}
        fallback={<div data-testid="fallback">Please login</div>}
      >
        <div data-testid="protected">Protected Content</div>
      </RoleGuard>
    )

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
    expect(screen.getByTestId('fallback')).toBeInTheDocument()
  })

  it('works with Council_Admin having access to admin features', () => {
    const adminUser: UserProfile = { ...mockProfile, role: 'Council_Admin' }
    useAuthStore.setState({ user: adminUser, isAuthenticated: true })

    render(
      <RoleGuard allowedRoles={['Council_Admin']}>
        <div data-testid="admin">Admin Panel</div>
      </RoleGuard>
    )

    expect(screen.getByTestId('admin')).toBeInTheDocument()
  })

  it('denies Guest access to trails content', () => {
    const guestUser: UserProfile = { ...mockProfile, role: 'Guest' }
    useAuthStore.setState({ user: guestUser, isAuthenticated: true })

    render(
      <RoleGuard allowedRoles={['Cub_Scout', 'Boy_Scout', 'Senior_Scout', 'Rover_Scout', 'Adult_Leader', 'Council_Admin']}>
        <div data-testid="trails">Trails</div>
      </RoleGuard>
    )

    expect(screen.queryByTestId('trails')).not.toBeInTheDocument()
  })
})
