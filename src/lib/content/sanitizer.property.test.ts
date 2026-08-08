import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { sanitizeHtml } from './sanitizer'

/**
 * Property 26: HTML sanitization removes all executable content
 *
 * For any HTML string (including strings containing `<script>` tags, `on*` event
 * handler attributes, `javascript:` URLs, or other executable constructs), the
 * sanitizer output SHALL contain none of these executable elements while preserving
 * safe text content and allowed structural elements.
 *
 * **Validates: Requirements 21.3, 24.5**
 */
describe('Property 26: HTML sanitization removes all executable content', () => {
  // --- Generators ---

  /** Common on* event handler attribute names */
  const EVENT_HANDLERS = [
    'onclick', 'onerror', 'onload', 'onmouseover', 'onfocus',
    'onblur', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup',
    'onmousedown', 'onmouseup', 'ondblclick', 'oncontextmenu',
    'oninput', 'onscroll', 'onwheel', 'ondrag', 'ondrop',
  ]

  /** Forbidden tags that should be stripped */
  const FORBIDDEN_TAGS = ['script', 'iframe', 'object', 'embed', 'form']

  /** Allowed tags that should be preserved */
  const ALLOWED_TAGS = ['p', 'h1', 'h2', 'h3', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote', 'br', 'span']

  /** Generate arbitrary safe text content */
  const arbSafeText = fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => !s.includes('<') && !s.includes('>') && !s.includes('&'))

  /** Generate arbitrary JavaScript code snippet */
  const arbJsCode = fc.oneof(
    fc.constant('alert(1)'),
    fc.constant('document.cookie'),
    fc.constant('eval("malicious")'),
    fc.constant('window.location="http://evil.com"'),
    fc.string({ minLength: 1, maxLength: 50 }).map(s => `console.log("${s.replace(/"/g, '')}")`),
  )

  /** Generate HTML containing script tags */
  const arbScriptHtml = fc.tuple(arbSafeText, arbJsCode).map(
    ([text, js]) => `<p>${text}</p><script>${js}</script>`
  )

  /** Generate HTML with on* event handler attributes */
  const arbEventHandlerHtml = fc.tuple(
    arbSafeText,
    fc.constantFrom(...EVENT_HANDLERS),
    arbJsCode,
  ).map(([text, handler, js]) => `<img src="x" ${handler}="${js}"><p>${text}</p>`)

  /** Generate HTML with javascript: URLs */
  const arbJavascriptUrlHtml = fc.tuple(arbSafeText, arbJsCode).map(
    ([text, js]) => `<a href="javascript:${js}">${text}</a>`
  )

  /** Generate HTML with forbidden tags (iframe, object, embed, form) */
  const arbForbiddenTagHtml = fc.tuple(
    arbSafeText,
    fc.constantFrom(...FORBIDDEN_TAGS),
  ).map(([text, tag]) => `<${tag} src="http://evil.com"></${tag}><p>${text}</p>`)

  /** Generate mixed malicious HTML combining multiple attack vectors */
  const arbMixedMaliciousHtml = fc.tuple(
    arbScriptHtml,
    arbEventHandlerHtml,
    arbJavascriptUrlHtml,
    arbForbiddenTagHtml,
  ).map(([script, handler, jsUrl, forbidden]) =>
    `${script}${handler}${jsUrl}${forbidden}`
  )

  // --- Properties ---

  it('output never contains <script tags', () => {
    fc.assert(
      fc.property(arbScriptHtml, (html) => {
        const result = sanitizeHtml(html)
        expect(result.toLowerCase()).not.toContain('<script')
        expect(result.toLowerCase()).not.toContain('</script')
      }),
      { numRuns: 200 }
    )
  })

  it('output never contains on* event handler attributes', () => {
    fc.assert(
      fc.property(arbEventHandlerHtml, (html) => {
        const result = sanitizeHtml(html)
        for (const handler of EVENT_HANDLERS) {
          expect(result.toLowerCase()).not.toContain(`${handler}=`)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('output never contains javascript: URLs', () => {
    fc.assert(
      fc.property(arbJavascriptUrlHtml, (html) => {
        const result = sanitizeHtml(html)
        expect(result.toLowerCase()).not.toContain('javascript:')
      }),
      { numRuns: 200 }
    )
  })

  it('output never contains <iframe, <object, <embed, <form tags', () => {
    fc.assert(
      fc.property(arbForbiddenTagHtml, (html) => {
        const result = sanitizeHtml(html)
        for (const tag of FORBIDDEN_TAGS) {
          expect(result.toLowerCase()).not.toContain(`<${tag}`)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('sanitization is idempotent: sanitize(sanitize(x)) === sanitize(x)', () => {
    fc.assert(
      fc.property(arbMixedMaliciousHtml, (html) => {
        const once = sanitizeHtml(html)
        const twice = sanitizeHtml(once)
        expect(twice).toBe(once)
      }),
      { numRuns: 200 }
    )
  })

  it('safe content is preserved: plain text with allowed tags passes through', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALLOWED_TAGS),
        arbSafeText,
        (tag, text) => {
          // Self-closing tags don't wrap text
          if (tag === 'br') {
            const input = `<br>`
            const result = sanitizeHtml(input)
            expect(result).toContain('<br')
            return
          }

          const input = `<${tag}>${text}</${tag}>`
          const result = sanitizeHtml(input)
          expect(result).toContain(text)
        }
      ),
      { numRuns: 200 }
    )
  })
})
