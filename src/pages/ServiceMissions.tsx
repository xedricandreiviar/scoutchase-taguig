import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

interface ServiceMission {
  id: string
  name: string
  description: string | null
  mission_type: string
  is_active: boolean
  trail_id: string
  trail_name: string
}

interface GroupedMissions {
  trail_id: string
  trail_name: string
  missions: ServiceMission[]
}

/**
 * Service Missions listing page.
 * Displays active service missions grouped by trail.
 *
 * Validates: Requirements 10.1
 */
export default function ServiceMissions() {
  const { user } = useAuthStore()
  const [grouped, setGrouped] = useState<GroupedMissions[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMissions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('service_missions')
        .select(`
          id,
          name,
          description,
          mission_type,
          is_active,
          trail_id,
          trails ( name )
        `)
        .eq('is_active', true)
        .order('name')

      if (fetchError) {
        throw new Error(fetchError.message)
      }

      // Transform and group by trail
      const missions: ServiceMission[] = (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        mission_type: row.mission_type,
        is_active: row.is_active,
        trail_id: row.trail_id,
        trail_name: row.trails?.name ?? 'Unknown Trail',
      }))

      // Group missions by trail
      const groupMap = new Map<string, GroupedMissions>()
      for (const mission of missions) {
        if (!groupMap.has(mission.trail_id)) {
          groupMap.set(mission.trail_id, {
            trail_id: mission.trail_id,
            trail_name: mission.trail_name,
            missions: [],
          })
        }
        groupMap.get(mission.trail_id)!.missions.push(mission)
      }

      setGrouped(Array.from(groupMap.values()).sort((a, b) => a.trail_name.localeCompare(b.trail_name)))
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load service missions. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMissions()
  }, [loadMissions])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center space-y-4">
          <div className="text-destructive text-4xl" aria-hidden="true">⚠️</div>
          <h2 className="text-lg font-semibold text-foreground">
            Unable to Load Service Missions
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          <button
            onClick={loadMissions}
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
        <p className="text-muted-foreground">Loading service missions...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-primary">Service Missions</h1>
          {user && (
            <Link
              to="/app/service/log"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              Log Hours
            </Link>
          )}
        </div>
        <p className="text-muted-foreground">
          Community service missions linked to heritage trails. Complete missions to earn service hours and points.
        </p>

        {grouped.length === 0 ? (
          <div className="bg-card rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">
              No active service missions are currently available.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <section key={group.trail_id} className="space-y-3">
                <h2 className="text-xl font-semibold text-foreground border-b pb-2">
                  {group.trail_name}
                </h2>
                <div className="space-y-3">
                  {group.missions.map((mission) => (
                    <div
                      key={mission.id}
                      className="bg-card rounded-lg border p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-medium text-foreground">
                          {mission.name}
                        </h3>
                        <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
                          {mission.mission_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {mission.description && (
                        <p className="text-sm text-muted-foreground">
                          {mission.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
