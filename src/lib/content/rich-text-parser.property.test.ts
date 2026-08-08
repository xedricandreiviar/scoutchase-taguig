import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { parseRichTextToHtml, isValidRichTextDocument } from './rich-text-parser'
import type { RichTextDocument, RichTextNode } from './rich-text-parser'

/**
 * Property 25: Rich-text content round-trip
 *
 * For any valid rich-text JSON document, parsing to HTML SHALL produce
 * well-formed HTML that:
 * 1. Preserves all text content (no text loss)
 * 2. Contains valid semantic HTML tags corresponding to the document structure
 * 3. Produces empty string for empty documents
 * 4. Is deterministic (same input → same output)
 *
 * Note: Full JSON round-trip (HTML→JSON) is not tested since the reverse
 * parser is not implemented. Instead we verify the forward parse preserves
 * all information that can be verified from the HTML output.
 *
 * **Validates: Requirements 24.1, 24.2, 24.3, 24.4**
 */
describe('Property 25: Rich-text content round-trip', () => {
  // --- Generators ---

  const MARK_TYPES = ['bold', 'italic', 'underline', 'strike', 'code'] as const

  /** Generate a mark (inline formatting) */
  const arbMark = fc.record({
    type: fc.constantFrom(...MARK_TYPES),
  })

  /** Generate a link mark with href */
  const arbLinkMark = fc.record({
    type: fc.constant('link' as const),
    attrs: fc.record({ href: fc.webUrl() }),
  })

  /** Generate a text node with optional marks */
  const arbSafeChar = fc.char().filter((c) => c !== '<' && c !== '>' && c !== '&' && c !== '"' && c !== "'")
  const arbTextNode: fc.Arbitrary<RichTextNode> = fc.record({
    type: fc.constant('text'),
    text: fc.string({ minLength: 1, maxLength: 50, unit: arbSafeChar }),
    marks: fc.option(
      fc.array(fc.oneof(arbMark, arbLinkMark), { minLength: 0, maxLength: 3 }),
      { nil: undefined }
    ),
  })

  /** Generate a hardBreak node */
  const arbHardBreak: fc.Arbitrary<RichTextNode> = fc.constant({ type: 'hardBreak' })

  /** Generate inline content (text nodes and hard breaks) */
  const arbInlineContent = fc.array(fc.oneof(arbTextNode, arbHardBreak), {
    minLength: 0,
    maxLength: 5,
  })

  /** Generate a paragraph node */
  const arbParagraph: fc.Arbitrary<RichTextNode> = arbInlineContent.map((content) => ({
    type: 'paragraph',
    content,
  }))

  /** Generate a heading node (h1-h6) */
  const arbHeading: fc.Arbitrary<RichTextNode> = fc
    .tuple(fc.integer({ min: 1, max: 6 }), arbInlineContent)
    .map(([level, content]) => ({
      type: 'heading',
      attrs: { level },
      content,
    }))

  /** Generate a blockquote node */
  const arbBlockquote: fc.Arbitrary<RichTextNode> = fc
    .array(arbParagraph, { minLength: 1, maxLength: 3 })
    .map((content) => ({
      type: 'blockquote',
      content,
    }))

  /** Generate a list item node */
  const arbListItem: fc.Arbitrary<RichTextNode> = arbInlineContent.map((content) => ({
    type: 'listItem',
    content: [{ type: 'paragraph', content } as RichTextNode],
  }))

  /** Generate a bullet list */
  const arbBulletList: fc.Arbitrary<RichTextNode> = fc
    .array(arbListItem, { minLength: 1, maxLength: 5 })
    .map((content) => ({
      type: 'bulletList',
      content,
    }))

  /** Generate an ordered list */
  const arbOrderedList: fc.Arbitrary<RichTextNode> = fc
    .array(arbListItem, { minLength: 1, maxLength: 5 })
    .map((content) => ({
      type: 'orderedList',
      content,
    }))

  /** Generate any block-level node */
  const arbBlockNode: fc.Arbitrary<RichTextNode> = fc.oneof(
    arbParagraph,
    arbHeading,
    arbBlockquote,
    arbBulletList,
    arbOrderedList
  )

  /** Generate a valid RichTextDocument */
  const arbRichTextDocument: fc.Arbitrary<RichTextDocument> = fc
    .array(arbBlockNode, { minLength: 0, maxLength: 10 })
    .map((content) => ({
      type: 'doc' as const,
      content,
    }))

  /** Helper: extract all text content from a RichTextDocument recursively */
  function extractTextContent(node: RichTextNode): string[] {
    const texts: string[] = []
    if (node.type === 'text' && node.text) {
      texts.push(node.text)
    }
    if (node.content) {
      for (const child of node.content) {
        texts.push(...extractTextContent(child))
      }
    }
    return texts
  }

  /** Helper: strip HTML tags to get plain text */
  function stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, '')
  }

  /** Helper: unescape HTML entities to compare with original text */
  function unescapeHtml(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
  }

  // --- Properties ---

  it('all text content from the JSON appears in the HTML output (no text loss)', () => {
    fc.assert(
      fc.property(arbRichTextDocument, (doc) => {
        const html = parseRichTextToHtml(doc)
        const allTexts = doc.content.flatMap(extractTextContent)

        const plainHtml = unescapeHtml(stripHtmlTags(html))

        for (const text of allTexts) {
          expect(plainHtml).toContain(text)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('output contains valid HTML tags for the document structure', () => {
    fc.assert(
      fc.property(arbRichTextDocument, (doc) => {
        const html = parseRichTextToHtml(doc)

        for (const node of doc.content) {
          switch (node.type) {
            case 'paragraph':
              if (node.content && node.content.length > 0) {
                expect(html).toContain('<p>')
                expect(html).toContain('</p>')
              }
              break
            case 'heading': {
              const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 1), 6)
              expect(html).toContain(`<h${level}>`)
              expect(html).toContain(`</h${level}>`)
              break
            }
            case 'blockquote':
              expect(html).toContain('<blockquote>')
              expect(html).toContain('</blockquote>')
              break
            case 'bulletList':
              expect(html).toContain('<ul>')
              expect(html).toContain('</ul>')
              break
            case 'orderedList':
              expect(html).toContain('<ol>')
              expect(html).toContain('</ol>')
              break
          }
        }
      }),
      { numRuns: 200 }
    )
  })

  it('empty documents produce empty string', () => {
    fc.assert(
      fc.property(
        fc.constant({ type: 'doc' as const, content: [] }),
        (doc) => {
          const html = parseRichTextToHtml(doc)
          expect(html).toBe('')
        }
      ),
      { numRuns: 10 }
    )
  })

  it('parser is deterministic (same input → same output)', () => {
    fc.assert(
      fc.property(arbRichTextDocument, (doc) => {
        const html1 = parseRichTextToHtml(doc)
        const html2 = parseRichTextToHtml(doc)
        expect(html1).toBe(html2)
      }),
      { numRuns: 200 }
    )
  })

  it('isValidRichTextDocument correctly identifies valid documents', () => {
    fc.assert(
      fc.property(arbRichTextDocument, (doc) => {
        expect(isValidRichTextDocument(doc)).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  it('isValidRichTextDocument rejects invalid values', () => {
    const arbInvalid = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.constant(42),
      fc.constant('string'),
      fc.constant({ type: 'notdoc', content: [] }),
      fc.constant({ type: 'doc' }),
      fc.constant({ type: 'doc', content: 'not-array' })
    )

    fc.assert(
      fc.property(arbInvalid, (value) => {
        expect(isValidRichTextDocument(value)).toBe(false)
      }),
      { numRuns: 50 }
    )
  })

  it('marks are preserved as corresponding HTML tags', () => {
    fc.assert(
      fc.property(arbRichTextDocument, (doc) => {
        const html = parseRichTextToHtml(doc)

        // Check that marks produce corresponding tags
        for (const blockNode of doc.content) {
          const textNodes = extractMarkedTextNodes(blockNode)
          for (const textNode of textNodes) {
            if (textNode.marks && textNode.marks.length > 0) {
              for (const mark of textNode.marks) {
                switch (mark.type) {
                  case 'bold':
                  case 'strong':
                    expect(html).toContain('<strong>')
                    break
                  case 'italic':
                  case 'em':
                    expect(html).toContain('<em>')
                    break
                  case 'underline':
                    expect(html).toContain('<u>')
                    break
                  case 'strike':
                  case 'strikethrough':
                    expect(html).toContain('<s>')
                    break
                  case 'code':
                    expect(html).toContain('<code>')
                    break
                  case 'link':
                    expect(html).toContain('<a href=')
                    break
                }
              }
            }
          }
        }
      }),
      { numRuns: 200 }
    )
  })
})

/** Helper: extract text nodes with marks from a node tree */
function extractMarkedTextNodes(node: RichTextNode): RichTextNode[] {
  const results: RichTextNode[] = []
  if (node.type === 'text' && node.marks && node.marks.length > 0) {
    results.push(node)
  }
  if (node.content) {
    for (const child of node.content) {
      results.push(...extractMarkedTextNodes(child))
    }
  }
  return results
}
