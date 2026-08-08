import { describe, it, expect } from 'vitest'
import { parseRichTextToHtml, isValidRichTextDocument } from './rich-text-parser'
import type { RichTextDocument } from './rich-text-parser'

describe('rich-text-parser', () => {
  describe('isValidRichTextDocument', () => {
    it('returns true for valid document', () => {
      const doc = { type: 'doc', content: [] }
      expect(isValidRichTextDocument(doc)).toBe(true)
    })

    it('returns false for null', () => {
      expect(isValidRichTextDocument(null)).toBe(false)
    })

    it('returns false for wrong type', () => {
      expect(isValidRichTextDocument({ type: 'other', content: [] })).toBe(false)
    })

    it('returns false for missing content array', () => {
      expect(isValidRichTextDocument({ type: 'doc' })).toBe(false)
    })
  })

  describe('parseRichTextToHtml', () => {
    it('renders a paragraph with text', () => {
      const doc: RichTextDocument = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello world' }],
          },
        ],
      }
      expect(parseRichTextToHtml(doc)).toBe('<p>Hello world</p>')
    })

    it('renders headings with correct levels', () => {
      const doc: RichTextDocument = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Title' }],
          },
        ],
      }
      expect(parseRichTextToHtml(doc)).toBe('<h2>Title</h2>')
    })

    it('clamps heading level to 1-6', () => {
      const doc: RichTextDocument = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 9 },
            content: [{ type: 'text', text: 'Title' }],
          },
        ],
      }
      expect(parseRichTextToHtml(doc)).toBe('<h6>Title</h6>')
    })

    it('renders blockquote', () => {
      const doc: RichTextDocument = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Quote' }],
              },
            ],
          },
        ],
      }
      expect(parseRichTextToHtml(doc)).toBe('<blockquote><p>Quote</p></blockquote>')
    })

    it('renders bullet list', () => {
      const doc: RichTextDocument = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }],
              },
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }],
              },
            ],
          },
        ],
      }
      expect(parseRichTextToHtml(doc)).toBe('<ul><li><p>Item 1</p></li><li><p>Item 2</p></li></ul>')
    })

    it('renders ordered list', () => {
      const doc: RichTextDocument = {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }],
              },
            ],
          },
        ],
      }
      expect(parseRichTextToHtml(doc)).toBe('<ol><li><p>First</p></li></ol>')
    })

    it('renders text marks: bold, italic, underline, strike, code', () => {
      const doc: RichTextDocument = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
              { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
              { type: 'text', text: 'underline', marks: [{ type: 'underline' }] },
              { type: 'text', text: 'strike', marks: [{ type: 'strike' }] },
              { type: 'text', text: 'code', marks: [{ type: 'code' }] },
            ],
          },
        ],
      }
      const result = parseRichTextToHtml(doc)
      expect(result).toContain('<strong>bold</strong>')
      expect(result).toContain('<em>italic</em>')
      expect(result).toContain('<u>underline</u>')
      expect(result).toContain('<s>strike</s>')
      expect(result).toContain('<code>code</code>')
    })

    it('renders links with href', () => {
      const doc: RichTextDocument = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Click here',
                marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
              },
            ],
          },
        ],
      }
      expect(parseRichTextToHtml(doc)).toBe('<p><a href="https://example.com">Click here</a></p>')
    })

    it('escapes HTML in text nodes', () => {
      const doc: RichTextDocument = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '<script>alert("xss")</script>' }],
          },
        ],
      }
      const result = parseRichTextToHtml(doc)
      expect(result).not.toContain('<script>')
      expect(result).toContain('&lt;script&gt;')
    })

    it('returns empty string for invalid document', () => {
      expect(parseRichTextToHtml(null as unknown as RichTextDocument)).toBe('')
      expect(parseRichTextToHtml({} as unknown as RichTextDocument)).toBe('')
    })

    it('renders hardBreak as br', () => {
      const doc: RichTextDocument = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Line 1' },
              { type: 'hardBreak' },
              { type: 'text', text: 'Line 2' },
            ],
          },
        ],
      }
      expect(parseRichTextToHtml(doc)).toBe('<p>Line 1<br>Line 2</p>')
    })
  })
})
