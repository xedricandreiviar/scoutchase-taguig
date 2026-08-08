/**
 * Input sanitization for user-submitted text content.
 *
 * Rejects HTML/script fragments, truncates at a configurable max length (default 2000 chars),
 * and strips any markup before storage and rendering.
 *
 * Validates: Requirements 21.3
 */

/** Default maximum length for user-submitted text fields. */
const DEFAULT_MAX_LENGTH = 2000

/** Pattern to detect HTML tags (opening, closing, self-closing). */
const HTML_TAG_PATTERN = /<\/?[a-z][a-z0-9]*\b[^>]*\/?>/i

/** Pattern to detect script-like fragments (script tags, event handlers, javascript: URLs). */
const SCRIPT_PATTERN = /<script\b|on\w+\s*=|javascript\s*:/i

export interface SanitizeOptions {
  /** Maximum allowed character length. Defaults to 2000. */
  maxLength?: number
  /** If true, reject input containing HTML tags (returns validation error). Defaults to true. */
  rejectHtml?: boolean
}

export interface SanitizeResult {
  /** Whether the input passed validation (no HTML/script detected when rejectHtml is true). */
  valid: boolean
  /** The sanitized and truncated text (markup stripped, within length limit). */
  sanitized: string
  /** Error message when validation fails. */
  error?: string
  /** Whether the text was truncated to fit maxLength. */
  truncated: boolean
}

/**
 * Sanitizes user-submitted text input.
 *
 * 1. Rejects text containing HTML tags or script fragments (when rejectHtml = true).
 * 2. Strips all HTML markup from the text.
 * 3. Truncates at maxLength characters.
 *
 * @param text - The raw user input text.
 * @param options - Configuration for max length and rejection behavior.
 * @returns SanitizeResult with validity status, cleaned text, and error info.
 */
export function sanitizeUserInput(
  text: string,
  options: SanitizeOptions = {}
): SanitizeResult {
  const { maxLength = DEFAULT_MAX_LENGTH, rejectHtml = true } = options

  // Handle null/undefined/non-string gracefully
  if (text == null || typeof text !== 'string') {
    return { valid: true, sanitized: '', truncated: false }
  }

  // Check for script fragments (always rejected regardless of rejectHtml setting)
  if (SCRIPT_PATTERN.test(text)) {
    return {
      valid: false,
      sanitized: '',
      error: 'Input contains script content which is not allowed',
      truncated: false,
    }
  }

  // Check for HTML tags when rejection mode is enabled
  if (rejectHtml && HTML_TAG_PATTERN.test(text)) {
    return {
      valid: false,
      sanitized: '',
      error: 'Input contains HTML markup which is not allowed',
      truncated: false,
    }
  }

  // Strip all HTML markup (in case rejectHtml is false, still clean it)
  const stripped = stripMarkup(text)

  // Truncate to max length
  const truncated = stripped.length > maxLength
  const finalText = truncated ? stripped.slice(0, maxLength) : stripped

  return {
    valid: true,
    sanitized: finalText,
    truncated,
  }
}

/**
 * Strips all HTML/XML markup from a string, leaving only plain text content.
 * Also decodes common HTML entities.
 */
export function stripMarkup(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  return text
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Normalize whitespace (collapse multiple spaces but preserve single newlines)
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/**
 * Quick check if text contains any HTML or script content.
 * Useful for validation before more expensive operations.
 */
export function containsHtmlOrScript(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false
  }
  return HTML_TAG_PATTERN.test(text) || SCRIPT_PATTERN.test(text)
}
