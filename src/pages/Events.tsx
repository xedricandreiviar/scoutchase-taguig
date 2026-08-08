import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

interface EventItem {
  id: string
  name: string
  description: string | null
  event_date: string
  location: string | null
  max_participants: number | null
  participant_count: number
  challenge_completions: number
  new_registrations: number
  is_active: boolean
}

/**
 * Events listing page for authenticated users.
 * Displays active community ScoutChase events with date, location,
 * and participant tracking info.
 *
 * Validates: Requirements 12.5
 */
export default function Events() {
  const { user } = useAuthStore()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select(
          'id, name, description, event_date, location, max_participants, participant_count, challenge_completions, new_registrations, is_active'
        )
        .eq('is_active', true)
        .order('event_date', { ascending: true })

      if (fetchError) {
        throw new Error(fetchError.message)
      }

      setEvents(data ?? [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load events. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function isUpcoming(dateStr: string): boolean {
    return new Date(dateStr) > new Date()
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center space-y-4">
          <div className="text-destructive text-4xl" aria-hidden="true">⚠️</div>
          <h2 className="text-lg font-semibold text-foreground">
            Unable to Load Events
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          <button
            onClick={loadEvents}
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
        <p className="text-muted-foreground">Loading events...</p>
      </div>
    )
  }

  const upcomingEvents = events.filter((e) => isUpcoming(e.event_date))
  const pastEvents = events.filter((e) => !isUpcoming(e.event_date))

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-primary">Events</h1>
          <Link
            to="/app/passport"
            className="text-sm text-primary hover:underline"
          >
            ← Back
          </Link>
        </div>
        <p className="text-muted-foreground">
          Community ScoutChase events and school heritage-challenge activities.
        </p>

        {events.length === 0 ? (
          <div className="bg-card rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">
              No active events are currently available.
            </p>
          </div>
        ) : (
          <>
            {/* Upcoming Events */}
            {upcomingEvents.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold text-foreground border-b pb-2">
                  Upcoming Events
                </h2>
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <EventCard key={event.id} event={event} isUpcoming />
                  ))}
                </div>
              </section>
            )}

            {/* Past Events */}
            {pastEvents.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold text-foreground border-b pb-2">
                  Past Events
                </h2>
                <div className="space-y-3">
                  {pastEvents.map((event) => (
                    <EventCard key={event.id} event={event} isUpcoming={false} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface EventCardProps {
  event: EventItem
  isUpcoming: boolean
}

function EventCard({ event, isUpcoming }: EventCardProps) {
  return (
    <div className="bg-card rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-medium text-foreground">{event.name}</h3>
          {event.description && (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          )}
        </div>
        <span
          className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
            isUpcoming
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {isUpcoming ? 'Upcoming' : 'Completed'}
        </span>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <span aria-hidden="true">📅</span>
          <span>
            {new Date(event.event_date).toLocaleDateString(undefined, {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-1">
            <span aria-hidden="true">📍</span>
            <span>{event.location}</span>
          </div>
        )}
      </div>

      {/* Participant tracking metrics (Req 12.5) */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
        <div className="text-center">
          <p className="text-lg font-semibold text-primary">
            {event.participant_count}
            {event.max_participants && (
              <span className="text-xs text-muted-foreground font-normal">
                /{event.max_participants}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">Participants</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-primary">
            {event.challenge_completions}
          </p>
          <p className="text-xs text-muted-foreground">Challenges Done</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-primary">
            {event.new_registrations}
          </p>
          <p className="text-xs text-muted-foreground">New Sign-ups</p>
        </div>
      </div>
    </div>
  )
}
