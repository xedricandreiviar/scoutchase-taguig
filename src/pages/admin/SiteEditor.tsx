/**
 * Admin Heritage Site content editor.
 *
 * Allows Council_Admin to create/edit heritage sites with:
 * - Rich-text write-ups (max 10,000 characters)
 * - Photo, audio, video URL fields
 * - Timeline entries (max 50 per site)
 * - Preview function before publishing
 *
 * Validates: Requirements 14.1, 14.8, 14.9, 14.10
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_CONTENT_LENGTH = 10000
const MAX_TIMELINE_ENTRIES = 50
const MAX_DESCRIPTION_LENGTH = 2000

// ─── Types ───────────────────────────────────────────────────────────────────

interface TimelineEntry {
  year: string
  event: string
}

interface HeritageSite {
  id: string
  name: string
  description: string | null
  content_json: { text: string } | null
  latitude: number
  longitude: number
  trail_id: string | null
  photo_gallery: string[]
  audio_url: string | null
  video_url: string | null
  timeline: TimelineEntry[]
  is_active: boolean
  created_at: string
}

interface Trail {
  id: string
  name: string
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SiteEditor() {
  const { user } = useAuthStore()
  const [sites, setSites] = useState<HeritageSite[]>([])
  const [trails, setTrails] = useState<Trail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingSite, setEditingSite] = useState<HeritageSite | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formLatitude, setFormLatitude] = useState('')
  const [formLongitude, setFormLongitude] = useState('')
  const [formTrailId, setFormTrailId] = useState('')
  const [formPhotoUrls, setFormPhotoUrls] = useState('')
  const [formAudioUrl, setFormAudioUrl] = useState('')
  const [formVideoUrl, setFormVideoUrl] = useState('')
  const [formTimeline, setFormTimeline] = useState<TimelineEntry[]>([])
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Preview state
  const [showPreview, setShowPreview] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dependencies, setDependencies] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

  // ─── Fetch data ────────────────────────────────────────────────────────────

  const fetchSites = useCallback(async () => {
    const { data, error } = await supabase
      .from('heritage_sites')
      .select('*')
      .order('name')

    if (error) return
    setSites((data || []) as HeritageSite[])
  }, [])

  const fetchTrails = useCallback(async () => {
    const { data } = await supabase
      .from('trails')
      .select('id, name')
      .order('name')

    setTrails((data || []) as Trail[])
  }, [])

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      await Promise.all([fetchSites(), fetchTrails()])
      setIsLoading(false)
    }
    load()
  }, [fetchSites, fetchTrails])

  // Auto-dismiss action messages after 3 seconds
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [actionMessage])

  // ─── Form handlers ─────────────────────────────────────────────────────────

  function openAddForm() {
    setEditingSite(null)
    setFormName('')
    setFormDescription('')
    setFormContent('')
    setFormLatitude('')
    setFormLongitude('')
    setFormTrailId('')
    setFormPhotoUrls('')
    setFormAudioUrl('')
    setFormVideoUrl('')
    setFormTimeline([])
    setFormErrors({})
    setShowForm(true)
  }

  function openEditForm(site: HeritageSite) {
    setEditingSite(site)
    setFormName(site.name)
    setFormDescription(site.description || '')
    setFormContent(site.content_json?.text || '')
    setFormLatitude(String(site.latitude))
    setFormLongitude(String(site.longitude))
    setFormTrailId(site.trail_id || '')
    setFormPhotoUrls((site.photo_gallery || []).join('\n'))
    setFormAudioUrl(site.audio_url || '')
    setFormVideoUrl(site.video_url || '')
    setFormTimeline(site.timeline || [])
    setFormErrors({})
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingSite(null)
    setShowPreview(false)
  }

  function addTimelineEntry() {
    if (formTimeline.length >= MAX_TIMELINE_ENTRIES) return
    setFormTimeline([...formTimeline, { year: '', event: '' }])
  }

  function updateTimelineEntry(index: number, field: 'year' | 'event', value: string) {
    const updated = [...formTimeline]
    updated[index] = { ...updated[index], [field]: value }
    setFormTimeline(updated)
  }

  function removeTimelineEntry(index: number) {
    setFormTimeline(formTimeline.filter((_, i) => i !== index))
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!formName.trim()) errors.name = 'Site name is required.'
    if (formDescription.length > MAX_DESCRIPTION_LENGTH) errors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`
    if (formContent.length > MAX_CONTENT_LENGTH) errors.content = `Content must be ${MAX_CONTENT_LENGTH} characters or fewer.`
    if (!formLatitude || isNaN(Number(formLatitude))) errors.latitude = 'Valid latitude is required.'
    if (!formLongitude || isNaN(Number(formLongitude))) errors.longitude = 'Valid longitude is required.'
    if (formTimeline.length > MAX_TIMELINE_ENTRIES) errors.timeline = `Maximum ${MAX_TIMELINE_ENTRIES} timeline entries allowed.`
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

    const photoGallery = formPhotoUrls.split('\n').map(u => u.trim()).filter(Boolean)
    const payload = {
      name: formName.trim(),
      description: formDescription.trim() || null,
      content_json: formContent.trim() ? { text: formContent.trim() } : null,
      latitude: parseFloat(formLatitude),
      longitude: parseFloat(formLongitude),
      trail_id: formTrailId || null,
      photo_gallery: photoGallery,
      audio_url: formAudioUrl.trim() || null,
      video_url: formVideoUrl.trim() || null,
      timeline: formTimeline.filter(e => e.year.trim() || e.event.trim()),
      updated_at: new Date().toISOString(),
    }

    try {
      if (editingSite) {
        const { error } = await supabase
          .from('heritage_sites')
          .update(payload)
          .eq('id', editingSite.id)

        if (error) {
          setActionMessage({ type: 'error', text: 'Failed to update site.' })
          setIsSubmitting(false)
          return
        }
        setActionMessage({ type: 'success', text: `Site "${formName.trim()}" updated successfully.` })
      } else {
        const { error } = await supabase
          .from('heritage_sites')
          .insert({ ...payload, is_active: true })

        if (error) {
          setActionMessage({ type: 'error', text: 'Failed to create site.' })
          setIsSubmitting(false)
          return
        }
        setActionMessage({ type: 'success', text: `Site "${formName.trim()}" created successfully.` })
      }

      closeForm()
      await fetchSites()
    } catch {
      setActionMessage({ type: 'error', text: 'An unexpected error occurred.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Delete with dependency check (Req 14.8) ──────────────────────────────

  async function checkDependencies(siteId: string) {
    const deps: string[] = []

    const { count: challengeCount } = await supabase
      .from('challenges')
      .select('id', { count: 'exact', head: true })
      .eq('heritage_site_id', siteId)

    if (challengeCount && challengeCount > 0) {
      deps.push(`${challengeCount} challenge(s)`)
    }

    const { count: scanCount } = await supabase
      .from('qr_scans')
      .select('id', { count: 'exact', head: true })
      .eq('heritage_site_id', siteId)

    if (scanCount && scanCount > 0) {
      deps.push(`${scanCount} QR scan(s)`)
    }

    return deps
  }

  async function handleDeleteClick(siteId: string) {
    const deps = await checkDependencies(siteId)
    setDependencies(deps)
    setDeletingId(siteId)
  }

  async function handleDelete() {
    if (!deletingId) return
    setIsDeleting(true)

    const site = sites.find(s => s.id === deletingId)
    const { error } = await supabase
      .from('heritage_sites')
      .delete()
      .eq('id', deletingId)

    if (error) {
      setActionMessage({ type: 'error', text: 'Failed to delete site.' })
    } else {
      setActionMessage({ type: 'success', text: `Site "${site?.name}" deleted successfully.` })
      await fetchSites()
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
          <p className="text-destructive">Access denied. Only Council Admins can manage sites.</p>
          <Link to="/app/passport" className="text-primary hover:underline text-sm">Back to Passport</Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading heritage sites...</p>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Heritage Sites</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage heritage site content, media, and timelines.</p>
          </div>
          <Button onClick={openAddForm}>Add Site</Button>
        </header>

        {/* Action message (Req 14.9) */}
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

        {/* Sites list */}
        {sites.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No heritage sites yet. Add your first site.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sites.map((site) => (
              <div key={site.id} className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">{site.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                    {site.trail_id && ` • Trail assigned`}
                    {' • '}{site.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEditForm(site)}>Edit</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteClick(site.id)}
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
                {editingSite ? 'Edit Heritage Site' : 'Add Heritage Site'}
              </h2>

              {/* Preview toggle */}
              {showPreview ? (
                <div className="space-y-4">
                  <div className="border border-border rounded-lg p-4 space-y-2">
                    <h3 className="text-xl font-bold">{formName || 'Untitled'}</h3>
                    {formDescription && <p className="text-muted-foreground">{formDescription}</p>}
                    {formContent && <div className="prose max-w-none text-sm mt-4 whitespace-pre-wrap">{formContent}</div>}
                    {formTimeline.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Timeline</h4>
                        <ul className="space-y-1 text-sm">
                          {formTimeline.filter(e => e.year || e.event).map((entry, i) => (
                            <li key={i}><strong>{entry.year}:</strong> {entry.event}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setShowPreview(false)}>Back to Edit</Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="site-name">Site Name <span className="text-destructive">*</span></Label>
                    <Input id="site-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Fort Santiago" />
                    {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="site-description">Short Description</Label>
                    <textarea
                      id="site-description"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={2}
                      className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                      placeholder="Brief description (max 2000 chars)"
                    />
                    <p className="text-xs text-right text-muted-foreground">{formDescription.length}/{MAX_DESCRIPTION_LENGTH}</p>
                    {formErrors.description && <p className="text-sm text-destructive">{formErrors.description}</p>}
                  </div>

                  {/* Rich text content */}
                  <div className="space-y-2">
                    <Label htmlFor="site-content">Rich-Text Content</Label>
                    <textarea
                      id="site-content"
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      rows={6}
                      className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y font-mono"
                      placeholder="Detailed heritage content (max 10,000 chars)"
                    />
                    <p className={`text-xs text-right ${formContent.length > MAX_CONTENT_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {formContent.length}/{MAX_CONTENT_LENGTH}
                    </p>
                    {formErrors.content && <p className="text-sm text-destructive">{formErrors.content}</p>}
                  </div>

                  {/* Coordinates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="site-lat">Latitude <span className="text-destructive">*</span></Label>
                      <Input id="site-lat" type="number" step="any" value={formLatitude} onChange={(e) => setFormLatitude(e.target.value)} placeholder="14.5176" />
                      {formErrors.latitude && <p className="text-sm text-destructive">{formErrors.latitude}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="site-lng">Longitude <span className="text-destructive">*</span></Label>
                      <Input id="site-lng" type="number" step="any" value={formLongitude} onChange={(e) => setFormLongitude(e.target.value)} placeholder="121.0509" />
                      {formErrors.longitude && <p className="text-sm text-destructive">{formErrors.longitude}</p>}
                    </div>
                  </div>

                  {/* Trail assignment */}
                  <div className="space-y-2">
                    <Label htmlFor="site-trail">Assign to Trail</Label>
                    <select
                      id="site-trail"
                      value={formTrailId}
                      onChange={(e) => setFormTrailId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">No trail</option>
                      {trails.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  {/* Media URLs */}
                  <div className="space-y-2">
                    <Label htmlFor="site-photos">Photo URLs (one per line)</Label>
                    <textarea
                      id="site-photos"
                      value={formPhotoUrls}
                      onChange={(e) => setFormPhotoUrls(e.target.value)}
                      rows={2}
                      className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                      placeholder="https://example.com/photo1.jpg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="site-audio">Audio URL</Label>
                      <Input id="site-audio" value={formAudioUrl} onChange={(e) => setFormAudioUrl(e.target.value)} placeholder="https://..." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="site-video">Video URL</Label>
                      <Input id="site-video" value={formVideoUrl} onChange={(e) => setFormVideoUrl(e.target.value)} placeholder="https://..." />
                    </div>
                  </div>

                  {/* Timeline entries */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Timeline Entries ({formTimeline.length}/{MAX_TIMELINE_ENTRIES})</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addTimelineEntry} disabled={formTimeline.length >= MAX_TIMELINE_ENTRIES}>
                        Add Entry
                      </Button>
                    </div>
                    {formTimeline.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={entry.year}
                          onChange={(e) => updateTimelineEntry(i, 'year', e.target.value)}
                          placeholder="Year"
                          className="w-24"
                        />
                        <Input
                          value={entry.event}
                          onChange={(e) => updateTimelineEntry(i, 'event', e.target.value)}
                          placeholder="Event description"
                          className="flex-1"
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeTimelineEntry(i)}>✕</Button>
                      </div>
                    ))}
                    {formErrors.timeline && <p className="text-sm text-destructive">{formErrors.timeline}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between pt-2">
                    <Button type="button" variant="outline" onClick={() => setShowPreview(true)}>Preview</Button>
                    <div className="flex gap-3">
                      <Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>Cancel</Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : editingSite ? 'Update Site' : 'Create Site'}
                      </Button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Delete Confirmation with dependency warning (Req 14.8) */}
        {deletingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-background rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Delete Heritage Site</h2>
              {dependencies.length > 0 && (
                <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  <p className="font-medium mb-1">⚠️ Dependency Warning</p>
                  <p>This site has the following dependencies that will be affected:</p>
                  <ul className="list-disc list-inside mt-1">
                    {dependencies.map((dep, i) => <li key={i}>{dep}</li>)}
                  </ul>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete &ldquo;{sites.find(s => s.id === deletingId)?.name}&rdquo;? This action cannot be undone.
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
