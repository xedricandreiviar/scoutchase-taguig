import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  logUnauthorizedAccess,
  getAccessLog,
  clearAccessLog,
} from './access-logger'

describe('access-logger', () => {
  beforeEach(() => {
    clearAccessLog()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('logs an unauthorized access attempt with user info', () => {
    logUnauthorizedAccess('user-123', '/admin/dashboard', 'Boy_Scout')

    const log = getAccessLog()
    expect(log).toHaveLength(1)
    expect(log[0].userId).toBe('user-123')
    expect(log[0].resource).toBe('/admin/dashboard')
    expect(log[0].userRole).toBe('Boy_Scout')
    expect(log[0].statusCode).toBe(403)
    expect(log[0].timestamp).toBeTruthy()
  })

  it('logs anonymous access attempts with null userId', () => {
    logUnauthorizedAccess(null, '/app/leaderboard')

    const log = getAccessLog()
    expect(log).toHaveLength(1)
    expect(log[0].userId).toBeNull()
    expect(log[0].resource).toBe('/app/leaderboard')
  })

  it('accumulates multiple log entries', () => {
    logUnauthorizedAccess('user-1', '/admin/users', 'Guest')
    logUnauthorizedAccess('user-2', '/admin/badges', 'Cub_Scout')
    logUnauthorizedAccess(null, '/app/trails')

    const log = getAccessLog()
    expect(log).toHaveLength(3)
  })

  it('outputs a console warning for each attempt', () => {
    logUnauthorizedAccess('user-abc', '/admin/sites', 'Boy_Scout')

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('user=user-abc')
    )
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('resource=/admin/sites')
    )
  })

  it('clears the log with clearAccessLog', () => {
    logUnauthorizedAccess('user-1', '/admin/dashboard', 'Guest')
    expect(getAccessLog()).toHaveLength(1)

    clearAccessLog()
    expect(getAccessLog()).toHaveLength(0)
  })

  it('includes ISO timestamp in log entries', () => {
    logUnauthorizedAccess('user-1', '/admin/dashboard', 'Guest')

    const log = getAccessLog()
    // ISO timestamp should be parseable as a date
    const date = new Date(log[0].timestamp)
    expect(date.getTime()).not.toBeNaN()
  })
})
