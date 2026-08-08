/**
 * Rich-text JSON to semantic HTML5 parser.
 * Converts the rich-text JSON format (stored in heritage_sites.content_json)
 * into semantic HTML5 elements.
 *
 * Validates: Requirements 24.1, 24.2
 */

export interface RichTextNode {
  type: string
  text?: string
  content?: RichTextNode[]
  attrs?: Record<string, unknown>
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

export interface RichTextDocument {
  type: 'doc'
  content: RichTextNode[]
}

/**
 * Checks whether a value is a valid RichTextDocument.
 */
export function isValidRichTextDocument(value: unknown): value is RichTextDocument {
  if (!value || typeof value !== 'object') return false
  const doc = value as Record<string, unknown>
  return doc.type === 'doc' && Array.isArray(doc.content)
}

/**
 * Parse a rich-text JSON document into semantic HTML5 string.
 */
export function parseRichTextToHtml(doc: RichTextDocument): string {
  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) {
    return ''
  }
  return doc.content.map(renderNode).join('')
}

function renderNode(node: RichTextNode): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${renderChildren(node)}</p>`

    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 1), 6)
      return `<h${level}>${renderChildren(node)}</h${level}>`
    }

    case 'blockquote':
      return `<blockquote>${renderChildren(node)}</blockquote>`

    case 'bulletList':
      return `<ul>${renderChildren(node)}</ul>`

    case 'orderedList':
      return `<ol>${renderChildren(node)}</ol>`

    case 'listItem':
      return `<li>${renderChildren(node)}</li>`

    case 'text':
      return renderTextWithMarks(node)

    case 'hardBreak':
      return '<br>'

    default:
      // For unknown node types, render children if available
      return renderChildren(node)
  }
}

function renderChildren(node: RichTextNode): string {
  if (!node.content || !Array.isArray(node.content)) {
    return ''
  }
  return node.content.map(renderNode).join('')
}

function renderTextWithMarks(node: RichTextNode): string {
  let text = escapeHtml(node.text ?? '')

  if (!node.marks || node.marks.length === 0) {
    return text
  }

  for (const mark of node.marks) {
    switch (mark.type) {
      case 'bold':
      case 'strong':
        text = `<strong>${text}</strong>`
        break
      case 'italic':
      case 'em':
        text = `<em>${text}</em>`
        break
      case 'underline':
        text = `<u>${text}</u>`
        break
      case 'strike':
      case 'strikethrough':
        text = `<s>${text}</s>`
        break
      case 'code':
        text = `<code>${text}</code>`
        break
      case 'link': {
        const href = escapeAttr(String(mark.attrs?.href ?? ''))
        text = `<a href="${href}">${text}</a>`
        break
      }
    }
  }

  return text
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
