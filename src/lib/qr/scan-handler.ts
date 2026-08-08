/**
 * QR scan handler implementing idempotency logic.
 *
 * The core scan result function is a pure function that determines
 * the outcome of a scan based on existing scan state. This makes
 * it easy to test the idempotency property without requiring a database.
 *
 * Validates: Requirements 6.7, 6.8, 21.6
 */

export interface ScanResult {
  status: 'new_unlock' | 'already_unlocked'
  pointsAwarded: number
  siteId: string
}

/**
 * Points awarded for scanning a new heritage site.
 */
export const SCAN_POINTS = 50

/**
 * Determine the scan result based on whether the user has already scanned this site.
 *
 * This pure function implements the idempotency guarantee:
 * - If the site is already in the user's existing scans, return `already_unlocked` with 0 points.
 * - If the site is new, return `new_unlock` with the standard points award.
 *
 * The set of existing scans is NOT mutated by this function — the caller
 * is responsible for persisting the new scan record.
 */
export function simulateScanResult(
  existingScans: Set<string>,
  siteId: string
): ScanResult {
  if (existingScans.has(siteId)) {
    return {
      status: 'already_unlocked',
      pointsAwarded: 0,
      siteId,
    }
  }

  return {
    status: 'new_unlock',
    pointsAwarded: SCAN_POINTS,
    siteId,
  }
}

/**
 * Represents a scan log entry recorded in the qr_scans table.
 */
export interface ScanLogEntry {
  userId: string
  heritageSiteId: string
  scannedAt: Date
}

/**
 * Create a scan log entry for a new unlock. Ensures all required fields are present.
 * Returns null if the scan is a duplicate (already_unlocked).
 */
export function createScanLogEntry(
  userId: string,
  siteId: string,
  existingScans: Set<string>
): ScanLogEntry | null {
  if (existingScans.has(siteId)) {
    return null
  }

  return {
    userId,
    heritageSiteId: siteId,
    scannedAt: new Date(),
  }
}
