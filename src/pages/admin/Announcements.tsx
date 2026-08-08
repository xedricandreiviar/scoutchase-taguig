/**
 * Admin Announcements management page.
 *
 * Allows Council_Admin to publish announcements (max 2,000 characters)
 * to the notification feed, visible to users within 60 seconds.
 *
 * Validates: Requirements 14.7, 14.9
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_CONTENT_LENGTH = 2000

// ─── Types ───────────────────────────────────────────────────────────────────

interface Announcement {
  id: string
  title: string
  content: string
  author_id: string
  target_roles: string[]
  is_published: boolean
  published_at: string | null
  created_at: string
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminAnnouncements() {
  const { user } = useAuthStore()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ─── Fetch data ────────────────────────────────────────────────────────────

  const fetchAnnouncements = useCallback(async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })

    setAnnouncements((data || []) as Announcement[])
  }, [])

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      await fetchAnnouncements()
      setIsLoading(false)
    }
    load()
  }, [fetchAnnouncements])

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [actionMessage])

  // ─── Form handlers ─────────────────────────────────────────────────────────

  function openAddForm() {
    setEditingAnnouncement(null)
    setFormTitle('')
    setFormContent('')
    setFormErrors({})
    setShowForm(true)
  }

  function openEditForm(announcement: Announcement) {
    setEditingAnnouncement(announcement)
    setFormTitle(announcement.title)
    setFormContent(announcement.content)
    setFormErrors({})
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingAnnouncement(null)
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!formTitle.trim()) errors.title = 'Title is required.'
    if (!formContent.trim()) errors.content = 'Content is required.'
    if (formContent.length > MAX_CONTENT_LENGTH) errors.content = `Content must be ${MAX_CONTENT_LENGTH} characters or fewer.`
    return errors
  }

  async function handleSubmit(e: React.FormEvent, publish: boolean) {
    e.preventDefault()
    setActionMessage(null)

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    if (!user) return
    setIsSubmitting(true)

    const payload = {
      title: formTitle.trim(),
      content: formContent.trim(),
      author_id: user.id,
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
    }

    try {
      if (editingAnnouncement) {
        const { error } = await supabase
          .from('announcements')
          .update(payload)
          .eq('id', editingAnnouncement.id)

        if (error) {
          setActionMessage({ type: 'error', text: 'Failed to update announcement.' })
          setIsSubmitting(false)
          return
        }
        setActionMessage({
          type: 'success',
          text: publish
            ? `Announcement "${formTitle.trim()}" published successfully.`
            : `Announcement "${formTitle.trim()}" saved as draft.`,
        })
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert(payload)

        if (error) {
          setActionMessage({ type: 'error', text: 'Failed to create announcement.' })
          setIsSubmitting(false)
          return
        }
        setActionMessage({
          type: 'success',
          text: publish
            ? `Announcement "${formTitle.trim()}" published successfully.`
            : `Announcement "${formTitle.trim()}" saved as draft.`,
        })
      }

      closeForm()
      await fetchAnnouncements()
    } catch {
      setActionMessage({ type: 'error', text: 'An unexpected error occurred.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Publish handler ───────────────────────────────────────────────────────

  async function handlePublish(announcementId: string) {
    const announcement = announcements.find(a => a.id === announcementId)
    if (!announcement) return

    const { error } = await supabase
      .from('announcements')
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
      })
      .eq('id', announcementId)

    if (error) {
      setActionMessage({ type: 'error', text: 'Failed to publish announcement.' })
    } else {
      setActionMessage({ type: 'success', text: `Announcement "${announcement.title}" published.` })
      await fetchAnnouncements()
    }
  }

  // ─── Delete handler ────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deletingId) return
    setIsDeleting(true)

    const announcement = announcements.find(a => a.id === deletingId)
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', deletingId)

    if (error) {
      setActionMessage({ type: 'error', text: 'Failed to delete announcement.' })
    } else {
      setActionMessage({ type: 'success', text: `Announcement "${announcement?.title}" deleted.` })
      await fetchAnnouncements()
    }

    setDeletingId(null)
    setIsDeleting(false)
  }

  // ─── Access check ──────────────────────────────────────────────────────────

  if (!user || user.role !== 'Council_Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">Access denied. Only Council Admins can manage announcements.</p>
          <Link to="/app/passport" className="text-primary hover:underline text-sm">Back to Passport</Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading announcements...</p>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
            <p className="text-sm text-muted-foreground mt-1">Publish announcements to the notification feed (max 2,000 characters).</p>
          </div>
          <Button onClick={openAddForm}>New Announcement</Button>
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

        {announcements.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No announcements yet. Create your first announcement.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground truncate">{announcement.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        announcement.is_published
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {announcement.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{announcement.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created: {new Date(announcement.created_at).toLocaleDateString()}
                      {announcement.published_at && ` • Published: ${new Date(announcement.published_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-4">
                    {!announcement.is_published && (
                      <Button variant="outline" size="sm" onClick={() => handlePublish(announcement.id)}>
                        Publish
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openEditForm(announcement)}>Edit</Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive hover:bg-destructive/10"
                      onClick={() => setDeletingId(announcement.id)}
                    >
                      Delete
                    </Button>
                  </div>
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
                {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
              </h2>

              <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="announcement-title">Title <span className="text-destructive">*</span></Label>
                  <Input
                    id="announcement-title"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Announcement title"
                  />
                  {formErrors.title && <p className="text-sm text-destructive">{formErrors.title}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="announcement-content">Content <span className="text-destructive">*</span></Label>
                  <textarea
                    id="announcement-content"
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    rows={6}
                    className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                    placeholder="Write your announcement here (max 2,000 characters)..."
                  />
                  <p className={`text-xs text-right ${formContent.length > MAX_CONTENT_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {formContent.length}/{MAX_CONTENT_LENGTH}
                  </p>
                  {formErrors.content && <p className="text-sm text-destructive">{formErrors.content}</p>}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={(e) => handleSubmit(e as any, false)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Draft'}
                  </Button>
                  <Button
                    type="button"
                    onClick={(e) => handleSubmit(e as any, true)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Publishing...' : 'Publish'}
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
              <h2 className="text-lg font-semibold text-foreground">Delete Announcement</h2>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete &ldquo;{announcements.find(a => a.id === deletingId)?.title}&rdquo;?
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
