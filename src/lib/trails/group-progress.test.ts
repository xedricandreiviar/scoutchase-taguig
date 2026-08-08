import { describe, it, expect } from 'vitest'
import { calculateGroupProgress, getMemberUnlockCount } from './group-progress'

describe('calculateGroupProgress', () => {
  it('returns 0 progress for empty member unlocks', () => {
    const result = calculateGroupProgress([], 5)
    expect(result.progress).toBe(0)
    expect(result.isComplete).toBe(false)
    expect(result.uniqueSitesUnlocked).toBe(0)
  })

  it('returns 0 progress when totalSites is 0', () => {
    const result = calculateGroupProgress([['site-1']], 0)
    expect(result.progress).toBe(0)
    expect(result.isComplete).toBe(false)
  })

  it('returns 0 progress when totalSites is negative', () => {
    const result = calculateGroupProgress([['site-1']], -3)
    expect(result.progress).toBe(0)
    expect(result.isComplete).toBe(false)
  })

  it('calculates correct progress for partial unlock', () => {
    const memberUnlocks = [
      ['site-1', 'site-2'],
      ['site-2', 'site-3'],
    ]
    const result = calculateGroupProgress(memberUnlocks, 5)
    // Union: site-1, site-2, site-3 = 3 out of 5 = 60%
    expect(result.progress).toBe(60)
    expect(result.isComplete).toBe(false)
    expect(result.uniqueSitesUnlocked).toBe(3)
  })

  it('marks as complete when all sites unlocked across members', () => {
    const memberUnlocks = [
      ['site-1', 'site-2'],
      ['site-3', 'site-4'],
      ['site-5'],
    ]
    const result = calculateGroupProgress(memberUnlocks, 5)
    expect(result.progress).toBe(100)
    expect(result.isComplete).toBe(true)
    expect(result.uniqueSitesUnlocked).toBe(5)
  })

  it('handles duplicate sites within a single member', () => {
    const memberUnlocks = [
      ['site-1', 'site-1', 'site-2'],
    ]
    const result = calculateGroupProgress(memberUnlocks, 4)
    // Unique: site-1, site-2 = 2 out of 4 = 50%
    expect(result.progress).toBe(50)
    expect(result.uniqueSitesUnlocked).toBe(2)
  })

  it('caps uniqueSitesUnlocked at totalSites', () => {
    // Edge case: more unique IDs than totalSites (shouldn't normally happen)
    const memberUnlocks = [
      ['site-1', 'site-2', 'site-3', 'site-4'],
    ]
    const result = calculateGroupProgress(memberUnlocks, 3)
    expect(result.uniqueSitesUnlocked).toBe(3)
    expect(result.progress).toBe(100)
    expect(result.isComplete).toBe(true)
  })

  it('returns 100% when single member unlocks all sites', () => {
    const memberUnlocks = [
      ['a', 'b', 'c'],
    ]
    const result = calculateGroupProgress(memberUnlocks, 3)
    expect(result.progress).toBe(100)
    expect(result.isComplete).toBe(true)
  })
})

describe('getMemberUnlockCount', () => {
  it('returns 0 for empty array', () => {
    expect(getMemberUnlockCount([])).toBe(0)
  })

  it('returns correct count for unique site IDs', () => {
    expect(getMemberUnlockCount(['a', 'b', 'c'])).toBe(3)
  })

  it('deduplicates site IDs', () => {
    expect(getMemberUnlockCount(['a', 'a', 'b', 'b', 'c'])).toBe(3)
  })
})
