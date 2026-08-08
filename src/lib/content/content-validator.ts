/**
 * Content size validation for Heritage Site rich-text content.
 *
 * The platform SHALL accept Heritage Site rich-text content up to 500,000 characters
 * in stored JSON length and SHALL reject content exceeding this limit.
 *
 * @see Requirements 24.7
 */

export const MAX_CONTENT_LENGTH = 500_000

export interface ContentValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates that the serialized content length does not exceed the maximum allowed size.
 *
 * @param content - The serialized content string to validate
 * @returns Validation result with `valid` flag and optional `error` message
 */
export function validateContentSize(content: string): ContentValidationResult {
  if (content.length <= MAX_CONTENT_LENGTH) {
    return { valid: true }
  }

  return {
    valid: false,
    error: `Content exceeds maximum allowed size of ${MAX_CONTENT_LENGTH.toLocaleString()} characters (current: ${content.length.toLocaleString()} characters)`,
  }
}
