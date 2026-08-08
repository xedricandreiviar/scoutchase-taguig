/**
 * Accessibility utilities for WCAG 2.1 AA compliance.
 *
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6
 */

export { createFocusTrap, getFocusableElements } from './focus-trap'

/**
 * Maximum alt text length per WCAG best practices (Req 20.2).
 */
export const MAX_ALT_TEXT_LENGTH = 125

/**
 * Truncates alt text to the maximum recommended length (125 chars).
 * Returns the text as-is if within limits.
 *
 * Requirement 20.2: Alt text for images/icons (max 125 chars)
 */
export function sanitizeAltText(text: string): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (trimmed.length <= MAX_ALT_TEXT_LENGTH) return trimmed
  return trimmed.slice(0, MAX_ALT_TEXT_LENGTH - 1).trimEnd() + '…'
}

/**
 * Returns empty string for decorative images (Req 20.2).
 * Use this for images that don't convey meaningful content.
 */
export function decorativeAlt(): '' {
  return ''
}

/**
 * Minimum contrast ratios per WCAG 2.1 AA (Req 20.1).
 */
export const CONTRAST_RATIOS = {
  /** Normal text (< 18px or < 14px bold) */
  normalText: 4.5,
  /** Large text (≥ 18px or ≥ 14px bold) */
  largeText: 3.0,
  /** Non-text elements (icons, borders, UI components) */
  nonText: 3.0,
} as const

/**
 * Minimum touch/click target dimensions in CSS pixels (Req 20.6).
 */
export const MIN_TARGET_SIZE = 44

/**
 * Minimum focus indicator width in pixels (Req 20.3).
 */
export const FOCUS_INDICATOR_WIDTH = 2
