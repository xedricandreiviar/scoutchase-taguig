import { describe, it, expect } from 'vitest'
import { validateDisplayName } from './display-name'

describe('validateDisplayName', () => {
  it('accepts a valid display name with letters and numbers', () => {
    const result = validateDisplayName('Scout123')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts a valid display name with spaces and hyphens', () => {
    const result = validateDisplayName('Scout-Leader One')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts a name at minimum length (3 chars)', () => {
    const result = validateDisplayName('abc')
    expect(result.valid).toBe(true)
  })

  it('accepts a name at maximum length (30 chars)', () => {
    const result = validateDisplayName('a'.repeat(30))
    expect(result.valid).toBe(true)
  })

  it('rejects an empty string', () => {
    const result = validateDisplayName('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Display name is required')
  })

  it('rejects a name shorter than 3 characters', () => {
    const result = validateDisplayName('ab')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Display name must be at least 3 characters')
  })

  it('rejects a name longer than 30 characters', () => {
    const result = validateDisplayName('a'.repeat(31))
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Display name must be at most 30 characters')
  })

  it('rejects special characters', () => {
    const result = validateDisplayName('Scout@123')
    expect(result.valid).toBe(false)
    expect(result.error).toBe(
      'Display name can only contain letters, numbers, spaces, and hyphens'
    )
  })

  it('rejects underscores', () => {
    const result = validateDisplayName('Scout_Name')
    expect(result.valid).toBe(false)
    expect(result.error).toBe(
      'Display name can only contain letters, numbers, spaces, and hyphens'
    )
  })

  it('rejects names with emoji', () => {
    const result = validateDisplayName('Scout 🏕️')
    expect(result.valid).toBe(false)
    expect(result.error).toBe(
      'Display name can only contain letters, numbers, spaces, and hyphens'
    )
  })
})
