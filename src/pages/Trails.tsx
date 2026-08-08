import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { calculateTrailProgress } from '@/lib/trails/progress'

interface Trail {
  id: string
  name: string
  theme: string
  description: string | null
  site_count: number
  is_active: boolean
}

interface TrailWithProgress extends Trail {
  unlockedSites: number
  percentage: number
}

/**
 * Trail listing page.
 * Displays all active trails with theme badges, site counts, and user progress.
 *
 * Validates: Requirements 8.1, 8.2
 */
export default function Trails() {
  const { user } = useAuthStore()
  const [trails, setTrails] = useState<TrailWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTrails = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch all active trails
      const { data: trailData, error: trailError } = await supabase
        .from('trails')
        .select('id, name, theme, description, site_count, is_active')
        .eq('is_active', true)
        .order('name')

      if (trailError) {
        throw new Error(trailError.message)
      }

      const activeTrails: Trail[] = trailData ?? []

      // Fetch user progress for each trail
      if (user?.id && activeTrails.length > 0) {
        const trailsWithProgress: TrailWithProgress[] = await Promise.all(
          activeTrails.map(async (trail) => {
            const { data: progressData } = await supabase.rpc(
              'get_trail_progress',
              { p_user_id: user.id, p_trail_id: trail.id }
            )

            const progress = progressData as {
              unlocked_sites: number
              percentage: number
            } | null

            return {
              ...trail,
              unlockedSites: progress?.unlocked_sites ?? 0,
              percentage: progress?.percentage ?? calculateTrailProgress(trail.site_count, 0),
            }
          })
        )

        setTrails(trailsWithProgress)
      } else {
        setTrails(
          activeTrails.map((trail) => ({
            ...trail,
            unlockedSites: 0,
            percentage: 0,
          }))
        )
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load trails. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadTrails()
  }, [loadTrails])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center space-y-4">
          <div className="text-destructive text-4xl" aria-hidden="true">⚠️</div>
          <h2 className="text-lg font-semibold text-foreground">
            Unable to Load Trails
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          <button
            onClick={loadTrails}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading trails...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-primary">Heritage Trails</h1>
        <p className="text-muted-foreground">
          Explore themed trails through Taguig's heritage sites. Unlock all sites in a trail to earn bonus points.
        </p>

        {trails.length === 0 ? (
          <div className="bg-card rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">
              No trails are currently available.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {trails.map((trail) => (
              <Link
                key={trail.id}
                to={`/app/trails/${trail.id}`}
                className="block bg-card rounded-lg border p-5 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <h2 className="text-lg font-semibold text-foreground truncate">
                      {trail.name}
                    </h2>

                    {/* Theme badge */}
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {trail.theme}
                    </span>

                    {trail.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {trail.description}
                      </p>
                    )}

                    {/* Site count */}
                    <p className="text-xs text-muted-foreground">
                      {trail.site_count} heritage site{trail.site_count !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Progress indicator */}
                  <div className="flex-shrink-0 flex flex-col items-center justify-center w-16">
                    <span className="text-xl font-bold text-primary">
                      {trail.percentage}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {trail.unlockedSites}/{trail.site_count}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div
                    className="h-2 w-full rounded-full bg-muted overflow-hidden"
                    role="progressbar"
                    aria-valuenow={trail.percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${trail.name} progress: ${trail.percentage}%`}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${trail.percentage}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
