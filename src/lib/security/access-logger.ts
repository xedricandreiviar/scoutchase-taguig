/**
 * Unauthorized access attempt logger.
 *
 * Logs failed access attempts including user_id and requested resource.
 * In production, this would log to Supabase or an external logging service.
 *
 * Validates: Requirements 21.5
 */

export interface AccessAttempt {
  /** The user ID who attempted unauthorized access (null if unauthenticated). */
  userId: string | null
  /** The resource path or endpoint that was requested. */
  resource: string
  /** The user's role at the time of the attempt. */
  userRole?: string
  /** ISO timestamp of the attempt. */
  timestamp: string
  /** HTTP status code returned (typically 403). */
  statusCode: number
}

/** In-memory log store for development/testing. In production, replace with persistent storage. */
const accessLog: AccessAttempt[] = []

/**
 * Logs an unauthorized access attempt.
 *
 * Records the user_id and requested resource when a user attempts
 * to access a resource beyond their role permissions.
 *
 * @param userId - The authenticated user's ID, or null if unauthenticated.
 * @param resource - The route/endpoint the user attempted to access.
 * @param userRole - The user's current role.
 */
export function logUnauthorizedAccess(
  userId: string | null,
  resource: string,
  userRole?: string
): void {
  const attempt: AccessAttempt = {
    userId,
    resource,
    userRole,
    timestamp: new Date().toISOString(),
    statusCode: 403,
  }

  // Store in memory for development
  accessLog.push(attempt)

  // Console log for observability
  console.warn(
    `[SECURITY] Unauthorized access attempt: user=${userId ?? 'anonymous'} role=${userRole ?? 'none'} resource=${resource}`
  )
}

/**
 * Returns the current access log entries.
 * Used primarily for testing and development monitoring.
 */
export function getAccessLog(): ReadonlyArray<AccessAttempt> {
  return accessLog
}

/**
 * Clears the in-memory access log.
 * Used for testing cleanup.
 */
export function clearAccessLog(): void {
  accessLog.length = 0
}
