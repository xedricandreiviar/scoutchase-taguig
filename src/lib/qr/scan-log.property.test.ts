import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { createScanLogRecord } from './scan-log'

/**
 * Property 10: Scan log completeness
 *
 * For any successful QR scan event, the created log record SHALL contain
 * a non-null timestamp, user_id, and heritage_site_id.
 *
 * **Validates: Requirements 6.7**
 */
describe('Property 10: Scan log completeness', () => {
  // --- Generators ---

  /** Generate a non-empty user ID (UUID-like or any non-empty string) */
  const userId = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0)

  /** Generate a non-empty heritage site ID */
  const siteId = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0)

  it('should always produce a record with a non-null scanned_at timestamp', () => {
    fc.assert(
      fc.property(userId, siteId, (uid, sid) => {
        const record = createScanLogRecord(uid, sid)
        expect(record.scanned_at).not.toBeNull()
        expect(record.scanned_at).not.toBeUndefined()
        expect(record.scanned_at.length).toBeGreaterThan(0)
      }),
      { numRuns: 200 }
    )
  })

  it('should always produce a record with the correct user_id', () => {
    fc.assert(
      fc.property(userId, siteId, (uid, sid) => {
        const record = createScanLogRecord(uid, sid)
        expect(record.user_id).not.toBeNull()
        expect(record.user_id).not.toBeUndefined()
        expect(record.user_id).toBe(uid)
      }),
      { numRuns: 200 }
    )
  })

  it('should always produce a record with the correct heritage_site_id', () => {
    fc.assert(
      fc.property(userId, siteId, (uid, sid) => {
        const record = createScanLogRecord(uid, sid)
        expect(record.heritage_site_id).not.toBeNull()
        expect(record.heritage_site_id).not.toBeUndefined()
        expect(record.heritage_site_id).toBe(sid)
      }),
      { numRuns: 200 }
    )
  })

  it('should always produce a valid ISO 8601 date string for scanned_at', () => {
    fc.assert(
      fc.property(userId, siteId, (uid, sid) => {
        const record = createScanLogRecord(uid, sid)
        const parsed = new Date(record.scanned_at)
        // A valid ISO date string should parse to a valid Date
        expect(parsed.getTime()).not.toBeNaN()
        // The ISO string should round-trip correctly
        expect(parsed.toISOString()).toBe(record.scanned_at)
      }),
      { numRuns: 200 }
    )
  })
})
