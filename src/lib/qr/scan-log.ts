/**
 * Scan log record creation for QR code verification.
 *
 * When a QR scan is successfully verified, a log record is created
 * containing the timestamp, user identifier, and heritage site identifier.
 *
 * Validates: Requirements 6.7
 */

export interface ScanLogRecord {
  user_id: string
  heritage_site_id: string
  scanned_at: string // ISO 8601 timestamp
}

/**
 * Create a scan log record for a successful QR scan event.
 *
 * The record always contains a non-null timestamp (ISO 8601),
 * user_id, and heritage_site_id.
 *
 * @param userId - The authenticated user's identifier
 * @param siteId - The verified heritage site identifier
 * @returns A complete ScanLogRecord with all required fields
 */
export function createScanLogRecord(userId: string, siteId: string): ScanLogRecord {
  return {
    user_id: userId,
    heritage_site_id: siteId,
    scanned_at: new Date().toISOString(),
  }
}
