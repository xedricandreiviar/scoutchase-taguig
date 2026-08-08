import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

export type UserRole =
  | 'Guest'
  | 'Cub_Scout'
  | 'Boy_Scout'
  | 'Senior_Scout'
  | 'Rover_Scout'
  | 'Adult_Leader'
  | 'Council_Admin'

export interface UserProfile {
  id: string
  full_name: string
  display_name: string | null
  age: number
  role: UserRole
  scout_section: string | null
  troop_unit_number: string | null
  school: string | null
  avatar_url: string | null
  guardian_email: string | null
  council_id: string | null
  total_points: number
  total_service_hours: number
}

interface LoginAttempts {
  count: number
  lastAttemptAt: number
  lockedUntil: number | null
}

interface AuthState {
  user: UserProfile | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  sessionExpired: boolean
  loginAttempts: Record<string, LoginAttempts>
  setUser: (user: UserProfile | null) => void
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  setSessionExpired: (expired: boolean) => void
  logout: () => Promise<void>
  login: (email: string, password: string) => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
  initialize: () => Promise<void>
}

const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const MAX_FAILED_ATTEMPTS = 5

function getLockedMessage(lockedUntil: number): string {
  const remainingMs = lockedUntil - Date.now()
  const remainingMinutes = Math.ceil(remainingMs / 60000)
  return `Account is locked due to too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  sessionExpired: false,
  loginAttempts: {},

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  setSessionExpired: (sessionExpired) => set({ sessionExpired }),

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, isAuthenticated: false, sessionExpired: false })
  },

  login: async (email: string, password: string) => {
    const state = get()
    const normalizedEmail = email.trim().toLowerCase()

    // Check if account is locked
    const attempts = state.loginAttempts[normalizedEmail]
    if (attempts?.lockedUntil && Date.now() < attempts.lockedUntil) {
      return { error: getLockedMessage(attempts.lockedUntil) }
    }

    // If lockout has expired, reset attempts
    if (attempts?.lockedUntil && Date.now() >= attempts.lockedUntil) {
      set((s) => ({
        loginAttempts: {
          ...s.loginAttempts,
          [normalizedEmail]: { count: 0, lastAttemptAt: Date.now(), lockedUntil: null },
        },
      }))
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error) {
      // Track failed attempt
      const currentAttempts = get().loginAttempts[normalizedEmail]
      const newCount = (currentAttempts?.count ?? 0) + 1
      const lockedUntil = newCount >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : null

      set((s) => ({
        loginAttempts: {
          ...s.loginAttempts,
          [normalizedEmail]: {
            count: newCount,
            lastAttemptAt: Date.now(),
            lockedUntil,
          },
        },
      }))

      if (lockedUntil) {
        return { error: getLockedMessage(lockedUntil) }
      }

      // Generic error message per Requirement 2.2
      return { error: 'Invalid email or password' }
    }

    if (data.session) {
      // Reset attempts on successful login
      set((s) => ({
        session: data.session,
        isAuthenticated: true,
        sessionExpired: false,
        loginAttempts: {
          ...s.loginAttempts,
          [normalizedEmail]: { count: 0, lastAttemptAt: Date.now(), lockedUntil: null },
        },
      }))

      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .single()

      if (profile) {
        set({ user: profile as UserProfile })
      }
    }

    return { error: null }
  },

  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      return { error: error.message }
    }

    return { error: null }
  },

  updatePassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      return { error: error.message }
    }

    return { error: null }
  },

  initialize: async () => {
    set({ isLoading: true })

    // Get the current session
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      set({ session, isAuthenticated: true })

      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        set({ user: profile as UserProfile })
      }
    }

    set({ isLoading: false })

    // Listen for auth state changes (session expiry, token refresh)
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        if (!session) {
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            sessionExpired: true,
          })
        } else {
          set({ session })
        }
      }

      if (event === 'SIGNED_IN' && session) {
        set({ session, isAuthenticated: true, sessionExpired: false })
      }
    })
  },
}))
