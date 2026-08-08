import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { filterSitesByTheme, TRAIL_THEMES } from './filter-sites'
import type { HeritageSiteMarker } from '@/components/HeritageMap'

/**
 * Property 7: Map theme filtering
 *
 * For any set of heritage sites with various trail themes and a selected theme filter,
 * the filtered result SHALL contain only sites whose trail theme matches the filter,
 * and SHALL return an empty set (not an error) when no sites match.
 *
 * **Validates: Requirements 5.3**
 */
describe('Property 7: Map theme filtering', () => {
  // --- Generators ---

  /** Generate an arbitrary trail theme from the TRAIL_THEMES constant */
  const arbTrailTheme = fc.constantFrom(...TRAIL_THEMES)

  /** Generate an arbitrary HeritageSiteMarker */
  const arbSiteMarker: fc.Arbitrary<HeritageSiteMarker> = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    lat: fc.double({ min: 14.4, max: 14.6, noNaN: true }),
    lng: fc.double({ min: 120.9, max: 121.2, noNaN: true }),
    trail_id: fc.uuid(),
    trail_name: arbTrailTheme,
    is_unlocked: fc.boolean(),
    is_active: fc.boolean(),
  })

  /** Generate a list of arbitrary site markers */
  const arbSiteList = fc.array(arbSiteMarker, { minLength: 0, maxLength: 30 })

  it('filtered result only contains sites matching the selected theme', () => {
    fc.assert(
      fc.property(arbSiteList, arbTrailTheme, (sites, theme) => {
        const result = filterSitesByTheme(sites, theme)

        for (const site of result) {
          expect(site.trail_name).toBe(theme)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('when no sites match the filter, result is an empty array (not error)', () => {
    fc.assert(
      fc.property(arbSiteList, arbTrailTheme, (sites, theme) => {
        // Remove all sites that match the theme to guarantee no match
        const sitesWithoutTheme = sites.map((s) => ({
          ...s,
          trail_name: TRAIL_THEMES.find((t) => t !== theme) ?? TRAIL_THEMES[0],
        }))

        // Also ensure at least some are active to confirm filter runs properly
        const result = filterSitesByTheme(sitesWithoutTheme, theme)

        expect(result).toBeInstanceOf(Array)
        expect(result.length).toBe(0)
      }),
      { numRuns: 200 }
    )
  })

  it('when no filter is applied, result contains all active sites', () => {
    fc.assert(
      fc.property(arbSiteList, (sites) => {
        const result = filterSitesByTheme(sites, undefined)

        const activeSites = sites.filter((s) => s.is_active)
        expect(result.length).toBe(activeSites.length)

        for (const site of result) {
          expect(site.is_active).toBe(true)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('result is always a subset of the input', () => {
    fc.assert(
      fc.property(arbSiteList, fc.option(arbTrailTheme, { nil: undefined }), (sites, theme) => {
        const result = filterSitesByTheme(sites, theme)

        for (const site of result) {
          expect(sites).toContainEqual(site)
        }
        expect(result.length).toBeLessThanOrEqual(sites.length)
      }),
      { numRuns: 200 }
    )
  })

  it('inactive sites are never included regardless of filter', () => {
    fc.assert(
      fc.property(arbSiteList, fc.option(arbTrailTheme, { nil: undefined }), (sites, theme) => {
        const result = filterSitesByTheme(sites, theme)

        for (const site of result) {
          expect(site.is_active).toBe(true)
        }
      }),
      { numRuns: 200 }
    )
  })
})
