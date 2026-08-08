import { describe, it, expect } from 'vitest'
import { formatServiceHours } from './format-service-hours'

describe('formatServiceHours', () => {
  it('formats integer hours to 1 decimal place', () => {
    expect(formatServiceHours(5)).toBe('5.0')
  })

  it('formats decimal hours to 1 decimal place', () => {
    expect(formatServiceHours(12.5)).toBe('12.5')
  })

  it('rounds to 1 decimal place when more decimals present', () => {
    expect(formatServiceHours(3.75)).toBe('3.8')
  })

  it('formats 0 as "0.0"', () => {
    expect(formatServiceHours(0)).toBe('0.0')
  })

  it('handles null by returning "0.0"', () => {
    expect(formatServiceHours(null)).toBe('0.0')
  })

  it('handles undefined by returning "0.0"', () => {
    expect(formatServiceHours(undefined)).toBe('0.0')
  })

  it('handles large values with 1 decimal', () => {
    expect(formatServiceHours(100)).toBe('100.0')
  })

  it('handles 0.5 increments correctly', () => {
    expect(formatServiceHours(2.5)).toBe('2.5')
  })
})
