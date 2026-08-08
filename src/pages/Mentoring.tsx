/**
 * Rover Scout Mentoring Panel.
 *
 * Displays a paginated list (max 50/page) of Cub_Scout and Boy_Scout users
 * in the same council. Allows reviewing their submissions and providing
 * feedback comments (1-1000 chars). Rejects moderation attempts on
 * Senior_Scout, Rover_Scout, and Adult_Leader submissions with an error message.
 *
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { UserRole } from '@/stores/auth'
import { canRoverModerate } from '@/lib/review/moderation-scope'

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

// ─── Types ───────────────────────────────────────────────────────────────────

interface Mentee {
  id: string
  full_name: string
  display_name: string | null
  role: UserRole
  troop_unit_number: string | null
  school: string | null
  total_points: number
}

interface MenteeSubmission {
  id: string
  user_id: string
  challenge_id: string
  response_json: Record<string, unknown>
  photo_url: string | null
  status: string
  attempt_number: number
  points_awarded: number
  created_at: string
  challenge_title: string
  challenge_points: number
  max_attempts: number
  user_role: UserRole
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Mentoring() {
  const { user } = useAuthStore()

  const [mentees, setMentees] = useState<Mentee[]>([])
  const [isLoadingMentees, setIsLoadingMentees] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Submission review state
  const [selectedMentee, setSelectedMentee] = useState<Mentee | null>(null)
  const [submissions, setSubmissions] = useState<MenteeSubmission[]>([])
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false)

  // Feedback state
  const [feedbackTarget, setFeedbackTarget] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  // Moderation error (Req 18.4)
  const [moderationError, setModerationError] = useState<string | null>(null)

  // ─── Fetch mentees (Req 18.1) ──────────────────────────────────────────────

  const fetchMentees = useCallback(async (page: number) => {
    if (!user) return
    setIsLoadingMentees(true)
    setError(null)

    const offset = (page - 1) * PAGE_SIZE

    // Get count first
    let countQuery = supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('role', ['Cub_Scout', 'Boy_Scout'])

    if (user.council_id) {
      countQuery = countQuery.eq('council_id', user.council_id)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      setError('Failed to load mentees.')
      setIsLoadingMentees(false)
      return
    }

    setTotalCount(count ?? 0)

    // Get paginated mentees
    let query = supabase
      .from('profiles')
      .select('id, full_name, display_name, role, troop_unit_number, school, total_points')
      .in('role', ['Cub_Scout', 'Boy_Scout'])
      .order('full_name', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (user.council_id) {
      query = query.eq('council_id', user.council_id)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError('Failed to load mentees.')
      setIsLoadingMentees(false)
      return
    }

    setMentees((data ?? []) as Mentee[])
    setIsLoadingMentees(false)
  }, [user])

  useEffect(() => {
    fetchMentees(currentPage)
  }, [currentPage, fetchMentees])

  // ─── Fetch submissions for a mentee ────────────────────────────────────────

  const fetchMenteeSubmissions = useCallback(async (mentee: Mentee) => {
    if (!user) return
    setIsLoadingSubmissions(true)
    setSubmissions([])
    setModerationError(null)

    // Enforce moderation scope (Req 18.3, 18.4)
    if (!canRoverModerate(mentee.role)) {
      setModerationError(
        'Moderation is restricted to Cub Scout and Boy Scout submissions only.'
      )
      setIsLoadingSubmissions(false)
      return
    }

    const { data, error: fetchError } = await supabase
      .from('submissions')
      .select(`
        id, user_id, challenge_id, response_json, photo_url,
        status, attempt_number, points_awarded, created_at,
        challenges!submissions_challenge_id_fkey (title, points_reward, max_attempts)
      `)
      .eq('user_id', mentee.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError('Failed to load submissions.')
      setIsLoadingSubmissions(false)
      return
    }

    const mapped: MenteeSubmission[] = (data || [])
      .filter((item: any) => item.challenges)
      .map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        challenge_id: item.challenge_id,
        response_json: item.response_json,
        photo_url: item.photo_url,
        status: item.status,
        attempt_number: item.attempt_number,
        points_awarded: item.points_awarded,
        created_at: item.created_at,
        challenge_title: item.challenges.title,
        challenge_points: item.challenges.points_reward,
        max_attempts: item.challenges.max_attempts,
        user_role: mentee.role,
      }))

    setSubmissions(mapped)
    setIsLoadingSubmissions(false)
  }, [user])

  // ─── Handle moderation attempt on invalid roles (Req 18.4) ─────────────────

  function handleSelectMentee(mentee: Mentee) {
    setSelectedMentee(mentee)
    setModerationError(null)
    setActionMessage(null)
    setFeedbackTarget(null)
    setFeedback('')
    setFeedbackError(null)
    fetchMenteeSubmissions(mentee)
  }

  // ─── Submit feedback on a submission (Req 18.2, 18.5) ──────────────────────

  async function handleSubmitFeedback(submission: MenteeSubmission) {
    if (!user) return

    // Enforce moderation scope again (Req 18.3, 18.4)
    if (!canRoverModerate(submission.user_role)) {
      setModerationError(
        'Moderation is restricted to Cub Scout and Boy Scout submissions only.'
      )
      return
    }

    // Validate feedback length (Req 18.5)
    const trimmedFeedback = feedback.trim()
    if (trimmedFeedback.length < 1 || trimmedFeedback.length > 1000) {
      setFeedbackError('Feedback must be between 1 and 1000 characters.')
      return
    }

    setIsProcessing(true)
    setFeedbackError(null)

    // Update submission with reviewer feedback (Req 18.2)
    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        reviewer_id: user.id,
        reviewer_feedback: trimmedFeedback,
        reviewed_at: new Date().toISOString(),
        status: 'approved',
        points_awarded: submission.challenge_points,
      })
      .eq('id', submission.id)

    if (updateError) {
      setActionMessage('Failed to submit feedback.')
      setIsProcessing(false)
      return
    }

    // Award points
    await supabase.from('points_ledger').insert({
      user_id: submission.user_id,
      amount: submission.challenge_points,
      reason: 'challenge_complete',
      reference_id: submission.id,
    })

    // Update user's total_points
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_points')
      .eq('id', submission.user_id)
      .single()

    if (profile) {
      await supabase
        .from('profiles')
        .update({ total_points: profile.total_points + submission.challenge_points })
        .eq('id', submission.user_id)
    }

    // Notification
    await supabase.from('notifications').insert({
      user_id: submission.user_id,
      title: 'Submission Reviewed',
      body: `Your mentor reviewed your submission for "${submission.challenge_title}". Feedback: ${trimmedFeedback}`,
      type: 'submission_status',
      reference_id: submission.id,
    })

    setActionMessage(`Feedback submitted for "${submission.challenge_title}".`)
    setSubmissions((prev) => prev.filter((s) => s.id !== submission.id))
    setFeedbackTarget(null)
    setFeedback('')
    setIsProcessing(false)
  }

  // ─── Access check ──────────────────────────────────────────────────────────

  if (!user || !['Rover_Scout', 'Council_Admin'].includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">
            Access denied. Only Rover Scouts and Council Admins can access the mentoring panel.
          </p>
          <Link to="/app/passport" className="text-primary hover:underline text-sm">
            Back to Passport
          </Link>
        </div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mentoring Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review and provide feedback to Cub Scouts and Boy Scouts in your council.
            </p>
          </div>
          <Link
            to="/app/passport"
            className="text-sm text-primary hover:underline"
          >
            ← Back
          </Link>
        </header>

        {/* Action message */}
        {actionMessage && (
          <div className="rounded-lg p-3 bg-green-50 border border-green-200 text-green-800 text-sm" role="alert">
            {actionMessage}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
            {error}
          </div>
        )}

        {/* Moderation scope error (Req 18.4) */}
        {moderationError && (
          <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
            {moderationError}
          </div>
        )}

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mentee List Panel */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Mentees</h2>

            {isLoadingMentees ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading mentees...</p>
              </div>
            ) : mentees.length === 0 ? (
              /* Empty state (Req 18.6) */
              <div className="flex items-center justify-center py-12 border border-dashed border-border rounded-lg">
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground">
                    No mentees are currently available in your council.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cub Scouts and Boy Scouts in your council will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <ul className="space-y-2" aria-label="Mentee list">
                  {mentees.map((mentee) => (
                    <li key={mentee.id}>
                      <button
                        onClick={() => handleSelectMentee(mentee)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedMentee?.id === mentee.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-card hover:bg-muted/50'
                        }`}
                      >
                        <p className="font-medium text-foreground">
                          {mentee.display_name || mentee.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {mentee.role.replace('_', ' ')}
                          {mentee.troop_unit_number && ` • Troop ${mentee.troop_unit_number}`}
                          {mentee.school && ` • ${mentee.school}`}
                        </p>
                        <p className="text-xs text-primary mt-1">
                          {mentee.total_points.toLocaleString()} points
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-sm font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 text-sm font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Submission Review Panel */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Submissions</h2>

            {!selectedMentee ? (
              <div className="flex items-center justify-center py-12 border border-dashed border-border rounded-lg">
                <p className="text-muted-foreground text-sm">
                  Select a mentee to view their submissions.
                </p>
              </div>
            ) : moderationError ? (
              <div className="flex items-center justify-center py-12 border border-dashed border-border rounded-lg">
                <p className="text-destructive text-sm text-center px-4">
                  {moderationError}
                </p>
              </div>
            ) : isLoadingSubmissions ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading submissions...</p>
              </div>
            ) : submissions.length === 0 ? (
              <div className="flex items-center justify-center py-12 border border-dashed border-border rounded-lg">
                <p className="text-muted-foreground text-sm">
                  No pending submissions for {selectedMentee.display_name || selectedMentee.full_name}.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="rounded-lg border border-border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-foreground text-sm">
                          {submission.challenge_title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Attempt {submission.attempt_number} of {submission.max_attempts}
                          {' • '}
                          {new Date(submission.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                        {submission.challenge_points} pts
                      </span>
                    </div>

                    {submission.photo_url && (
                      <a
                        href={submission.photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-xs"
                      >
                        View attached photo
                      </a>
                    )}

                    {submission.response_json && (
                      <div className="p-2 bg-muted/50 rounded text-xs">
                        <p className="font-medium mb-1">Response:</p>
                        <p>{formatResponse(submission.response_json)}</p>
                      </div>
                    )}

                    {/* Feedback form (Req 18.2, 18.5) */}
                    {feedbackTarget === submission.id ? (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <label
                          htmlFor={`feedback-${submission.id}`}
                          className="text-xs font-medium text-foreground"
                        >
                          Feedback (1-1000 characters)
                        </label>
                        <textarea
                          id={`feedback-${submission.id}`}
                          value={feedback}
                          onChange={(e) => {
                            setFeedback(e.target.value)
                            setFeedbackError(null)
                          }}
                          rows={3}
                          maxLength={1000}
                          className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                          placeholder="Provide constructive feedback for this scout..."
                        />
                        {feedbackError && (
                          <p className="text-xs text-destructive">{feedbackError}</p>
                        )}
                        <p className="text-xs text-muted-foreground text-right">
                          {feedback.trim().length}/1000 characters
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSubmitFeedback(submission)}
                            disabled={isProcessing || feedback.trim().length < 1}
                            className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isProcessing ? 'Submitting...' : 'Approve with Feedback'}
                          </button>
                          <button
                            onClick={() => {
                              setFeedbackTarget(null)
                              setFeedback('')
                              setFeedbackError(null)
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                            disabled={isProcessing}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-border">
                        <button
                          onClick={() => {
                            setFeedbackTarget(submission.id)
                            setFeedback('')
                            setFeedbackError(null)
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                          Review & Provide Feedback
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatResponse(json: Record<string, unknown>): string {
  if (json.text) return String(json.text)
  if (json.caption) return String(json.caption)
  if (json.answers) {
    const answers = json.answers as Record<string, number>
    return `Answers: ${Object.entries(answers).map(([q, a]) => `Q${q}:${a}`).join(', ')}`
  }
  return JSON.stringify(json).slice(0, 200)
}
