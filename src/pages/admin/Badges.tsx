/**
 * Admin Badges management page.
 *
 * Allows Council_Admin to create, edit, delete badges and manually award
 * badges to individual users.
 *
 * Validates: Requirements 14.5, 14.9
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Badge {
  id: string
  name: string
  description: string | null
  criteria_json: Record<string, unknown>
  icon_url: string
  category: string | null
  created_at: string
}

interface UserProfile {
  id: string
  full_name: string
  role: string
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminBadges() {
  const { user } = useAuthStore()
  const [badges, setBadges] = useState<Badge[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIconUrl, setFormIconUrl] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formCriteriaJson, setFormCriteriaJson] = useState('{}')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Award state
  const [awardingBadgeId, setAwardingBadgeId] = useState<string | null>(null)
  const [awardUserId, setAwardUserId] = useState('')
  const [isAwarding, setIsAwarding] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ─── Fetch data ────────────────────────────────────────────────────────────

  const fetchBadges = useCallback(async () => {
    const { data } = await supabase
      .from('badges')
      .select('*')
      .order('name')

    setBadges((data || []) as Badge[])
  }, [])

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name')

    setUsers((data || []) as UserProfile[])
  }, [])

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      await Promise.all([fetchBadges(), fetchUsers()])
      setIsLoading(false)
    }
    load()
  }, [fetchBadges, fetchUsers])

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [actionMessage])

  // ─── Form handlers ─────────────────────────────────────────────────────────

  function openAddForm() {
    setEditingBadge(null)
    setFormName('')
    setFormDescription('')
    setFormIconUrl('')
    setFormCategory('')
    setFormCriteriaJson('{}')
    setFormErrors({})
    setShowForm(true)
  }

  function openEditForm(badge: Badge) {
    setEditingBadge(badge)
    setFormName(badge.name)
    setFormDescription(badge.description || '')
    setFormIconUrl(badge.icon_url)
    setFormCategory(badge.category || '')
    setFormCriteriaJson(JSON.stringify(badge.criteria_json, null, 2))
    setFormErrors({})
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingBadge(null)
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!formName.trim()) errors.name = 'Badge name is required.'
    if (!formIconUrl.trim()) errors.iconUrl = 'Icon URL is required.'
    try {
      JSON.parse(formCriteriaJson)
    } catch {
      errors.criteriaJson = 'Criteria must be valid JSON.'
    }
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
      icon_url: formIconUrl.trim(),
      category: formCategory.trim() || null,
      criteria_json: JSON.parse(formCriteriaJson),
    }

    try {
      if (editingBadge) {
        const { error } = await supabase
          .from('badges')
          .update(payload)
          .eq('id', editingBadge.id)

        if (error) {
          setActionMessage({ type: 'error', text: 'Failed to update badge.' })
          setIsSubmitting(false)
          return
        }
        setActionMessage({ type: 'success', text: `Badge "${formName.trim()}" updated successfully.` })
      } else {
        const { error } = await supabase
          .from('badges')
          .insert(payload)

        if (error) {
          setActionMessage({ type: 'error', text: 'Failed to create badge.' })
          setIsSubmitting(false)
          return
        }
        setActionMessage({ type: 'success', text: `Badge "${formName.trim()}" created successfully.` })
      }

      closeForm()
      await fetchBadges()
    } catch {
      setActionMessage({ type: 'error', text: 'An unexpected error occurred.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Award badge to user (Req 14.5) ───────────────────────────────────────

  async function handleAwardBadge() {
    if (!awardingBadgeId || !awardUserId) return
    setIsAwarding(true)

    const badge = badges.find(b => b.id === awardingBadgeId)
    const awardUser = users.find(u => u.id === awardUserId)

    // Check if already awarded
    const { data: existing } = await supabase
      .from('user_badges')
      .select('id')
      .eq('user_id', awardUserId)
      .eq('badge_id', awardingBadgeId)
      .single()

    if (existing) {
      setActionMessage({ type: 'error', text: `User "${awardUser?.full_name}" already has the "${badge?.name}" badge.` })
      setIsAwarding(false)
      setAwardingBadgeId(null)
      setAwardUserId('')
      return
    }

    const { error } = await supabase
      .from('user_badges')
      .insert({
        user_id: awardUserId,
        badge_id: awardingBadgeId,
      })

    if (error) {
      setActionMessage({ type: 'error', text: 'Failed to award badge.' })
    } else {
      setActionMessage({ type: 'success', text: `Badge "${badge?.name}" awarded to ${awardUser?.full_name}.` })

      // Notify user
      await supabase.from('notifications').insert({
        user_id: awardUserId,
        title: 'Badge Earned!',
        body: `You have been awarded the "${badge?.name}" badge by an administrator.`,
        type: 'badge_earned',
        reference_id: awardingBadgeId,
      })
    }

    setAwardingBadgeId(null)
    setAwardUserId('')
    setIsAwarding(false)
  }

  // ─── Delete handler ────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deletingId) return
    setIsDeleting(true)

    const badge = badges.find(b => b.id === deletingId)
    const { error } = await supabase
      .from('badges')
      .delete()
      .eq('id', deletingId)

    if (error) {
      setActionMessage({ type: 'error', text: 'Failed to delete badge.' })
    } else {
      setActionMessage({ type: 'success', text: `Badge "${badge?.name}" deleted successfully.` })
      await fetchBadges()
    }

    setDeletingId(null)
    setIsDeleting(false)
  }

  // ─── Access check ──────────────────────────────────────────────────────────

  if (!user || user.role !== 'Council_Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">Access denied. Only Council Admins can manage badges.</p>
          <Link to="/app/passport" className="text-primary hover:underline text-sm">Back to Passport</Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading badges...</p>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manage Badges</h1>
            <p className="text-sm text-muted-foreground mt-1">Create badges and manually award them to users.</p>
          </div>
          <Button onClick={openAddForm}>Add Badge</Button>
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

        {badges.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No badges yet. Create your first badge.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {badges.map((badge) => (
              <div key={badge.id} className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
                <img src={badge.icon_url} alt={badge.name} className="w-10 h-10 object-contain flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">{badge.name}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {badge.category && `${badge.category} • `}{badge.description || 'No description'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => { setAwardingBadgeId(badge.id); setAwardUserId('') }}>
                    Award
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEditForm(badge)}>Edit</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingId(badge.id)}
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
                {editingBadge ? 'Edit Badge' : 'Create Badge'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="badge-name">Badge Name <span className="text-destructive">*</span></Label>
                  <Input id="badge-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Heritage Explorer" />
                  {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="badge-icon">Icon URL <span className="text-destructive">*</span></Label>
                  <Input id="badge-icon" value={formIconUrl} onChange={(e) => setFormIconUrl(e.target.value)} placeholder="https://..." />
                  {formErrors.iconUrl && <p className="text-sm text-destructive">{formErrors.iconUrl}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="badge-category">Category</Label>
                  <Input id="badge-category" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="e.g. Exploration, Service, Achievement" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="badge-description">Description</Label>
                  <textarea
                    id="badge-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                    className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                    placeholder="Badge description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="badge-criteria">Criteria JSON</Label>
                  <textarea
                    id="badge-criteria"
                    value={formCriteriaJson}
                    onChange={(e) => setFormCriteriaJson(e.target.value)}
                    rows={3}
                    className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                    placeholder='{"type": "trail_complete", "trail_count": 3}'
                  />
                  {formErrors.criteriaJson && <p className="text-sm text-destructive">{formErrors.criteriaJson}</p>}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : editingBadge ? 'Update Badge' : 'Create Badge'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Award Badge Modal */}
        {awardingBadgeId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-background rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Award Badge</h2>
              <p className="text-sm text-muted-foreground">
                Award &ldquo;{badges.find(b => b.id === awardingBadgeId)?.name}&rdquo; to a user.
              </p>
              <div className="space-y-2">
                <Label htmlFor="award-user">Select User</Label>
                <select
                  id="award-user"
                  value={awardUserId}
                  onChange={(e) => setAwardUserId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Choose a user...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setAwardingBadgeId(null); setAwardUserId('') }} disabled={isAwarding}>Cancel</Button>
                <Button onClick={handleAwardBadge} disabled={isAwarding || !awardUserId}>
                  {isAwarding ? 'Awarding...' : 'Award Badge'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deletingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-background rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Delete Badge</h2>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete &ldquo;{badges.find(b => b.id === deletingId)?.name}&rdquo;?
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
