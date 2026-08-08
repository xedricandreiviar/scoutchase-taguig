/**
 * RoleGuard component that conditionally renders children based on user role.
 * If the user's role is not in the allowedRoles list, renders the fallback or nothing.
 *
 * Requirements: 3.1, 3.9
 */

import { useAuthStore, type UserRole } from '@/stores/auth'

export interface RoleGuardProps {
  allowedRoles: UserRole[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
  const user = useAuthStore((state) => state.user)

  // If no user is logged in, deny access
  if (!user) {
    return <>{fallback}</>
  }

  // Check if the user's role is in the allowed roles
  if (!allowedRoles.includes(user.role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

export default RoleGuard
