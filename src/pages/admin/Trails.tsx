/**
 * Admin Trails management page.
 *
 * Allows Council_Admin to create, edit, delete trails and assign
 * heritage sites (2-50 sites per trail) with list-based ordering.
 *
 * Validates: Requirements 14.2, 14.8, 14.9
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_SITES_PER_TRAIL = 2
const MAX_SITES_PER_TRAIL = 50

// ─── Types ───────────────────────────────────────────────────────────────────

interface Trail {
  id: string
  name: string
  theme: string
  description: string | null
  site_count: number
  bonus_points: number
  is_active: boolean
  created_at: string
}

interface HeritageSite {
  id: string
  name: string
  trail_id: string | null
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminTrails() {
  const { user } = useAuthStore()
  const [trails, setTrails] = useState<Trail[]>([])
  const [allSites, setAllSites] = useState<HeritageSite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingTrail, setEditingTrail] = useState<Trail | null>(null)
  const [formName, setFormName] = useState('')
  const [formTheme, setFormTheme] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formBonusPoints, setFormBonusPoints] = useState('50')
  const [assignedSiteIds, setAssignedSiteIds] = useState<string[]>([])
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dependencies, setDependencies] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

  // ─── Fetch data ────────────────────────────────────────────────────────────

  const fetchTrails = useCallback(async () => {
    const { data } = await supabase
      .from('trails')
      .select('*')
      .order('name')

    setTrails((data || []) as Trail[])
  }, [])

  const fetchSites = useCallback(async () => {
    const { data } = await supabase
      .from('heritage_sites')
      .select('id, name, trail_id')
      .order('name')

    setAllSites((data || []) as HeritageSite[])
  }, [])

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      await Promise.all([fetchTrails(), fetchSites()])
      setIsLoading(false)
    }
    load()
  }, [fetchTrails, fetchSites])

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [actionMessage])

  // ─── Form handlers ─────────────────────────────────────────────────────────

  function openAddForm() {
    setEditingTrail(null)
    setFormName('')
    setFormTheme('')
    setFormDescription('')
    setFormBonusPoints('50')
    setAssignedSiteIds([])
    setFormErrors({})
    setShowForm(true)
  }

  function openEditForm(trail: Trail) {
    setEditingTrail(trail)
    setFormName(trail.name)
    setFormTheme(trail.theme)
    setFormDescription(trail.description || '')
    setFormBonusPoints(String(trail.bonus_points))
    // Find sites assigned to this trail
    const sitesForTrail = allSites.filter(s => s.trail_id === trail.id).map(s => s.id)
    setAssignedSiteIds(sitesForTrail)
    setFormErrors({})
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingTrail(null)
  }

  function toggleSiteAssignment(siteId: string) {
    setAssignedSiteIds(prev =>
      prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]
    )
  }

  function moveSiteUp(index: number) {
    if (index === 0) return
    const newIds = [...assignedSiteIds]
    ;[newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]]
    setAssignedSiteIds(newIds)
  }

  function moveSiteDown(index: number) {
    if (index === assignedSiteIds.length - 1) return
    const newIds = [...assignedSiteIds]
    ;[newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]]
    setAssignedSiteIds(newIds)
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!formName.trim()) errors.name = 'Trail name is required.'
    if (!formTheme.trim()) errors.theme = 'Theme is required.'
    if (formDescription.length > 500) errors.description = 'Description must be 500 characters or fewer.'
    if (assignedSiteIds.length < MIN_SITES_PER_TRAIL) errors.sites = `At least ${MIN_SITES_PER_TRAIL} sites must be assigned.`
    if (assignedSiteIds.length > MAX_SITES_PER_TRAIL) errors.sites = `Maximum ${MAX_SITES_PER_TRAIL} sites per trail.`
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
      theme: formTheme.trim(),
      description: formDescription.trim() || null,
      bonus_points: parseInt(formBonusPoints) || 50,
      site_count: assignedSiteIds.length,
      updated_at: new Date().toISOString(),
    }

    try {
      let trailId: string

      if (editingTrail) {
        trailId = editingTrail.id
        const { error } = await supabase
          .from('trails')
          .update(payload)
          .eq('id', editingTrail.id)

        if (error) {
          setActionMessage({ type: 'error', text: 'Failed to update trail.' })
          setIsSubmitting(false)
          return
        }
      } else {
        const { data, error } = await supabase
          .from('trails')
          .insert({ ...payload, is_active: true })
          .select('id')
          .single()

        if (error || !data) {
          setActionMessage({ type: 'error', text: 'Failed to create trail.' })
          setIsSubmitting(false)
          return
        }
        trailId = data.id
      }

      // Unassign all sites from this trail first
      await supabase
        .from('heritage_sites')
        .update({ trail_id: null })
        .eq('trail_id', trailId)

      // Assign selected sites to this trail
      if (assignedSiteIds.length > 0) {
        await supabase
          .from('heritage_sites')
          .update({ trail_id: trailId })
          .in('id', assignedSiteIds)
      }

      setActionMessage({
        type: 'success',
        text: editingTrail
          ? `Trail "${formName.trim()}" updated successfully.`
          : `Trail "${formName.trim()}" created successfully.`,
      })

      closeForm()
      await Promise.all([fetchTrails(), fetchSites()])
    } catch {
      setActionMessage({ type: 'error', text: 'An unexpected error occurred.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Delete with dependency check (Req 14.8) ──────────────────────────────

  async function handleDeleteClick(trailId: string) {
    const deps: string[] = []

    const { count: siteCount } = await supabase
      .from('heritage_sites')
      .select('id', { count: 'exact', head: true })
      .eq('trail_id', trailId)

    if (siteCount && siteCount > 0) deps.push(`${siteCount} heritage site(s)`)

    const { count: missionCount } = await supabase
      .from('service_missions')
      .select('id', { count: 'exact', head: true })
      .eq('trail_id', trailId)

    if (missionCount && missionCount > 0) deps.push(`${missionCount} service mission(s)`)

    setDependencies(deps)
    setDeletingId(trailId)
  }

  async function handleDelete() {
    if (!deletingId) return
    setIsDeleting(true)

    const trail = trails.find(t => t.id === deletingId)
    const { error } = await supabase
      .from('trails')
      .delete()
      .eq('id', deletingId)

    if (error) {
      setActionMessage({ type: 'error', text: 'Failed to delete trail.' })
    } else {
      setActionMessage({ type: 'success', text: `Trail "${trail?.name}" deleted successfully.` })
      await Promise.all([fetchTrails(), fetchSites()])
    }

    setDeletingId(null)
    setDependencies([])
    setIsDeleting(false)
  }

  // ─── Access check ──────────────────────────────────────────────────────────

  if (!user || user.role !== 'Council_Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">Access denied. Only Council Admins can manage trails.</p>
          <Link to="/app/passport" className="text-primary hover:underline text-sm">Back to Passport</Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading trails...</p>
      </div>
    )
  }

  // Available sites (not assigned to another trail, or assigned to current editing trail)
  const availableSites = allSites.filter(s =>
    !s.trail_id || s.trail_id === editingTrail?.id || assignedSiteIds.includes(s.id)
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manage Trails</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage exploration trails with site assignments.</p>
          </div>
          <Button onClick={openAddForm}>Add Trail</Button>
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

        {trails.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No trails yet. Create your first trail.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trails.map((trail) => (
              <div key={trail.id} className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">{trail.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Theme: {trail.theme} • {trail.site_count} site(s) • {trail.bonus_points} bonus pts
                    {' • '}{trail.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEditForm(trail)}>Edit</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteClick(trail.id)}
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
            <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-foreground">
                {editingTrail ? 'Edit Trail' : 'Create Trail'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trail-name">Trail Name <span className="text-destructive">*</span></Label>
                    <Input id="trail-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Taguig Heritage Walk" />
                    {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trail-theme">Theme <span className="text-destructive">*</span></Label>
                    <Input id="trail-theme" value={formTheme} onChange={(e) => setFormTheme(e.target.value)} placeholder="e.g. Colonial History" />
                    {formErrors.theme && <p className="text-sm text-destructive">{formErrors.theme}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trail-description">Description</Label>
                  <textarea
                    id="trail-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                    className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                    placeholder="Trail description (max 500 chars)"
                  />
                  <p className="text-xs text-right text-muted-foreground">{formDescription.length}/500</p>
                  {formErrors.description && <p className="text-sm text-destructive">{formErrors.description}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trail-bonus">Bonus Points</Label>
                  <Input id="trail-bonus" type="number" min="0" value={formBonusPoints} onChange={(e) => setFormBonusPoints(e.target.value)} />
                </div>

                {/* Site assignment with ordering */}
                <div className="space-y-2">
                  <Label>Assign Sites ({assignedSiteIds.length} selected, {MIN_SITES_PER_TRAIL}-{MAX_SITES_PER_TRAIL} required)</Label>
                  {formErrors.sites && <p className="text-sm text-destructive">{formErrors.sites}</p>}

                  {/* Assigned sites with ordering */}
                  {assignedSiteIds.length > 0 && (
                    <div className="border border-border rounded-md p-2 space-y-1 mb-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Order (drag not supported, use arrows):</p>
                      {assignedSiteIds.map((siteId, index) => {
                        const site = allSites.find(s => s.id === siteId)
                        return (
                          <div key={siteId} className="flex items-center gap-2 py-1 px-2 bg-muted/50 rounded text-sm">
                            <span className="text-muted-foreground w-6">{index + 1}.</span>
                            <span className="flex-1 truncate">{site?.name || 'Unknown'}</span>
                            <button type="button" className="text-xs px-1 hover:bg-muted" onClick={() => moveSiteUp(index)} disabled={index === 0}>↑</button>
                            <button type="button" className="text-xs px-1 hover:bg-muted" onClick={() => moveSiteDown(index)} disabled={index === assignedSiteIds.length - 1}>↓</button>
                            <button type="button" className="text-xs text-destructive px-1 hover:bg-destructive/10" onClick={() => toggleSiteAssignment(siteId)}>✕</button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Available sites to add */}
                  <div className="border border-border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                    {availableSites
                      .filter(s => !assignedSiteIds.includes(s.id))
                      .map(site => (
                        <div key={site.id} className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded text-sm cursor-pointer" onClick={() => toggleSiteAssignment(site.id)}>
                          <span className="text-primary">+</span>
                          <span className="truncate">{site.name}</span>
                        </div>
                      ))}
                    {availableSites.filter(s => !assignedSiteIds.includes(s.id)).length === 0 && (
                      <p className="text-xs text-muted-foreground py-2 text-center">No more sites available.</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : editingTrail ? 'Update Trail' : 'Create Trail'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation with dependency warning */}
        {deletingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-background rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Delete Trail</h2>
              {dependencies.length > 0 && (
                <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  <p className="font-medium mb-1">⚠️ Dependency Warning</p>
                  <p>This trail has dependencies that will be affected:</p>
                  <ul className="list-disc list-inside mt-1">
                    {dependencies.map((dep, i) => <li key={i}>{dep}</li>)}
                  </ul>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete &ldquo;{trails.find(t => t.id === deletingId)?.name}&rdquo;?
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setDeletingId(null); setDependencies([]) }} disabled={isDeleting}>Cancel</Button>
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
