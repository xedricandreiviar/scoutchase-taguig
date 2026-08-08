import { describe, it, expect } from 'vitest'
import { sortLeaderboard, type LeaderboardEntry } from './sort'

function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    user_id: 'user-1',
    display_name: 'Scout A',
    full_name: 'Full Name A',
    school: null,
    troop_unit_number: null,
    total_points: 100,
    last_point_date: '2024-06-01T10:00:00Z',
    is_minor: false,
    category: 'individual',
    ...overrides,
  }
}

describe('sortLeaderboard', () => {
  it('sorts entries by total_points descending', () => {
    const entries: LeaderboardEntry[] = [
      makeEntry({ user_id: 'a', total_points: 50 }),
      makeEntry({ user_id: 'b', total_points: 200 }),
      makeEntry({ user_id: 'c', total_points: 100 }),
    ]

    const result = sortLeaderboard(entries)

    expect(result[0].user_id).toBe('b')
    expect(result[1].user_id).toBe('c')
    expect(result[2].user_id).toBe('a')
  })

  it('breaks ties by earlier last_point_date (earlier ranks higher)', () => {
    const entries: LeaderboardEntry[] = [
      makeEntry({ user_id: 'a', total_points: 100, last_point_date: '2024-06-15T10:00:00Z' }),
      makeEntry({ user_id: 'b', total_points: 100, last_point_date: '2024-06-01T10:00:00Z' }),
      makeEntry({ user_id: 'c', total_points: 100, last_point_date: '2024-06-10T10:00:00Z' }),
    ]

    const result = sortLeaderboard(entries)

    expect(result[0].user_id).toBe('b')
    expect(result[1].user_id).toBe('c')
    expect(result[2].user_id).toBe('a')
  })

  it('null last_point_date sorts to the end among ties', () => {
    const entries: LeaderboardEntry[] = [
      makeEntry({ user_id: 'a', total_points: 100, last_point_date: null }),
      makeEntry({ user_id: 'b', total_points: 100, last_point_date: '2024-06-01T10:00:00Z' }),
    ]

    const result = sortLeaderboard(entries)

    expect(result[0].user_id).toBe('b')
    expect(result[1].user_id).toBe('a')
  })

  it('assigns ranks starting from 1', () => {
    const entries: LeaderboardEntry[] = [
      makeEntry({ user_id: 'a', total_points: 300 }),
      makeEntry({ user_id: 'b', total_points: 200 }),
      makeEntry({ user_id: 'c', total_points: 100 }),
    ]

    const result = sortLeaderboard(entries)

    expect(result[0].rank).toBe(1)
    expect(result[1].rank).toBe(2)
    expect(result[2].rank).toBe(3)
  })

  it('handles empty array', () => {
    const result = sortLeaderboard([])
    expect(result).toEqual([])
  })

  it('handles single entry', () => {
    const entries = [makeEntry({ user_id: 'solo', total_points: 42 })]
    const result = sortLeaderboard(entries)

    expect(result).toHaveLength(1)
    expect(result[0].rank).toBe(1)
    expect(result[0].total_points).toBe(42)
  })

  it('does not mutate the original array', () => {
    const entries: LeaderboardEntry[] = [
      makeEntry({ user_id: 'a', total_points: 50 }),
      makeEntry({ user_id: 'b', total_points: 200 }),
    ]

    const original = [...entries]
    sortLeaderboard(entries)

    expect(entries[0].user_id).toBe(original[0].user_id)
    expect(entries[1].user_id).toBe(original[1].user_id)
  })
})
