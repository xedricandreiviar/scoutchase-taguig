import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { applyPrivacyFilter } from './privacy-filter'
import type { LeaderboardEntry, LeaderboardCategory } from './sort'

/**
 * Property 19: Minor privacy protection
 *
 * For any arbitrary leaderboard entries with mixed minor/non-minor users,
 * the privacy filter SHALL ensure no entry with is_minor=true reveals PII
 * beyond display_name.
 *
 * **Validates: Requirements 21.7**
 */
describe('Property 19: Minor privacy protection', () => {
  // --- Generators ---

  const categoryArb: fc.Arbitrary<LeaderboardCategory> = fc.constantFrom(
    'individual',
    'patrol_troop',
    'school',
    'rover_senior'
  )

  const leaderboardEntryArb: fc.Arbitrary<LeaderboardEntry> = fc.record({
    user_id: fc.uuid(),
    display_name: fc.string({ minLength: 1, maxLength: 30 }),
    full_name: fc.oneof(fc.string({ minLength: 1, maxLength: 50 }), fc.constant(null)),
    school: fc.oneof(fc.string({ minLength: 1, maxLength: 50 }), fc.constant(null)),
    troop_unit_number: fc.oneof(fc.string({ minLength: 1, maxLength: 20 }), fc.constant(null)),
    total_points: fc.integer({ min: 0, max: 10000 }),
    last_point_date: fc.oneof(
      fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).map((d) => d.toISOString()),
      fc.constant(null)
    ),
    is_minor: fc.boolean(),
    category: categoryArb,
    rank: fc.oneof(fc.integer({ min: 1, max: 1000 }), fc.constant(undefined)),
  }) as fc.Arbitrary<LeaderboardEntry>

  const leaderboardEntriesArb = fc.array(leaderboardEntryArb, { minLength: 0, maxLength: 50 })

  // --- Property Tests ---

  it('minor entries have null full_name, school, troop_unit_number after filtering', () => {
    fc.assert(
      fc.property(leaderboardEntriesArb, (entries) => {
        const filtered = applyPrivacyFilter(entries)

        for (const entry of filtered) {
          if (entry.is_minor) {
            expect(entry.full_name).toBeNull()
            expect(entry.school).toBeNull()
            expect(entry.troop_unit_number).toBeNull()
          }
        }
      }),
      { numRuns: 500 }
    )
  })

  it('non-minor entries preserve their original PII fields', () => {
    fc.assert(
      fc.property(leaderboardEntriesArb, (entries) => {
        const filtered = applyPrivacyFilter(entries)

        for (let i = 0; i < entries.length; i++) {
          if (!entries[i].is_minor) {
            expect(filtered[i].full_name).toBe(entries[i].full_name)
            expect(filtered[i].school).toBe(entries[i].school)
            expect(filtered[i].troop_unit_number).toBe(entries[i].troop_unit_number)
          }
        }
      }),
      { numRuns: 500 }
    )
  })

  it('display_name is always preserved for all entries', () => {
    fc.assert(
      fc.property(leaderboardEntriesArb, (entries) => {
        const filtered = applyPrivacyFilter(entries)

        for (let i = 0; i < entries.length; i++) {
          expect(filtered[i].display_name).toBe(entries[i].display_name)
        }
      }),
      { numRuns: 500 }
    )
  })

  it('filter does not change entry count', () => {
    fc.assert(
      fc.property(leaderboardEntriesArb, (entries) => {
        const filtered = applyPrivacyFilter(entries)
        expect(filtered).toHaveLength(entries.length)
      }),
      { numRuns: 500 }
    )
  })

  it('filter is idempotent (applying twice yields same result)', () => {
    fc.assert(
      fc.property(leaderboardEntriesArb, (entries) => {
        const once = applyPrivacyFilter(entries)
        const twice = applyPrivacyFilter(once)

        expect(twice).toEqual(once)
      }),
      { numRuns: 500 }
    )
  })
})
