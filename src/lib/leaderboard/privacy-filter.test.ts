import { describe, it, expect } from 'vitest'
import { applyPrivacyFilter } from './privacy-filter'
import type { LeaderboardEntry } from './sort'

function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    user_id: 'user-1',
    display_name: 'ScoutNick',
    full_name: 'Juan Dela Cruz',
    school: 'Taguig Science High',
    troop_unit_number: 'T101',
    total_points: 100,
    last_point_date: '2024-06-01T10:00:00Z',
    is_minor: false,
    category: 'individual',
    rank: 1,
    ...overrides,
  }
}

describe('applyPrivacyFilter', () => {
  it('redacts PII for minor entries (is_minor = true)', () => {
    const entries = [makeEntry({ is_minor: true })]
    const result = applyPrivacyFilter(entries)

    expect(result[0].display_name).toBe('ScoutNick')
    expect(result[0].full_name).toBeNull()
    expect(result[0].school).toBeNull()
    expect(result[0].troop_unit_number).toBeNull()
  })

  it('preserves all fields for non-minor entries', () => {
    const entries = [makeEntry({ is_minor: false })]
    const result = applyPrivacyFilter(entries)

    expect(result[0].display_name).toBe('ScoutNick')
    expect(result[0].full_name).toBe('Juan Dela Cruz')
    expect(result[0].school).toBe('Taguig Science High')
    expect(result[0].troop_unit_number).toBe('T101')
  })

  it('preserves non-PII fields for minors', () => {
    const entries = [makeEntry({ is_minor: true, total_points: 250, rank: 5 })]
    const result = applyPrivacyFilter(entries)

    expect(result[0].user_id).toBe('user-1')
    expect(result[0].total_points).toBe(250)
    expect(result[0].rank).toBe(5)
    expect(result[0].category).toBe('individual')
    expect(result[0].last_point_date).toBe('2024-06-01T10:00:00Z')
  })

  it('handles mixed minor and non-minor entries', () => {
    const entries = [
      makeEntry({ user_id: 'minor-1', is_minor: true, full_name: 'Child Name' }),
      makeEntry({ user_id: 'adult-1', is_minor: false, full_name: 'Adult Name' }),
    ]
    const result = applyPrivacyFilter(entries)

    expect(result[0].full_name).toBeNull()
    expect(result[1].full_name).toBe('Adult Name')
  })

  it('handles empty array', () => {
    const result = applyPrivacyFilter([])
    expect(result).toEqual([])
  })

  it('does not mutate original entries', () => {
    const entries = [makeEntry({ is_minor: true, full_name: 'Secret Name' })]
    const original = entries[0].full_name

    applyPrivacyFilter(entries)

    expect(entries[0].full_name).toBe(original)
  })
})
