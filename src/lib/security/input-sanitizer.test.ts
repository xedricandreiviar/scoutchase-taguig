import { describe, it, expect } from 'vitest'
import {
  sanitizeUserInput,
  stripMarkup,
  containsHtmlOrScript,
} from './input-sanitizer'

describe('input-sanitizer', () => {
  describe('sanitizeUserInput', () => {
    it('accepts plain text without modification', () => {
      const result = sanitizeUserInput('Hello world, this is a test.')
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('Hello world, this is a test.')
      expect(result.truncated).toBe(false)
    })

    it('accepts text with normal punctuation and numbers', () => {
      const result = sanitizeUserInput('Site #42: Built in 1897, renovated 2003!')
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('Site #42: Built in 1897, renovated 2003!')
    })

    it('rejects text containing HTML tags', () => {
      const result = sanitizeUserInput('Hello <b>world</b>')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('HTML markup')
    })

    it('rejects text containing script tags', () => {
      const result = sanitizeUserInput('Hello <script>alert("xss")</script>')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('script content')
    })

    it('rejects text with on* event handlers', () => {
      const result = sanitizeUserInput('Click me onclick=alert(1)')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('script content')
    })

    it('rejects text with javascript: URLs', () => {
      const result = sanitizeUserInput('Visit javascript:void(0)')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('script content')
    })

    it('truncates text exceeding 2000 characters (default)', () => {
      const longText = 'a'.repeat(2500)
      const result = sanitizeUserInput(longText)
      expect(result.valid).toBe(true)
      expect(result.sanitized.length).toBe(2000)
      expect(result.truncated).toBe(true)
    })

    it('does not truncate text at exactly 2000 characters', () => {
      const exactText = 'b'.repeat(2000)
      const result = sanitizeUserInput(exactText)
      expect(result.valid).toBe(true)
      expect(result.sanitized.length).toBe(2000)
      expect(result.truncated).toBe(false)
    })

    it('truncates at custom maxLength', () => {
      const result = sanitizeUserInput('Hello World', { maxLength: 5 })
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('Hello')
      expect(result.truncated).toBe(true)
    })

    it('handles empty string', () => {
      const result = sanitizeUserInput('')
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('')
      expect(result.truncated).toBe(false)
    })

    it('handles null/undefined gracefully', () => {
      const result1 = sanitizeUserInput(null as unknown as string)
      expect(result1.valid).toBe(true)
      expect(result1.sanitized).toBe('')

      const result2 = sanitizeUserInput(undefined as unknown as string)
      expect(result2.valid).toBe(true)
      expect(result2.sanitized).toBe('')
    })

    it('rejects self-closing HTML tags', () => {
      const result = sanitizeUserInput('Image: <img src="x" />')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('HTML markup')
    })

    it('rejects div tags', () => {
      const result = sanitizeUserInput('<div>content</div>')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('HTML markup')
    })

    it('allows angle brackets in non-tag context', () => {
      const result = sanitizeUserInput('5 > 3 and 2 < 4')
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('5 > 3 and 2 < 4')
    })

    it('strips markup when rejectHtml is false', () => {
      const result = sanitizeUserInput('<p>Hello</p> world', { rejectHtml: false })
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('Hello world')
    })

    it('still rejects script content even when rejectHtml is false', () => {
      const result = sanitizeUserInput('<script>alert(1)</script>', { rejectHtml: false })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('script content')
    })

    it('normalizes whitespace', () => {
      const result = sanitizeUserInput('Hello    world   test')
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('Hello world test')
    })

    it('trims leading and trailing whitespace', () => {
      const result = sanitizeUserInput('  Hello world  ')
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('Hello world')
    })
  })

  describe('stripMarkup', () => {
    it('removes HTML tags from text', () => {
      expect(stripMarkup('<p>Hello</p>')).toBe('Hello')
    })

    it('removes nested HTML tags', () => {
      expect(stripMarkup('<div><p>Hello <strong>world</strong></p></div>')).toBe('Hello world')
    })

    it('decodes HTML entities', () => {
      expect(stripMarkup('&amp; &lt; &gt; &quot;')).toBe('& < > "')
    })

    it('returns empty string for null/undefined', () => {
      expect(stripMarkup(null as unknown as string)).toBe('')
      expect(stripMarkup(undefined as unknown as string)).toBe('')
      expect(stripMarkup('')).toBe('')
    })

    it('handles text without any markup', () => {
      expect(stripMarkup('Just plain text')).toBe('Just plain text')
    })

    it('collapses multiple spaces', () => {
      expect(stripMarkup('hello     world')).toBe('hello world')
    })
  })

  describe('containsHtmlOrScript', () => {
    it('returns false for plain text', () => {
      expect(containsHtmlOrScript('Hello world')).toBe(false)
    })

    it('returns true for HTML tags', () => {
      expect(containsHtmlOrScript('<p>text</p>')).toBe(true)
    })

    it('returns true for script tags', () => {
      expect(containsHtmlOrScript('<script>code</script>')).toBe(true)
    })

    it('returns true for event handlers', () => {
      expect(containsHtmlOrScript('onerror=alert(1)')).toBe(true)
    })

    it('returns true for javascript: protocol', () => {
      expect(containsHtmlOrScript('javascript:void(0)')).toBe(true)
    })

    it('returns false for empty/null input', () => {
      expect(containsHtmlOrScript('')).toBe(false)
      expect(containsHtmlOrScript(null as unknown as string)).toBe(false)
    })

    it('returns false for angle brackets in math context', () => {
      expect(containsHtmlOrScript('5 > 3')).toBe(false)
    })
  })
})
