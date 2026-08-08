import { useState, useEffect, useCallback } from 'react'
import { HeritageMap } from '@/components/HeritageMap'
import type { HeritageSiteMarker } from '@/components/HeritageMap'
import { filterSitesByTheme, TRAIL_THEMES } from '@/lib/map/filter-sites'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

/**
 * Interactive Heritage Map page.
 * Displays a pannable/zoomable Leaflet map with pin markers for all active heritage sites.
 * Supports filtering by trail theme and shows unlocked vs locked state.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */
export default function Map() {
  const { user } = useAuthStore()

  const [allSites, setAllSites] = useState<HeritageSiteMarker[]>([])
  const [unlockedSiteIds, setUnlockedSiteIds] = useState<string[]>([])
  const [selectedTheme, setSelectedTheme] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMapData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch active heritage sites with trail info
      const { data: sites, error: sitesError } = await supabase
        .from('heritage_sites')
        .select(`
          id,
          name,
          latitude,
          longitude,
          trail_id,
          is_active,
          trails ( name, theme )
        `)
        .eq('is_active', true)

      if (sitesError) {
        throw new Error(sitesError.message)
      }

      const mappedSites: HeritageSiteMarker[] = (sites ?? []).map((site: any) => ({
        id: site.id,
        name: site.name,
        lat: Number(site.latitude),
        lng: Number(site.longitude),
        trail_id: site.trail_id ?? '',
        trail_name: site.trails?.name ?? 'Unassigned',
        is_unlocked: false,
        is_active: site.is_active,
      }))

      setAllSites(mappedSites)

      // Fetch user's unlocked sites
      if (user?.id) {
        const { data: scans, error: scansError } = await supabase
          .from('qr_scans')
          .select('heritage_site_id')
          .eq('user_id', user.id)

        if (!scansError && scans) {
          setUnlockedSiteIds(scans.map((s: any) => s.heritage_site_id))
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load map data. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadMapData()
  }, [loadMapData])

  const handleMarkerClick = (siteId: string) => {
    // Navigate to site content when implemented
    console.log('Marker clicked:', siteId)
  }

  const filteredSites = filterSitesByTheme(allSites, selectedTheme || undefined)

  // Error state with retry (Req 5.5)
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6">
        <div className="text-center space-y-4">
          <div className="text-destructive text-4xl" aria-hidden="true">⚠️</div>
          <h2 className="text-lg font-semibold text-foreground">
            Map Unavailable
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {error}
          </p>
          <button
            onClick={loadMapData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Trail theme filter UI (Req 5.3) */}
      <div className="p-3 border-b border-border bg-background">
        <label htmlFor="trail-filter" className="sr-only">
          Filter by trail theme
        </label>
        <select
          id="trail-filter"
          value={selectedTheme}
          onChange={(e) => setSelectedTheme(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Filter map by trail theme"
        >
          <option value="">All Trails</option>
          {TRAIL_THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
        </select>
      </div>

      {/* Empty state message (Req 5.3) */}
      {filteredSites.length === 0 && !loading && (
        <div className="p-4 text-center bg-muted/50">
          <p className="text-sm text-muted-foreground">
            No heritage sites match the selected filter.
          </p>
        </div>
      )}

      {/* Map container */}
      <div className="flex-1 min-h-[300px] relative">
        <HeritageMap
          sites={filteredSites}
          selectedTrailFilter={selectedTheme || undefined}
          userUnlockedSiteIds={unlockedSiteIds}
          onMarkerClick={handleMarkerClick}
        />
      </div>
    </div>
  )
}
