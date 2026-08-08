/**
 * Admin Challenges management page.
 *
 * Allows Council_Admin to create, edit, and delete challenges with
 * type and difficulty selection.
 *
 * Validates: Requirements 14.3, 14.8, 14.9
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Constants ───────────────────────────────────────────────────────────────

const CHALLENGE_TYPES = ['quiz', 'photo_upload', 'reflection', 'scavenger_hunt', 'creative']
const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard']

// ─── Types ───────────────────────────────────────────────────────────────────

interface Challenge {
  id: string
  heritage_site_id: string
  type: string
  difficulty: string
  title: string
  description: string | null
  content_json: Record<string, unknown>
  points_reward: number
  max_attempts: number
  created_at: string
  site_name?: string
}

interface HeritageSite {
  id: string
  name: string
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminChallenges() {
  const { user } = useAuthStore()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [sites, setSites] = useState<HeritageSite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState(CHALLENGE_TYPES[0])
  const [formDifficulty, setFormDifficulty] = useState('Medium')
  const [formSiteId, setFormSiteId] = useState('')
  const [formPointsReward, setFormPointsReward] = useState('50')
  const [formMaxAttempts, setFormMaxAttempts] = useState('3')
  const [formContentJson, setFormContentJson] = useState('{}')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dependencies, setDependencies] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

  // ─── Fetch data ────────────────────────────────────────────────────────────

  const fetchChallenges = useCallback(async () => {
    const { data } = await supabase
      .from('challenges')
      .select('*, heritage_sites!challenges_heritage_site_id_fkey(name)')
      .order('created_at', { ascending: false })

    const mapped = (data || []).map((c: any) => ({
      ...c,
      site_name: c.heritage_sites?.name || 'Unknown Site',
    }))
    setChallenges(mapped)
  }, [])

  const fetchSites = useCallback(async () => {
    const { data } = await supabase
      .from('heritage_sites')
      .select('id, name')
      .order('name')

    setSites((data || []) as HeritageSite[])
  }, [])

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      await Promise.all([fetchChallenges(), fetchSites()])
      setIsLoading(false)
    }
    load()
  }, [fetchChallenges, fetchSites])

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [actionMessage])

  // ─── Form handlers ─────────────────────────────────────────────────────────

  function openAddForm() {
    setEditingChallenge(null)
    setFormTitle('')
    setFormDescription('')
    setFormType(CHALLENGE_TYPES[0])
    setFormDifficulty('Medium')
    setFormSiteId('')
    setFormPointsReward('50')
    setFormMaxAttempts('3')
    setFormContentJson('{}')
    setFormErrors({})
    setShowForm(true)
  }

  function openEditForm(challenge: Challenge) {
    setEditingChallenge(challenge)
    setFormTitle(challenge.title)
    setFormDescription(challenge.description || '')
    setFormType(challenge.type)
    setFormDifficulty(challenge.difficulty)
    setFormSiteId(challenge.heritage_site_id)
    setFormPointsReward(String(challenge.points_reward))
    setFormMaxAttempts(String(challenge.max_attempts))
    setFormContentJson(JSON.stringify(challenge.content_json, null, 2))
    setFormErrors({})
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingChallenge(null)
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!formTitle.trim()) errors.title = 'Title is required.'
    if (!formSiteId) errors.siteId = 'Heritage site is required.'
    if (!CHALLENGE_TYPES.includes(formType)) errors.type = 'Invalid challenge type.'
    if (!DIFFICULTY_LEVELS.includes(formDifficulty)) errors.difficulty = 'Invalid difficulty level.'
    try {
      JSON.parse(formContentJson)
    } catch {
      errors.contentJson = 'Content JSON must be valid JSON.'
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
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      type: formType,
      difficulty: formDifficulty,
      heritage_site_id: formSiteId,
      points_reward: parseInt(formPointsReward) || 50,
      max_attempts: parseInt(formMaxAttempts) || 3,
      content_json: JSON.parse(formContentJson),
      updated_at: new Date().toISOString(),
    }

    try {
      if (editingChallenge) {
        const { error } = await supabase
          .from('challenges')
          .update(payload)
          .eq('id', editingChallenge.id)

        if (error) {
          setActionMessage({ type: 'error', text: 'Failed to update challenge.' })
          setIsSubmitting(false)
          return
        }
        setActionMessage({ type: 'success', text: `Challenge "${formTitle.trim()}" updated successfully.` })
      } else {
        const { error } = await supabase
          .from('challenges')
          .insert(payload)

        if (error) {
          setActionMessage({ type: 'error', text: 'Failed to create challenge.' })
          setIsSubmitting(false)
          return
        }
        setActionMessage({ type: 'success', text: `Challenge "${formTitle.trim()}" created successfully.` })
      }

      closeForm()
      await fetchChallenges()
    } catch {
      setActionMessage({ type: 'error', text: 'An unexpected error occurred.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Delete with dependency check (Req 14.8) ──────────────────────────────

  async function handleDeleteClick(challengeId: string) {
    const deps: string[] = []

    const { count: submissionCount } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('challenge_id', challengeId)

    if (submissionCount && submissionCount > 0) deps.push(`${submissionCount} submission(s)`)

    setDependencies(deps)
    setDeletingId(challengeId)
  }

  async function handleDelete() {
    if (!deletingId) return
    setIsDeleting(true)

    const challenge = challenges.find(c => c.id === deletingId)
    const { error } = await supabase
      .from('challenges')
      .delete()
      .eq('id', deletingId)

    if (error) {
      setActionMessage({ type: 'error', text: 'Failed to delete challenge.' })
    } else {
      setActionMessage({ type: 'success', text: `Challenge "${challenge?.title}" deleted successfully.` })
      await fetchChallenges()
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
          <p className="text-destructive">Access denied. Only Council Admins can manage challenges.</p>
          <Link to="/app/passport" className="text-primary hover:underline text-sm">Back to Passport</Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading challenges...</p>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manage Challenges</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and configure challenges with type and difficulty.</p>
          </div>
          <Button onClick={openAddForm}>Add Challenge</Button>
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

        {challenges.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No challenges yet. Create your first challenge.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {challenges.map((challenge) => (
              <div key={challenge.id} className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">{challenge.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {challenge.site_name} • {challenge.type.replace('_', ' ')} • {challenge.difficulty} • {challenge.points_reward} pts
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEditForm(challenge)}>Edit</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteClick(challenge.id)}
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
                {editingChallenge ? 'Edit Challenge' : 'Create Challenge'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="challenge-title">Title <span className="text-destructive">*</span></Label>
                  <Input id="challenge-title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. Fort Santiago History Quiz" />
                  {formErrors.title && <p className="text-sm text-destructive">{formErrors.title}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="challenge-site">Heritage Site <span className="text-destructive">*</span></Label>
                  <select
                    id="challenge-site"
                    value={formSiteId}
                    onChange={(e) => setFormSiteId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select a site...</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {formErrors.siteId && <p className="text-sm text-destructive">{formErrors.siteId}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="challenge-type">Type <span className="text-destructive">*</span></Label>
                    <select
                      id="challenge-type"
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {CHALLENGE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                    {formErrors.type && <p className="text-sm text-destructive">{formErrors.type}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="challenge-difficulty">Difficulty <span className="text-destructive">*</span></Label>
                    <select
                      id="challenge-difficulty"
                      value={formDifficulty}
                      onChange={(e) => setFormDifficulty(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {DIFFICULTY_LEVELS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {formErrors.difficulty && <p className="text-sm text-destructive">{formErrors.difficulty}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="challenge-points">Points Reward</Label>
                    <Input id="challenge-points" type="number" min="0" value={formPointsReward} onChange={(e) => setFormPointsReward(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="challenge-attempts">Max Attempts</Label>
                    <Input id="challenge-attempts" type="number" min="1" max="10" value={formMaxAttempts} onChange={(e) => setFormMaxAttempts(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="challenge-description">Description</Label>
                  <textarea
                    id="challenge-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                    className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                    placeholder="Challenge description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="challenge-content">Content JSON</Label>
                  <textarea
                    id="challenge-content"
                    value={formContentJson}
                    onChange={(e) => setFormContentJson(e.target.value)}
                    rows={4}
                    className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                    placeholder='{"questions": [...]}'
                  />
                  {formErrors.contentJson && <p className="text-sm text-destructive">{formErrors.contentJson}</p>}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : editingChallenge ? 'Update Challenge' : 'Create Challenge'}
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
              <h2 className="text-lg font-semibold text-foreground">Delete Challenge</h2>
              {dependencies.length > 0 && (
                <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  <p className="font-medium mb-1">⚠️ Dependency Warning</p>
                  <p>This challenge has dependencies:</p>
                  <ul className="list-disc list-inside mt-1">
                    {dependencies.map((dep, i) => <li key={i}>{dep}</li>)}
                  </ul>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete &ldquo;{challenges.find(c => c.id === deletingId)?.title}&rdquo;?
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
