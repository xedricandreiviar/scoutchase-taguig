import type { HeritageSiteMarker } from '@/components/HeritageMap'

/**
 * Trail themes available in ScoutChase Taguig.
 */
export const TRAIL_THEMES = [
  'Foundations of Taguig',
  'Heroes and Patriots',
  'Faith and Culture',
  'Lakeshore Communities',
  'Nature and Environmental Conservation',
  'Modern Taguig',
  'Public Art and Monuments',
] as const

export type TrailTheme = (typeof TRAIL_THEMES)[number]

/**
 * Filters heritage site markers by trail theme.
 * Returns only active sites whose trail_name matches the selected theme.
 * Returns an empty array (not an error) when no sites match.
 *
 * Validates: Requirements 5.3
 */
export function filterSitesByTheme(
  sites: HeritageSiteMarker[],
  theme?: string
): HeritageSiteMarker[] {
  if (!theme) {
    return sites.filter((site) => site.is_active)
  }

  return sites.filter((site) => site.is_active && site.trail_name === theme)
}
