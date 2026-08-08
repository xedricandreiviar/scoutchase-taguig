import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { cn } from './utils'

describe('cn utility', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', 'always')).toBe('base always')
  })

  it('should merge conflicting tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('property: cn always returns a string', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(fc.string(), fc.boolean(), fc.constant(undefined), fc.constant(null))),
        (inputs) => {
          const result = cn(...inputs)
          expect(typeof result).toBe('string')
        }
      )
    )
  })
})
