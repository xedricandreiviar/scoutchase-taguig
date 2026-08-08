import { describe, it, expect } from 'vitest'
import { validateTrailSiteCount } from './trail'

describe('validateTrailSiteCount', () => {
  it('accepts count of 2 (minimum)', () => {
    const result = validateTrailSiteCount(2)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts count of 30 (maximum)', () => {
    const result = validateTrailSiteCount(30)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts count between 2 and 30', () => {
    expect(validateTrailSiteCount(5).valid).toBe(true)
    expect(validateTrailSiteCount(15).valid).toBe(true)
    expect(validateTrailSiteCount(29).valid).toBe(true)
  })

  it('rejects count of 0', () => {
    const result = validateTrailSiteCount(0)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('at least 2')
  })

  it('rejects count of 1 (below minimum)', () => {
    const result = validateTrailSiteCount(1)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('at least 2')
  })

  it('rejects count of 31 (above maximum)', () => {
    const result = validateTrailSiteCount(31)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('more than 30')
  })

  it('rejects negative count', () => {
    const result = validateTrailSiteCount(-5)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('at least 2')
  })

  it('rejects non-integer count', () => {
    const result = validateTrailSiteCount(5.5)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('whole number')
  })
})
