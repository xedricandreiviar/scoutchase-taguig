/**
 * Property-based tests for QR HMAC signing and verification.
 *
 * Property 8: QR code HMAC round-trip
 * For any heritage site identifier, signing it with HMAC-SHA256 using the server
 * secret and then verifying the resulting payload SHALL always succeed. Conversely,
 * for any payload where even a single byte is modified after signing, verification
 * SHALL always fail.
 *
 * Validates: Requirements 6.3, 21.1
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { signQrPayload, verifyQrPayload } from './hmac'

/**
 * Generate non-empty strings that are valid site IDs.
 * Site IDs must be non-empty and not start with a colon (since the verify
 * function splits on the last colon and requires a non-empty siteId portion).
 */
const arbSiteId = fc.string({ minLength: 1, maxLength: 200 }).filter(
  (s) => s.length > 0 && !s.startsWith(':')
)

/**
 * Generate non-empty secret strings.
 */
const arbSecret = fc.string({ minLength: 1, maxLength: 100 })

describe('Property 8: QR code HMAC round-trip', () => {
  it('sign-then-verify round-trip always succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(arbSiteId, arbSecret, async (siteId, secret) => {
        const payload = await signQrPayload(siteId, secret)
        const result = await verifyQrPayload(payload, secret)

        expect(result.valid).toBe(true)
        expect(result.siteId).toBe(siteId)
      }),
      { numRuns: 100 }
    )
  })

  it('modified payload always fails verification', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSiteId,
        arbSecret,
        fc.nat({ max: 500 }),
        fc.integer({ min: 1, max: 255 }),
        async (siteId, secret, positionSeed, xorByte) => {
          const payload = await signQrPayload(siteId, secret)

          // Pick a position to modify (within the payload length)
          const position = positionSeed % payload.length

          // XOR the byte at that position to ensure modification
          const chars = payload.split('')
          const originalCharCode = chars[position].charCodeAt(0)
          const modifiedCharCode = originalCharCode ^ xorByte
          chars[position] = String.fromCharCode(modifiedCharCode)
          const tamperedPayload = chars.join('')

          // Skip if the XOR didn't actually change the character
          // (shouldn't happen since xorByte >= 1, but be safe)
          if (tamperedPayload === payload) return

          const result = await verifyQrPayload(tamperedPayload, secret)
          expect(result.valid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('wrong secret always fails verification', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSiteId,
        arbSecret,
        arbSecret,
        async (siteId, signSecret, verifySecret) => {
          // Ensure the two secrets are actually different
          fc.pre(signSecret !== verifySecret)

          const payload = await signQrPayload(siteId, signSecret)
          const result = await verifyQrPayload(payload, verifySecret)

          expect(result.valid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('empty/malformed payloads always fail verification', async () => {
    await fc.assert(
      fc.asyncProperty(arbSecret, async (secret) => {
        // Empty string
        const emptyResult = await verifyQrPayload('', secret)
        expect(emptyResult.valid).toBe(false)

        // No colon separator
        const noColonResult = await verifyQrPayload('noseparator', secret)
        expect(noColonResult.valid).toBe(false)

        // Starts with colon (empty siteId)
        const startsWithColonResult = await verifyQrPayload(':something', secret)
        expect(startsWithColonResult.valid).toBe(false)
      }),
      { numRuns: 50 }
    )
  })
})
