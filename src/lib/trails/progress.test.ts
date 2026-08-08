import { describe, it, expect } from 'vitest'
import { calculateTrailProgress, isTrailComplete } from './progress'

describe('calculateTrailProgress', () => {
  it('returns 0 when no sites are unlocked', () => {
    expect(calculateTrailProgress(5, 0)).toBe(0)
  })

  it('returns 100 when all sites are unlocked', () => {
    expect(calculateTrailProgress(5, 5)).toBe(100)
  })

  it('returns correct percentage for partial progress', () => {
    expect(calculateTrailProgress(10, 3)).toBe(30)
    expect(calculateTrailProgress(4, 1)).toBe(25)
    expect(calculateTrailProgress(3, 2)).toBe(67)
  })

  it('returns 0 when totalSites is 0', () => {
    expect(calculateTrailProgress(0, 0)).toBe(0)
    expect(calculateTrailProgress(0, 5)).toBe(0)
  })

  it('returns 0 when totalSites is negative', () => {
    expect(calculateTrailProgress(-1, 0)).toBe(0)
  })

  it('caps at 100 when unlockedSites exceeds totalSites', () => {
    expect(calculateTrailProgress(3, 5)).toBe(100)
  })

  it('treats negative unlockedSites as 0', () => {
    expect(calculateTrailProgress(5, -2)).toBe(0)
  })

  it('rounds to nearest integer', () => {
    // 1/3 = 33.33... → 33
    expect(calculateTrailProgress(3, 1)).toBe(33)
    // 2/3 = 66.66... → 67
    expect(calculateTrailProgress(3, 2)).toBe(67)
  })
})

describe('isTrailComplete', () => {
  it('returns true when all sites are unlocked', () => {
    expect(isTrailComplete(5, 5)).toBe(true)
  })

  it('returns true when unlockedSites exceeds totalSites', () => {
    expect(isTrailComplete(3, 4)).toBe(true)
  })

  it('returns false when not all sites are unlocked', () => {
    expect(isTrailComplete(5, 4)).toBe(false)
    expect(isTrailComplete(10, 0)).toBe(false)
  })

  it('returns false when totalSites is 0', () => {
    expect(isTrailComplete(0, 0)).toBe(false)
  })

  it('returns false when totalSites is negative', () => {
    expect(isTrailComplete(-1, 0)).toBe(false)
  })
})
