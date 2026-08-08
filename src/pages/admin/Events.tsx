import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Types ───────────────────────────────────────────────────────────────────

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
  created_at: string
}

interface RecruitmentSummary {
  referrals_per_user: { user_id: string; user_name: string; referral_count: number }[]
  registrations_per_event: { event_id: string; event_name: string; registration_count: number }[]
  guest_to_scout_conversions: number
}

interface EventFormData {
  name: string
  description: string
  event_date: string
  location: string
  max_participants: string
}

// ─── Admin Events Management ─────────────────────────────────────────────────

/**
 * Admin Events management page for Council_Admin.
 * Provides CRUD for events with tracking metrics and
 * recruitment data summary view.
 *
 * Validates: Requirements 12.5, 12.6
 */
export default function AdminEvents() {
  const { user } = useAuthStore()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<EventFormData>({
    name: '',
    description: '',
    event_date: '',
    location: '',
    max_participants: '',
  })
  const [formErrors, setFormErrors] = useState<Partial<EventFormData>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Recruitment data state (Req 12.6)
  const [showRecruitment, setShowRecruitment] = useState(false)
  const [recruitmentData, setRecruitmentData] = useState<RecruitmentSummary | null>(null)
  const [recruitmentLoading, setRecruitmentLoading] = useState(false)
  const [dateRange, setDateRange] = useState({
    startDate: getDefaultStartDate(),
    endDate: new Date().toISOString().split('T')[0],
  })

  // ─── Load events ────────────────────────────────────────────────────────────

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false })

      if (fetchError) throw new Error(fetchError.message)
      setEvents(data ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load events.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  // ─── Form validation ────────────────────────────────────────────────────────

  function validateForm(): boolean {
    const errors: Partial<EventFormData> = {}

    if (!formData.name.trim()) {
      errors.name = 'Event name is required.'
    }

    if (!formData.event_date) {
      errors.event_date = 'Event date is required.'
    }

    if (formData.max_participants && isNaN(Number(formData.max_participants))) {
      errors.max_participants = 'Must be a valid number.'
    }

    if (
      formData.max_participants &&
      Number(formData.max_participants) < 1
    ) {
      errors.max_participants = 'Must be at least 1.'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ─── Create/Update event ────────────────────────────────────────────────────

  async function handleSaveEvent() {
    if (!user) return
    if (!validateForm()) return

    setIsSaving(true)
    setActionMessage(null)

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      event_date: new Date(formData.event_date).toISOString(),
      location: formData.location.trim() || null,
      max_participants: formData.max_participants
        ? Number(formData.max_participants)
        : null,
      created_by: user.id,
      is_active: true,
    }

    try {
      if (editingId) {
        // Update existing event
        const { error: updateError } = await supabase
          .from('events')
          .update({
            name: payload.name,
            description: payload.description,
            event_date: payload.event_date,
            location: payload.location,
            max_participants: payload.max_participants,
          })
          .eq('id', editingId)

        if (updateError) throw new Error(updateError.message)
        setActionMessage(`Event "${payload.name}" updated successfully.`)
      } else {
        // Create new event
        const { error: insertError } = await supabase
          .from('events')
          .insert(payload)

        if (insertError) throw new Error(insertError.message)
        setActionMessage(`Event "${payload.name}" created successfully.`)
      }

      resetForm()
      await loadEvents()
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : 'Failed to save event.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Deactivate event ───────────────────────────────────────────────────────

  async function handleToggleActive(event: EventItem) {
    setActionMessage(null)
    const newActiveState = !event.is_active

    const { error: updateError } = await supabase
      .from('events')
      .update({ is_active: newActiveState })
      .eq('id', event.id)

    if (updateError) {
      setActionMessage('Failed to update event status.')
      return
    }

    setActionMessage(
      `Event "${event.name}" ${newActiveState ? 'activated' : 'deactivated'}.`
    )
    await loadEvents()
  }

  // ─── Edit event ─────────────────────────────────────────────────────────────

  function handleEdit(event: EventItem) {
    setEditingId(event.id)
    setFormData({
      name: event.name,
      description: event.description ?? '',
      event_date: event.event_date
        ? new Date(event.event_date).toISOString().slice(0, 16)
        : '',
      location: event.location ?? '',
      max_participants: event.max_participants?.toString() ?? '',
    })
    setFormErrors({})
    setShowForm(true)
  }

  // ─── Reset form ─────────────────────────────────────────────────────────────

  function resetForm() {
    setShowForm(false)
    setEditingId(null)
    setFormData({
      name: '',
      description: '',
      event_date: '',
      location: '',
      max_participants: '',
    })
    setFormErrors({})
  }

  // ─── Load recruitment data (Req 12.6) ───────────────────────────────────────

  const loadRecruitmentData = useCallback(async () => {
    setRecruitmentLoading(true)

    try {
      const start = new Date(dateRange.startDate).toISOString()
      const end = new Date(dateRange.endDate + 'T23:59:59').toISOString()

      // Fetch referrals per user within date range
      const { data: referralsData } = await supabase
        .from('referrals')
        .select('referrer_id, profiles!referrals_referrer_id_fkey(full_name)')
        .gte('created_at', start)
        .lte('created_at', end)
        .not('referred_user_id', 'is', null)

      // Aggregate referrals per user
      const referralMap = new Map<string, { user_name: string; count: number }>()
      for (const row of referralsData ?? []) {
        const existing = referralMap.get(row.referrer_id)
        const userName = (row as any).profiles?.full_name ?? 'Unknown'
        if (existing) {
          existing.count++
        } else {
          referralMap.set(row.referrer_id, { user_name: userName, count: 1 })
        }
      }

      const referrals_per_user = Array.from(referralMap.entries())
        .map(([user_id, data]) => ({
          user_id,
          user_name: data.user_name,
          referral_count: data.count,
        }))
        .sort((a, b) => b.referral_count - a.referral_count)

      // Fetch registrations per event within date range
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, name, new_registrations')
        .gte('event_date', start)
        .lte('event_date', end)
        .order('new_registrations', { ascending: false })

      const registrations_per_event = (eventsData ?? []).map((e) => ({
        event_id: e.id,
        event_name: e.name,
        registration_count: e.new_registrations,
      }))

      // Guest-to-Scout conversions: profiles created in date range whose role
      // changed from Guest to a scout role (approximated by looking at non-Guest
      // profiles that were created in the range)
      const { count: conversionCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', start)
        .lte('created_at', end)
        .in('role', ['Cub_Scout', 'Boy_Scout', 'Senior_Scout', 'Rover_Scout'])

      setRecruitmentData({
        referrals_per_user,
        registrations_per_event,
        guest_to_scout_conversions: conversionCount ?? 0,
      })
    } catch {
      setRecruitmentData(null)
    } finally {
      setRecruitmentLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    if (showRecruitment) {
      loadRecruitmentData()
    }
  }, [showRecruitment, loadRecruitmentData])

  // ─── Access check ───────────────────────────────────────────────────────────

  if (!user || user.role !== 'Council_Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">
            Access denied. Only Council Admins can manage events.
          </p>
          <Link to="/app/passport" className="text-primary hover:underline text-sm">
            Back to Passport
          </Link>
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

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Events Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage community ScoutChase events
            </p>
          </div>
          <Link
            to="/app/passport"
            className="text-sm text-primary hover:underline"
          >
            ← Back
          </Link>
        </header>

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap">
          <Button
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
          >
            + Create Event
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowRecruitment(!showRecruitment)}
          >
            {showRecruitment ? 'Hide Recruitment Data' : 'View Recruitment Data'}
          </Button>
        </div>

        {/* Messages */}
        {actionMessage && (
          <div className="rounded-lg p-3 bg-green-50 border border-green-200 text-green-800 text-sm" role="alert">
            {actionMessage}
          </div>
        )}
        {error && (
          <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
            {error}
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm && (
          <div className="bg-card rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {editingId ? 'Edit Event' : 'Create New Event'}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="event-name">Event Name *</Label>
                <Input
                  id="event-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Heritage Day 2024"
                />
                {formErrors.name && (
                  <p className="text-sm text-destructive">{formErrors.name}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="event-description">Description</Label>
                <textarea
                  id="event-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                  className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                  placeholder="Brief description of the event"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-date">Event Date *</Label>
                <Input
                  id="event-date"
                  type="datetime-local"
                  value={formData.event_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, event_date: e.target.value }))
                  }
                />
                {formErrors.event_date && (
                  <p className="text-sm text-destructive">{formErrors.event_date}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-location">Location</Label>
                <Input
                  id="event-location"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, location: e.target.value }))
                  }
                  placeholder="e.g., Taguig City Hall"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-max-participants">Max Participants</Label>
                <Input
                  id="event-max-participants"
                  type="number"
                  min="1"
                  value={formData.max_participants}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      max_participants: e.target.value,
                    }))
                  }
                  placeholder="Leave empty for unlimited"
                />
                {formErrors.max_participants && (
                  <p className="text-sm text-destructive">
                    {formErrors.max_participants}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSaveEvent} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingId ? 'Update Event' : 'Create Event'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Recruitment Data Summary (Req 12.6) */}
        {showRecruitment && (
          <div className="bg-card rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Recruitment Data Summary
            </h2>
            <p className="text-sm text-muted-foreground">
              View referrals per user, registrations per event, and guest-to-Scout conversions
              for a selected date range (up to 365 days).
            </p>

            {/* Date range filter */}
            <div className="flex gap-4 flex-wrap items-end">
              <div className="space-y-1">
                <Label htmlFor="recruitment-start">Start Date</Label>
                <Input
                  id="recruitment-start"
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="recruitment-end">End Date</Label>
                <Input
                  id="recruitment-end"
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                />
              </div>
              <Button
                variant="outline"
                onClick={loadRecruitmentData}
                disabled={recruitmentLoading}
              >
                {recruitmentLoading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>

            {recruitmentLoading ? (
              <p className="text-muted-foreground text-sm">
                Loading recruitment data...
              </p>
            ) : recruitmentData ? (
              <div className="space-y-6">
                {/* Conversion stat */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Guest-to-Scout Conversions</p>
                  <p className="text-3xl font-bold text-primary">
                    {recruitmentData.guest_to_scout_conversions}
                  </p>
                </div>

                {/* Referrals per user */}
                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">
                    Total Referrals per User
                  </h3>
                  {recruitmentData.referrals_per_user.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No referrals in the selected date range.
                    </p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium text-foreground">
                              User
                            </th>
                            <th className="text-right px-4 py-2 font-medium text-foreground">
                              Referrals
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {recruitmentData.referrals_per_user.map((item) => (
                            <tr
                              key={item.user_id}
                              className="border-t border-border"
                            >
                              <td className="px-4 py-2 text-foreground">
                                {item.user_name}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-primary">
                                {item.referral_count}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Registrations per event */}
                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">
                    New Registrations per Event
                  </h3>
                  {recruitmentData.registrations_per_event.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No events with registrations in the selected date range.
                    </p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium text-foreground">
                              Event
                            </th>
                            <th className="text-right px-4 py-2 font-medium text-foreground">
                              Registrations
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {recruitmentData.registrations_per_event.map((item) => (
                            <tr
                              key={item.event_id}
                              className="border-t border-border"
                            >
                              <td className="px-4 py-2 text-foreground">
                                {item.event_name}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-primary">
                                {item.registration_count}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Unable to load recruitment data.
              </p>
            )}
          </div>
        )}

        {/* Events list with metrics */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            All Events ({events.length})
          </h2>

          {events.length === 0 ? (
            <div className="bg-card rounded-lg border p-8 text-center">
              <p className="text-muted-foreground">
                No events created yet. Create your first event above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`bg-card rounded-lg border p-4 space-y-3 ${
                    !event.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-medium text-foreground">
                        {event.name}
                      </h3>
                      {event.description && (
                        <p className="text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>
                          📅{' '}
                          {new Date(event.event_date).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        {event.location && <span>📍 {event.location}</span>}
                      </div>
                    </div>
                    <span
                      className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                        event.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {event.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Tracking metrics (Req 12.5) */}
                  <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-border">
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
                      <p className="text-xs text-muted-foreground">Challenge Completions</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-primary">
                        {event.new_registrations}
                      </p>
                      <p className="text-xs text-muted-foreground">New Registrations</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(event)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(event)}
                    >
                      {event.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDefaultStartDate(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 3) // Default to last 3 months
  return d.toISOString().split('T')[0]
}
