import { describe, it, expect } from 'vitest'
import {
  sanitizeAltText,
  decorativeAlt,
  MAX_ALT_TEXT_LENGTH,
  CONTRAST_RATIOS,
  MIN_TARGET_SIZE,
  FOCUS_INDICATOR_WIDTH,
} from './index'

describe('sanitizeAltText', () => {
  it('returns text as-is when under 125 chars', () => {
    const text = 'A historical photo of Taguig City Hall'
    expect(sanitizeAltText(text)).toBe(text)
  })

  it('truncates text exceeding 125 chars with ellipsis', () => {
    const text = 'A'.repeat(200)
    const result = sanitizeAltText(text)
    expect(result.length).toBeLessThanOrEqual(MAX_ALT_TEXT_LENGTH)
    expect(result.endsWith('…')).toBe(true)
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeAltText('')).toBe('')
  })

  it('trims whitespace', () => {
    expect(sanitizeAltText('  hello  ')).toBe('hello')
  })

  it('returns exactly 125-char text without truncation', () => {
    const text = 'A'.repeat(125)
    expect(sanitizeAltText(text)).toBe(text)
  })
})

describe('decorativeAlt', () => {
  it('returns empty string for decorative images', () => {
    expect(decorativeAlt()).toBe('')
  })
})

describe('accessibility constants', () => {
  it('enforces WCAG 2.1 AA contrast ratios', () => {
    expect(CONTRAST_RATIOS.normalText).toBe(4.5)
    expect(CONTRAST_RATIOS.largeText).toBe(3.0)
    expect(CONTRAST_RATIOS.nonText).toBe(3.0)
  })

  it('minimum target size is 44px', () => {
    expect(MIN_TARGET_SIZE).toBe(44)
  })

  it('focus indicator width is 2px', () => {
    expect(FOCUS_INDICATOR_WIDTH).toBe(2)
  })

  it('max alt text length is 125 chars', () => {
    expect(MAX_ALT_TEXT_LENGTH).toBe(125)
  })
})
