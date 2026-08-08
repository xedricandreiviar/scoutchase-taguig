/**
 * ProtectedRoute component that redirects unauthenticated users to the login page,
 * and unauthorized users (wrong role) to the login page with a 403 indication.
 *
 * Requirements: 3.1, 3.9
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore, type UserRole } from '@/stores/auth'
import { hasAccess } from '@/lib/auth/permissions'

export interface ProtectedRouteProps {
  children: React.ReactNode
  /** If provided, restricts access to these specific roles */
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuthStore()
  const location = useLocation()

  // Show nothing while checking auth status to prevent flash
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Not authenticated → redirect to login with return path
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // If specific roles are provided, check against them
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" state={{ unauthorized: true }} replace />
  }

  // Check permissions based on the current route path
  if (!hasAccess(user.role, location.pathname)) {
    return <Navigate to="/login" state={{ unauthorized: true }} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
