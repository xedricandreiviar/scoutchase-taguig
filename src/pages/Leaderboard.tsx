import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { sortLeaderboard, type LeaderboardEntry, type LeaderboardCategory } from '@/lib/leaderboard/sort'
import { applyPrivacyFilter } from '@/lib/leaderboard/privacy-filter'

const CATEGORIES: { value: LeaderboardCategory; label: string }[] = [
  { value: 'individual', label: 'Individual' },
  { value: 'patrol_troop', label: 'Patrol / Troop' },
  { value: 'school', label: 'School' },
  { value: 'rover_senior', label: 'Rover / Senior' },
]

export default function Leaderboard() {
  const { user } = useAuthStore()
  const [category, setCategory] = useState<LeaderboardCategory>('individual')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeaderboard = useCallback(async (cat: LeaderboardCategory) => {
    setIsLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('get_leaderboard', {
      p_category: cat,
      p_limit: 100,
      p_offset: 0,
    })

    if (rpcError) {
      setError(rpcError.message)
      setIsLoading(false)
      return
    }

    const rawEntries: LeaderboardEntry[] = (data ?? []).map((row: Record<string, unknown>) => ({
      user_id: row.user_id as string,
      display_name: row.display_name as string,
      full_name: row.full_name as string | null,
      school: row.school as string | null,
      troop_unit_number: row.troop_unit_number as string | null,
      total_points: row.total_points as number,
      last_point_date: row.last_point_date as string | null,
      is_minor: row.is_minor as boolean,
      category: cat,
    }))

    // Apply client-side sort (ensures consistency) and privacy filter
    const sorted = sortLeaderboard(rawEntries)
    const filtered = applyPrivacyFilter(sorted)
    setEntries(filtered)
    setIsLoading(false)
  }, [])

  // Fetch leaderboard when category changes
  useEffect(() => {
    fetchLeaderboard(category)
  }, [category, fetchLeaderboard])

  // Supabase Realtime subscription for live updates (Req 11.5)
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: 'total_points=gt.0',
        },
        () => {
          // Refetch leaderboard on any profile points change
          fetchLeaderboard(category)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'points_ledger',
        },
        () => {
          // Refetch when new points are awarded
          fetchLeaderboard(category)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [category, fetchLeaderboard])

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <h1 className="text-3xl font-bold text-primary">Leaderboard</h1>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Leaderboard categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              role="tab"
              aria-selected={category === cat.value}
              aria-controls="leaderboard-panel"
              onClick={() => setCategory(cat.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                category === cat.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Leaderboard Content */}
        <div id="leaderboard-panel" role="tabpanel" aria-label={`${category} leaderboard`}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading leaderboard...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-destructive">{error}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">No entries yet for this category.</p>
            </div>
          ) : (
            <div className="bg-card rounded-lg border overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[3rem_1fr_5rem] md:grid-cols-[3rem_1fr_8rem_5rem] gap-2 px-4 py-3 bg-muted/50 font-medium text-sm text-muted-foreground">
                <span>Rank</span>
                <span>Scout</span>
                <span className="hidden md:block">Details</span>
                <span className="text-right">Points</span>
              </div>

              {/* Entries */}
              <ul className="divide-y" aria-label="Leaderboard entries">
                {entries.map((entry) => {
                  const isCurrentUser = user?.id === entry.user_id
                  return (
                    <li
                      key={entry.user_id}
                      className={`grid grid-cols-[3rem_1fr_5rem] md:grid-cols-[3rem_1fr_8rem_5rem] gap-2 px-4 py-3 items-center text-sm ${
                        isCurrentUser ? 'bg-primary/10 font-semibold' : ''
                      }`}
                      aria-current={isCurrentUser ? 'true' : undefined}
                    >
                      {/* Rank */}
                      <span className="text-muted-foreground font-mono">
                        {entry.rank != null ? `#${entry.rank}` : '—'}
                      </span>

                      {/* Name */}
                      <span className="truncate">
                        {entry.display_name}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-primary">(You)</span>
                        )}
                      </span>

                      {/* Details - troop/school (hidden on mobile, privacy-filtered) */}
                      <span className="hidden md:block text-muted-foreground truncate">
                        {entry.troop_unit_number || entry.school || '—'}
                      </span>

                      {/* Points */}
                      <span className="text-right font-mono font-semibold text-primary">
                        {entry.total_points.toLocaleString()}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
