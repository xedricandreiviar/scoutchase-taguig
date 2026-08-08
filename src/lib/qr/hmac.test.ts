import { describe, it, expect } from 'vitest'
import { signQrPayload, verifyQrPayload } from './hmac'

const TEST_SECRET = 'test-secret-key-for-qr-codes'

describe('QR HMAC signing and verification', () => {
  describe('signQrPayload', () => {
    it('should produce a payload in format siteId:signature', async () => {
      const payload = await signQrPayload('site-123', TEST_SECRET)
      expect(payload).toContain(':')

      const parts = payload.split(':')
      expect(parts[0]).toBe('site-123')
      // HMAC-SHA256 produces 64 hex characters
      expect(parts[1]).toHaveLength(64)
    })

    it('should produce deterministic signatures for the same input', async () => {
      const payload1 = await signQrPayload('site-abc', TEST_SECRET)
      const payload2 = await signQrPayload('site-abc', TEST_SECRET)
      expect(payload1).toBe(payload2)
    })

    it('should produce different signatures for different site IDs', async () => {
      const payload1 = await signQrPayload('site-1', TEST_SECRET)
      const payload2 = await signQrPayload('site-2', TEST_SECRET)
      expect(payload1).not.toBe(payload2)
    })

    it('should produce different signatures for different secrets', async () => {
      const payload1 = await signQrPayload('site-1', 'secret-a')
      const payload2 = await signQrPayload('site-1', 'secret-b')
      expect(payload1).not.toBe(payload2)
    })
  })

  describe('verifyQrPayload', () => {
    it('should verify a correctly signed payload', async () => {
      const payload = await signQrPayload('site-123', TEST_SECRET)
      const result = await verifyQrPayload(payload, TEST_SECRET)
      expect(result.valid).toBe(true)
      expect(result.siteId).toBe('site-123')
    })

    it('should reject a payload with wrong secret', async () => {
      const payload = await signQrPayload('site-123', TEST_SECRET)
      const result = await verifyQrPayload(payload, 'wrong-secret')
      expect(result.valid).toBe(false)
    })

    it('should reject a tampered payload (modified siteId)', async () => {
      const payload = await signQrPayload('site-123', TEST_SECRET)
      const tampered = 'site-999' + payload.substring(payload.indexOf(':'))
      const result = await verifyQrPayload(tampered, TEST_SECRET)
      expect(result.valid).toBe(false)
    })

    it('should reject a tampered payload (modified signature)', async () => {
      const payload = await signQrPayload('site-123', TEST_SECRET)
      const tampered = payload.slice(0, -4) + 'dead'
      const result = await verifyQrPayload(tampered, TEST_SECRET)
      expect(result.valid).toBe(false)
    })

    it('should reject an empty string', async () => {
      const result = await verifyQrPayload('', TEST_SECRET)
      expect(result.valid).toBe(false)
    })

    it('should reject a payload without a colon', async () => {
      const result = await verifyQrPayload('no-colon-here', TEST_SECRET)
      expect(result.valid).toBe(false)
    })

    it('should reject a payload with only a colon', async () => {
      const result = await verifyQrPayload(':', TEST_SECRET)
      expect(result.valid).toBe(false)
    })

    it('should reject a payload starting with colon', async () => {
      const result = await verifyQrPayload(':abc123', TEST_SECRET)
      expect(result.valid).toBe(false)
    })

    it('should reject a payload with wrong signature length', async () => {
      const result = await verifyQrPayload('site-123:tooshort', TEST_SECRET)
      expect(result.valid).toBe(false)
    })

    it('should handle site IDs that contain colons (splits on last colon)', async () => {
      const siteIdWithColon = 'uuid:with:colons'
      const payload = await signQrPayload(siteIdWithColon, TEST_SECRET)
      const result = await verifyQrPayload(payload, TEST_SECRET)
      expect(result.valid).toBe(true)
      expect(result.siteId).toBe(siteIdWithColon)
    })
  })
})
