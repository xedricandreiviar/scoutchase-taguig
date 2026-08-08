/**
 * HTML sanitizer using DOMPurify.
 * Strips all executable content: script tags, on* event handlers, javascript: URLs.
 *
 * Validates: Requirements 24.5, 21.3
 */

import DOMPurify from 'dompurify'

/**
 * Allowed HTML tags for heritage site content.
 * Includes semantic HTML5 elements for rich-text rendering.
 */
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'blockquote',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u', 's', 'code',
  'a',
  'span',
  'figure', 'figcaption',
  'img',
]

/**
 * Allowed attributes for sanitized elements.
 */
const ALLOWED_ATTR = [
  'href', 'target', 'rel',
  'src', 'alt', 'width', 'height',
  'class',
]

/**
 * Sanitize HTML string, removing all executable content.
 * Strips: script tags, on* event handlers, javascript: URLs, data: URLs,
 * and any other potentially dangerous constructs.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
  })
}

/**
 * Check if a string contains potentially executable content.
 * Useful for validation before storage.
 */
export function containsExecutableContent(html: string): boolean {
  if (!html || typeof html !== 'string') {
    return false
  }

  const sanitized = sanitizeHtml(html)
  // If sanitization changed the content, it likely contained executable content
  return sanitized !== html
}
