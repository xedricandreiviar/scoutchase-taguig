import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

interface GroupTrailAttempt {
  id: string
  trail_id: string
  leader_id: string
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
  completed_at: string | null
  trail_name: string
  trail_theme: string
  member_count: number
}

/**
 * Group Trail Attempts listing page.
 * Shows the user's active and past group trail attempts.
 * Senior Scouts can create new group attempts from this page.
 *
 * Validates: Requirements 17.1, 17.4
 */
export default function GroupTrails() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [attempts, setAttempts] = useState<GroupTrailAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAttempts = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    setError(null)

    try {
      // Fetch attempts where user is leader or a member
      const { data: leaderAttempts, error: leaderError } = await supabase
        .from('group_trail_attempts')
        .select(`
          id,
          trail_id,
          leader_id,
          status,
          created_at,
          completed_at,
          trails ( name, theme )
        `)
        .eq('leader_id', user.id)
        .order('created_at', { ascending: false })

      if (leaderError) throw new Error(leaderError.message)

      // Also fetch attempts where user is a member (accepted)
      const { data: memberData, error: memberError } = await supabase
        .from('group_trail_members')
        .select(`
          attempt_id,
          group_trail_attempts (
            id,
            trail_id,
            leader_id,
            status,
            created_at,
            completed_at,
            trails ( name, theme )
          )
        `)
        .eq('user_id', user.id)
        .eq('invitation_status', 'accepted')

      if (memberError) throw new Error(memberError.message)

      // Combine and deduplicate
      const allAttempts = new Map<string, GroupTrailAttempt>()

      for (const attempt of leaderAttempts ?? []) {
        const trail = attempt.trails as unknown as { name: string; theme: string } | null
        allAttempts.set(attempt.id, {
          id: attempt.id,
          trail_id: attempt.trail_id,
          leader_id: attempt.leader_id,
          status: attempt.status,
          created_at: attempt.created_at,
          completed_at: attempt.completed_at,
          trail_name: trail?.name ?? 'Unknown Trail',
          trail_theme: trail?.theme ?? '',
          member_count: 0,
        })
      }

      for (const member of memberData ?? []) {
        const attempt = member.group_trail_attempts as unknown as {
          id: string
          trail_id: string
          leader_id: string
          status: 'active' | 'completed' | 'cancelled'
          created_at: string
          completed_at: string | null
          trails: { name: string; theme: string } | null
        } | null
        if (attempt && !allAttempts.has(attempt.id)) {
          allAttempts.set(attempt.id, {
            id: attempt.id,
            trail_id: attempt.trail_id,
            leader_id: attempt.leader_id,
            status: attempt.status,
            created_at: attempt.created_at,
            completed_at: attempt.completed_at,
            trail_name: attempt.trails?.name ?? 'Unknown Trail',
            trail_theme: attempt.trails?.theme ?? '',
            member_count: 0,
          })
        }
      }

      // Get member counts for each attempt
      const attemptIds = Array.from(allAttempts.keys())
      if (attemptIds.length > 0) {
        const { data: memberCounts } = await supabase
          .from('group_trail_members')
          .select('attempt_id')
          .in('attempt_id', attemptIds)
          .eq('invitation_status', 'accepted')

        if (memberCounts) {
          const counts: Record<string, number> = {}
          for (const m of memberCounts) {
            counts[m.attempt_id] = (counts[m.attempt_id] ?? 0) + 1
          }
          for (const [id, attempt] of allAttempts) {
            // +1 for the leader
            attempt.member_count = (counts[id] ?? 0) + 1
          }
        }
      }

      setAttempts(Array.from(allAttempts.values()))
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load group trail attempts.'
      )
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadAttempts()
  }, [loadAttempts])

  const isSeniorScout = user?.role === 'Senior_Scout'

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center space-y-4">
          <div className="text-destructive text-4xl" aria-hidden="true">⚠️</div>
          <h2 className="text-lg font-semibold text-foreground">
            Unable to Load Group Trails
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          <button
            onClick={loadAttempts}
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
        <p className="text-muted-foreground">Loading group trail attempts...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-primary">Group Trails</h1>
          {isSeniorScout && (
            <button
              onClick={() => navigate('/app/group-trails/create')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              Create Group Attempt
            </button>
          )}
        </div>
        <p className="text-muted-foreground">
          Explore trails together as a group. Senior Scouts can lead group attempts and invite members.
        </p>

        {/* Pending invitations */}
        {!isSeniorScout && (
          <p className="text-sm text-muted-foreground">
            Only Senior Scouts can create group trail attempts. You can join groups when invited.
          </p>
        )}

        {attempts.length === 0 ? (
          <div className="bg-card rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">
              No group trail attempts yet.
              {isSeniorScout && ' Create one to get started!'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {attempts.map((attempt) => (
              <Link
                key={attempt.id}
                to={`/app/group-trails/${attempt.id}`}
                className="block bg-card rounded-lg border p-5 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <h2 className="text-lg font-semibold text-foreground truncate">
                      {attempt.trail_name}
                    </h2>
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {attempt.trail_theme}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {attempt.member_count} member{attempt.member_count !== 1 ? 's' : ''}
                      {attempt.leader_id === user?.id && ' • You are the leader'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Started {new Date(attempt.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex-shrink-0">
                    <span
                      className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
                        attempt.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : attempt.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {attempt.status === 'active'
                        ? 'Active'
                        : attempt.status === 'completed'
                          ? 'Completed'
                          : 'Cancelled'}
                    </span>
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
