/**
 * Admin Service Missions management page.
 *
 * Allows Council_Admin to create, edit, and delete service missions
 * linked to trails.
 *
 * Validates: Requirements 14.4, 14.9
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Constants ───────────────────────────────────────────────────────────────

const MISSION_TYPES = [
  'clean_up',
  'tree_planting',
  'waste_segregation',
  'community_outreach',
  'heritage_preservation',
  'environmental_monitoring',
]

// ─── Types ───────────────────────────────────────────────────────────────────

interface ServiceMission {
  id: string
  trail_id: string
  name: string
  description: string | null
  mission_type: string
  is_active: boolean
  created_at: string
  trail_name?: string
}

interface Trail {
  id: string
  name: string
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminMissions() {
  const { user } = useAuthStore()
  const [missions, setMissions] = useState<ServiceMission[]>([])
  const [trails, setTrails] = useState<Trail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingMission, setEditingMission] = useState<ServiceMission | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState(MISSION_TYPES[0])
  const [formTrailId, setFormTrailId] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ─── Fetch data ────────────────────────────────────────────────────────────

  const fetchMissions = useCallback(async () => {
    const { data } = await supabase
      .from('service_missions')
      .select('*, trails!service_missions_trail_id_fkey(name)')
      .order('created_at', { ascending: false })

    const mapped = (data || []).map((m: any) => ({
      ...m,
      trail_name: m.trails?.name || 'Unknown Trail',
    }))
    setMissions(mapped)
  }, [])

  const fetchTrails = useCallback(async () => {
    const { data } = await supabase
      .from('trails')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    setTrails((data || []) as Trail[])
  }, [])

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      await Promise.all([fetchMissions(), fetchTrails()])
      setIsLoading(false)
    }
    load()
  }, [fetchMissions, fetchTrails])

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [actionMessage])

  // ─── Form handlers ─────────────────────────────────────────────────────────

  function openAddForm() {
    setEditingMission(null)
    setFormName('')
    setFormDescription('')
    setFormType(MISSION_TYPES[0])
    setFormTrailId('')
    setFormErrors({})
    setShowForm(true)
  }

  function openEditForm(mission: ServiceMission) {
    setEditingMission(mission)
    setFormName(mission.name)
    setFormDescription(mission.description || '')
    setFormType(mission.mission_type)
    setFormTrailId(mission.trail_id)
    setFormErrors({})
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingMission(null)
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!formName.trim()) errors.name = 'Mission name is required.'
    if (!formTrailId) errors.trailId = 'Trail assignment is required.'
    if (!MISSION_TYPES.includes(formType)) errors.type = 'Invalid mission type.'
    return errors
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setActionMessage(null)

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setIsSubmitting(true)

    const payload = {
      name: formName.trim(),
      description: formDescription.trim() || null,
      mission_type: formType,
      trail_id: formTrailId,
    }

    try {
      if (editingMission) {
        const { error } = await supabase
          .from('service_missions')
          .update(payload)
          .eq('id', editingMission.id)

        if (error) {
          setActionMessage({ type: 'error', text: 'Failed to update mission.' })
          setIsSubmitting(false)
          return
        }
        setActionMessage({ type: 'success', text: `Mission "${formName.trim()}" updated successfully.` })
      } else {
        const { error } = await supabase
          .from('service_missions')
          .insert({ ...payload, is_active: true })

        if (error) {
          setActionMessage({ type: 'error', text: 'Failed to create mission.' })
          setIsSubmitting(false)
          return
        }
        setActionMessage({ type: 'success', text: `Mission "${formName.trim()}" created successfully.` })
      }

      closeForm()
      await fetchMissions()
    } catch {
      setActionMessage({ type: 'error', text: 'An unexpected error occurred.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Delete handler ────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deletingId) return
    setIsDeleting(true)

    const mission = missions.find(m => m.id === deletingId)
    const { error } = await supabase
      .from('service_missions')
      .delete()
      .eq('id', deletingId)

    if (error) {
      setActionMessage({ type: 'error', text: 'Failed to delete mission.' })
    } else {
      setActionMessage({ type: 'success', text: `Mission "${mission?.name}" deleted successfully.` })
      await fetchMissions()
    }

    setDeletingId(null)
    setIsDeleting(false)
  }

  // ─── Access check ──────────────────────────────────────────────────────────

  if (!user || user.role !== 'Council_Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">Access denied. Only Council Admins can manage missions.</p>
          <Link to="/app/passport" className="text-primary hover:underline text-sm">Back to Passport</Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading service missions...</p>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Service Missions</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage community service missions linked to trails.</p>
          </div>
          <Button onClick={openAddForm}>Add Mission</Button>
        </header>

        {actionMessage && (
          <div
            className={`rounded-lg p-3 text-sm ${
              actionMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
            role="alert"
          >
            {actionMessage.text}
          </div>
        )}

        {missions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No service missions yet. Create your first mission.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((mission) => (
              <div key={mission.id} className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">{mission.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {mission.trail_name} • {mission.mission_type.replace(/_/g, ' ')}
                    {' • '}{mission.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEditForm(mission)}>Edit</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingId(mission.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-background rounded-lg shadow-lg max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-foreground">
                {editingMission ? 'Edit Mission' : 'Create Mission'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mission-name">Mission Name <span className="text-destructive">*</span></Label>
                  <Input id="mission-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Taguig River Clean-up" />
                  {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mission-trail">Linked Trail <span className="text-destructive">*</span></Label>
                  <select
                    id="mission-trail"
                    value={formTrailId}
                    onChange={(e) => setFormTrailId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select a trail...</option>
                    {trails.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {formErrors.trailId && <p className="text-sm text-destructive">{formErrors.trailId}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mission-type">Mission Type <span className="text-destructive">*</span></Label>
                  <select
                    id="mission-type"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {MISSION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                  {formErrors.type && <p className="text-sm text-destructive">{formErrors.type}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mission-description">Description</Label>
                  <textarea
                    id="mission-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                    placeholder="Describe the service mission..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : editingMission ? 'Update Mission' : 'Create Mission'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deletingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-background rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Delete Mission</h2>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete &ldquo;{missions.find(m => m.id === deletingId)?.name}&rdquo;?
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeletingId(null)} disabled={isDeleting}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
