import { describe, it, expect } from 'vitest'
import { sanitizeHtml, containsExecutableContent } from './sanitizer'

describe('sanitizer', () => {
  describe('sanitizeHtml', () => {
    it('preserves safe HTML elements', () => {
      const input = '<p>Hello <strong>world</strong></p>'
      expect(sanitizeHtml(input)).toBe('<p>Hello <strong>world</strong></p>')
    })

    it('preserves headings', () => {
      const input = '<h2>Title</h2><p>Content</p>'
      expect(sanitizeHtml(input)).toBe('<h2>Title</h2><p>Content</p>')
    })

    it('preserves lists', () => {
      const input = '<ul><li>Item 1</li><li>Item 2</li></ul>'
      expect(sanitizeHtml(input)).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>')
    })

    it('strips script tags', () => {
      const input = '<p>Safe</p><script>alert("xss")</script>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
      expect(result).toContain('<p>Safe</p>')
    })

    it('strips on* event handlers', () => {
      const input = '<img src="x" onerror="alert(1)">'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('onerror')
      expect(result).not.toContain('alert')
    })

    it('strips javascript: URLs', () => {
      const input = '<a href="javascript:alert(1)">Click</a>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('javascript:')
    })

    it('strips style tags', () => {
      const input = '<style>body{display:none}</style><p>Text</p>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('<style>')
      expect(result).toContain('<p>Text</p>')
    })

    it('strips iframe tags', () => {
      const input = '<iframe src="https://evil.com"></iframe><p>Safe</p>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('<iframe')
      expect(result).toContain('<p>Safe</p>')
    })

    it('strips form elements', () => {
      const input = '<form action="/steal"><input type="text"><button>Submit</button></form>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('<form')
      expect(result).not.toContain('<input')
      expect(result).not.toContain('<button')
    })

    it('returns empty string for null/undefined input', () => {
      expect(sanitizeHtml(null as unknown as string)).toBe('')
      expect(sanitizeHtml(undefined as unknown as string)).toBe('')
      expect(sanitizeHtml('')).toBe('')
    })

    it('preserves links with safe href', () => {
      const input = '<a href="https://example.com">Link</a>'
      const result = sanitizeHtml(input)
      expect(result).toContain('href="https://example.com"')
      expect(result).toContain('>Link</a>')
    })

    it('preserves blockquote', () => {
      const input = '<blockquote><p>A quote</p></blockquote>'
      expect(sanitizeHtml(input)).toBe('<blockquote><p>A quote</p></blockquote>')
    })
  })

  describe('containsExecutableContent', () => {
    it('returns false for safe HTML', () => {
      expect(containsExecutableContent('<p>Hello</p>')).toBe(false)
    })

    it('returns true for script tags', () => {
      expect(containsExecutableContent('<script>alert(1)</script>')).toBe(true)
    })

    it('returns true for event handlers', () => {
      expect(containsExecutableContent('<img onerror="alert(1)">')).toBe(true)
    })

    it('returns true for javascript: URLs', () => {
      expect(containsExecutableContent('<a href="javascript:void(0)">x</a>')).toBe(true)
    })

    it('returns false for empty/null input', () => {
      expect(containsExecutableContent('')).toBe(false)
      expect(containsExecutableContent(null as unknown as string)).toBe(false)
    })
  })
})
