import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { calculateTrailProgress, isTrailComplete } from '@/lib/trails/progress'
import { HeritageMap } from '@/components/HeritageMap'
import type { HeritageSiteMarker } from '@/components/HeritageMap'

interface TrailData {
  id: string
  name: string
  theme: string
  description: string | null
  site_count: number
  bonus_points: number
  is_active: boolean
}

interface TrailSite {
  id: string
  name: string
  latitude: number
  longitude: number
  is_active: boolean
  is_unlocked: boolean
}

/**
 * Trail detail page.
 * Shows overview, trail-specific map, progress bar, and site list with lock/unlock status.
 *
 * Validates: Requirements 8.2, 8.3
 */
export default function TrailDetail() {
  const { trailId } = useParams<{ trailId: string }>()
  const { user } = useAuthStore()

  const [trail, setTrail] = useState<TrailData | null>(null)
  const [sites, setSites] = useState<TrailSite[]>([])
  const [unlockedSiteIds, setUnlockedSiteIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completionMessage, setCompletionMessage] = useState<string | null>(null)

  const loadTrailData = useCallback(async () => {
    if (!trailId) return

    setLoading(true)
    setError(null)

    try {
      // Fetch trail info
      const { data: trailData, error: trailError } = await supabase
        .from('trails')
        .select('id, name, theme, description, site_count, bonus_points, is_active')
        .eq('id', trailId)
        .single()

      if (trailError) {
        throw new Error(trailError.message)
      }

      if (!trailData) {
        throw new Error('Trail not found')
      }

      setTrail(trailData)

      // Fetch sites belonging to this trail
      const { data: sitesData, error: sitesError } = await supabase
        .from('heritage_sites')
        .select('id, name, latitude, longitude, is_active')
        .eq('trail_id', trailId)
        .eq('is_active', true)
        .order('name')

      if (sitesError) {
        throw new Error(sitesError.message)
      }

      const trailSites: TrailSite[] = (sitesData ?? []).map((site: any) => ({
        ...site,
        is_unlocked: false,
      }))

      // Fetch user's unlocked sites for this trail
      if (user?.id) {
        const { data: scans } = await supabase
          .from('qr_scans')
          .select('heritage_site_id')
          .eq('user_id', user.id)

        const unlocked = (scans ?? []).map((s: any) => s.heritage_site_id as string)
        setUnlockedSiteIds(unlocked)

        // Mark sites as unlocked
        const sitesWithStatus = trailSites.map((site) => ({
          ...site,
          is_unlocked: unlocked.includes(site.id),
        }))
        setSites(sitesWithStatus)

        // Check trail completion and award bonus (Req 8.3)
        const unlockedInTrail = sitesWithStatus.filter((s) => s.is_unlocked).length
        if (isTrailComplete(sitesWithStatus.length, unlockedInTrail)) {
          const { data: completionResult } = await supabase.rpc(
            'complete_trail_check',
            { p_user_id: user.id, p_trail_id: trailId }
          )

          const result = completionResult as {
            bonus_awarded: boolean
            message: string
          } | null

          if (result?.bonus_awarded) {
            setCompletionMessage(result.message)
          }
        }
      } else {
        setSites(trailSites)
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load trail data. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }, [trailId, user?.id])

  useEffect(() => {
    loadTrailData()
  }, [loadTrailData])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center space-y-4">
          <div className="text-destructive text-4xl" aria-hidden="true">⚠️</div>
          <h2 className="text-lg font-semibold text-foreground">
            Unable to Load Trail
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={loadTrailData}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
            <Link
              to="/app/trails"
              className="px-4 py-2 border rounded-md text-sm hover:bg-muted transition-colors"
            >
              Back to Trails
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (loading || !trail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading trail...</p>
      </div>
    )
  }

  const unlockedCount = sites.filter((s) => s.is_unlocked).length
  const totalCount = sites.length
  const percentage = calculateTrailProgress(totalCount, unlockedCount)
  const completed = isTrailComplete(totalCount, unlockedCount)

  // Prepare map markers
  const mapSites: HeritageSiteMarker[] = sites.map((site) => ({
    id: site.id,
    name: site.name,
    lat: Number(site.latitude),
    lng: Number(site.longitude),
    trail_id: trail.id,
    trail_name: trail.name,
    is_unlocked: site.is_unlocked,
    is_active: site.is_active,
  }))

  return (
    <div className="min-h-screen bg-background">
      {/* Header with back navigation */}
      <div className="border-b bg-card">
        <div className="max-w-3xl mx-auto p-4 md:p-6">
          <Link
            to="/app/trails"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            ← Back to Trails
          </Link>

          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {trail.name}
          </h1>

          {/* Theme badge */}
          <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            {trail.theme}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        {/* Completion message (Req 8.3) */}
        {completionMessage && (
          <div
            className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800"
            role="alert"
          >
            <p className="font-semibold">🎉 {completionMessage}</p>
          </div>
        )}

        {/* Trail overview (Req 8.2) */}
        {trail.description && (
          <section aria-labelledby="trail-overview-heading">
            <h2 id="trail-overview-heading" className="text-lg font-semibold mb-2">
              Overview
            </h2>
            <p className="text-muted-foreground">{trail.description}</p>
          </section>
        )}

        {/* Progress bar (Req 8.2) */}
        <section aria-labelledby="trail-progress-heading">
          <div className="flex items-center justify-between mb-2">
            <h2 id="trail-progress-heading" className="text-lg font-semibold">
              Progress
            </h2>
            <span className="text-sm text-muted-foreground">
              {unlockedCount} / {totalCount} sites unlocked
            </span>
          </div>

          <div
            className="h-3 w-full rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Trail progress: ${percentage}%`}
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                completed ? 'bg-green-500' : 'bg-primary'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-medium text-primary">{percentage}%</span>
            {completed && (
              <span className="text-sm font-medium text-green-600">
                ✓ Completed (+{trail.bonus_points} bonus points)
              </span>
            )}
          </div>
        </section>

        {/* Trail-specific map (Req 8.2) */}
        <section aria-labelledby="trail-map-heading">
          <h2 id="trail-map-heading" className="text-lg font-semibold mb-2">
            Trail Map
          </h2>
          <div className="h-[300px] md:h-[400px] rounded-lg overflow-hidden border">
            {mapSites.length > 0 ? (
              <HeritageMap
                sites={mapSites}
                userUnlockedSiteIds={unlockedSiteIds}
                onMarkerClick={(siteId) => {
                  console.log('Site clicked:', siteId)
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-muted">
                <p className="text-sm text-muted-foreground">
                  No sites to display on the map.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Site list with lock/unlock status (Req 8.2) */}
        <section aria-labelledby="trail-sites-heading">
          <h2 id="trail-sites-heading" className="text-lg font-semibold mb-3">
            Heritage Sites
          </h2>

          {sites.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No heritage sites are assigned to this trail yet.
            </p>
          ) : (
            <ul className="space-y-2" role="list">
              {sites.map((site) => (
                <li
                  key={site.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    site.is_unlocked
                      ? 'bg-green-50 border-green-200'
                      : 'bg-card border-border'
                  }`}
                >
                  {/* Lock/Unlock icon */}
                  <span
                    className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-sm ${
                      site.is_unlocked
                        ? 'bg-green-100 text-green-700'
                        : 'bg-muted text-muted-foreground'
                    }`}
                    aria-hidden="true"
                  >
                    {site.is_unlocked ? '🔓' : '🔒'}
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">
                      {site.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {site.is_unlocked ? 'Unlocked' : 'Locked — scan QR to unlock'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
