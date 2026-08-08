/**
 * HMAC-SHA256 signing and verification for QR code payloads.
 *
 * QR payload format: `siteId:hmacSignature`
 * where hmacSignature = HMAC-SHA256(siteId, secret) as hex string.
 *
 * These functions work in both browser (Web Crypto API) and Deno environments.
 *
 * Validates: Requirements 6.3, 21.1
 */

/**
 * Convert an ArrayBuffer to a hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Compute HMAC-SHA256 using the Web Crypto API (works in browser and Deno).
 */
async function hmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const msgData = encoder.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  return bufferToHex(signature)
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Create a signed QR payload: `siteId:hmacSignature`
 */
export async function signQrPayload(siteId: string, secret: string): Promise<string> {
  const signature = await hmacSha256(siteId, secret)
  return `${siteId}:${signature}`
}

/**
 * Verify a QR payload and extract the siteId if valid.
 *
 * Returns `{ valid: true, siteId }` if the signature matches,
 * or `{ valid: false }` if the payload is malformed or tampered.
 */
export async function verifyQrPayload(
  payload: string,
  secret: string
): Promise<{ valid: boolean; siteId?: string }> {
  if (!payload || typeof payload !== 'string') {
    return { valid: false }
  }

  // Split on the last colon to handle siteIds that might contain colons
  const lastColonIndex = payload.lastIndexOf(':')
  if (lastColonIndex === -1 || lastColonIndex === 0) {
    return { valid: false }
  }

  const siteId = payload.substring(0, lastColonIndex)
  const providedSignature = payload.substring(lastColonIndex + 1)

  if (!siteId || !providedSignature) {
    return { valid: false }
  }

  // Verify HMAC signature length (SHA-256 produces 64 hex chars)
  if (providedSignature.length !== 64) {
    return { valid: false }
  }

  const expectedSignature = await hmacSha256(siteId, secret)

  if (timingSafeEqual(expectedSignature, providedSignature)) {
    return { valid: true, siteId }
  }

  return { valid: false }
}
