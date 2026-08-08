import { describe, it, expect } from 'vitest'
import { validateGroupSize } from './group-trail'

describe('validateGroupSize', () => {
  it('accepts invitee count of 1 (minimum)', () => {
    const result = validateGroupSize(1)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts invitee count of 9 (maximum)', () => {
    const result = validateGroupSize(9)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts invitee count of 5 (middle)', () => {
    const result = validateGroupSize(5)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('rejects invitee count of 0', () => {
    const result = validateGroupSize(0)
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('rejects invitee count of 10 (exceeds max)', () => {
    const result = validateGroupSize(10)
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('rejects negative invitee count', () => {
    const result = validateGroupSize(-1)
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('rejects non-integer invitee count', () => {
    const result = validateGroupSize(3.5)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('whole number')
  })
})
