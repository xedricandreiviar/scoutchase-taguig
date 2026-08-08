import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { sortPartnersAlphabetically, type Partner } from './sort'

/**
 * Property 20: Partners alphabetical ordering
 *
 * For any set of partner organizations, the sorting function SHALL produce
 * output sorted in ascending alphabetical order by name using case-insensitive
 * comparison.
 *
 * **Validates: Requirements 13.1**
 */
describe('Property 20: Partners alphabetical ordering', () => {
  // --- Generators ---

  /** Generate a single Partner */
  const partnerArb: fc.Arbitrary<Partner> = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
    logo_url: fc.webUrl(),
    is_active: fc.boolean(),
    created_at: fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map((d) => d.toISOString()),
    updated_at: fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map((d) => d.toISOString()),
  })

  /** Generate an array of partners (0–50) */
  const partnerListArb = fc.array(partnerArb, { minLength: 0, maxLength: 50 })

  // --- Property Tests ---

  it('output is in ascending alphabetical order (case-insensitive)', () => {
    fc.assert(
      fc.property(partnerListArb, (partners) => {
        const result = sortPartnersAlphabetically(partners)

        for (let i = 1; i < result.length; i++) {
          const cmp = result[i - 1].name
            .toLowerCase()
            .localeCompare(result[i].name.toLowerCase())
          expect(cmp).toBeLessThanOrEqual(0)
        }
      }),
      { numRuns: 500 }
    )
  })

  it('output contains same elements as input (no loss/addition)', () => {
    fc.assert(
      fc.property(partnerListArb, (partners) => {
        const result = sortPartnersAlphabetically(partners)

        // Same length
        expect(result.length).toBe(partners.length)

        // All IDs from input are present in output
        const inputIds = partners.map((p) => p.id).sort()
        const outputIds = result.map((p) => p.id).sort()
        expect(outputIds).toEqual(inputIds)
      }),
      { numRuns: 500 }
    )
  })

  it('function is idempotent (sorting an already-sorted list produces same result)', () => {
    fc.assert(
      fc.property(partnerListArb, (partners) => {
        const firstSort = sortPartnersAlphabetically(partners)
        const secondSort = sortPartnersAlphabetically(firstSort)

        expect(secondSort.map((p) => p.id)).toEqual(firstSort.map((p) => p.id))
        expect(secondSort.map((p) => p.name)).toEqual(firstSort.map((p) => p.name))
      }),
      { numRuns: 500 }
    )
  })

  it('function is deterministic (same input produces same output)', () => {
    fc.assert(
      fc.property(partnerListArb, (partners) => {
        const result1 = sortPartnersAlphabetically(partners)
        const result2 = sortPartnersAlphabetically(partners)

        expect(result1.map((p) => p.id)).toEqual(result2.map((p) => p.id))
        expect(result1.map((p) => p.name)).toEqual(result2.map((p) => p.name))
      }),
      { numRuns: 300 }
    )
  })
})
