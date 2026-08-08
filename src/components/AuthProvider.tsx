/**
 * AuthProvider wraps the application and manages auth session state.
 * On mount, it initializes the auth store which checks for existing Supabase sessions
 * and subscribes to auth state changes.
 *
 * Requirements: 2.5, 2.6, 3.1
 */

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return <>{children}</>
}

export default AuthProvider
