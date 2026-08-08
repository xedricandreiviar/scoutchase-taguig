/**
 * Review Queue page for pending submissions and service logs.
 *
 * Role-based filtering:
 * - Adult_Leader: sees only submissions/logs from own troop
 * - Rover_Scout: sees only submissions from Cub_Scout and Boy_Scout users
 * - Council_Admin: sees all pending items
 *
 * Requirements: 9.8, 9.9, 9.10, 10.3, 10.5, 10.6, 3.7
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { UserRole } from '@/stores/auth'
import {
  canResubmit,
  getSubmissionStatus,
  getServiceLogStatus,
  isValidFeedback,
} from '@/lib/review/attempt-limiter'
import { calculateServicePoints } from '@/lib/points/service-points'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubmissionItem {
  id: string
  user_id: string
  challenge_id: string
  response_json: Record<string, unknown>
  photo_url: string | null
  status: string
  attempt_number: number
  points_awarded: number
  created_at: string
  user_name: string
  user_role: UserRole
  user_troop: string | null
  challenge_title: string
  challenge_points: number
  max_attempts: number
}

interface ServiceLogItem {
  id: string
  user_id: string
  mission_id: string
  description: string
  duration_hours: number
  date_performed: string
  photo_url: string | null
  status: string
  attempt_number: number
  max_attempts: number
  created_at: string
  user_name: string
  user_role: UserRole
  user_troop: string | null
  mission_name: string
}

type ReviewTab = 'submissions' | 'service_logs'

// ─── Helper: Role-based query filtering ─────────────────────────────────────

/**
 * Determines which user roles the current reviewer can see submissions from.
 * - Adult_Leader: same troop only (handled via troop filter)
 * - Rover_Scout: Cub_Scout and Boy_Scout only
 * - Council_Admin: all
 */
function getReviewableRoles(reviewerRole: UserRole): UserRole[] | null {
  switch (reviewerRole) {
    case 'Rover_Scout':
      return ['Cub_Scout', 'Boy_Scout']
    case 'Council_Admin':
      return null // null means no role filter (all)
    case 'Adult_Leader':
      return null // filtering by troop instead
    default:
      return []
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ReviewQueue() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<ReviewTab>('submissions')
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [serviceLogs, setServiceLogs] = useState<ServiceLogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Reject modal state
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectingType, setRejectingType] = useState<'submission' | 'service_log' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const reviewerRole = user?.role
  const reviewerTroop = user?.troop_unit_number

  // ─── Fetch pending submissions ─────────────────────────────────────────────

  const fetchSubmissions = useCallback(async () => {
    if (!user || !reviewerRole) return

    let query = supabase
      .from('submissions')
      .select(`
        id, user_id, challenge_id, response_json, photo_url,
        status, attempt_number, points_awarded, created_at,
        profiles!submissions_user_id_fkey (full_name, role, troop_unit_number),
        challenges!submissions_challenge_id_fkey (title, points_reward, max_attempts)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    // Role-based scope filtering
    const reviewableRoles = getReviewableRoles(reviewerRole)
    if (reviewerRole === 'Adult_Leader' && reviewerTroop) {
      // Adult_Leader sees own troop only
      query = query.eq('profiles.troop_unit_number', reviewerTroop)
    } else if (reviewableRoles && reviewableRoles.length > 0) {
      // Rover_Scout sees Cub_Scout and Boy_Scout only
      query = query.in('profiles.role', reviewableRoles)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError('Failed to load submissions.')
      return
    }

    const mapped: SubmissionItem[] = (data || [])
      .filter((item: any) => item.profiles && item.challenges)
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
        user_name: item.profiles.full_name,
        user_role: item.profiles.role,
        user_troop: item.profiles.troop_unit_number,
        challenge_title: item.challenges.title,
        challenge_points: item.challenges.points_reward,
        max_attempts: item.challenges.max_attempts,
      }))

    // Additional client-side filter for Adult_Leader (troop match)
    const filtered = reviewerRole === 'Adult_Leader' && reviewerTroop
      ? mapped.filter((s) => s.user_troop === reviewerTroop)
      : mapped

    setSubmissions(filtered)
  }, [user, reviewerRole, reviewerTroop])

  // ─── Fetch pending service logs ────────────────────────────────────────────

  const fetchServiceLogs = useCallback(async () => {
    if (!user || !reviewerRole) return

    // Rover_Scout does NOT review service logs — only Adult_Leader and Council_Admin
    if (reviewerRole === 'Rover_Scout') {
      setServiceLogs([])
      return
    }

    let query = supabase
      .from('service_logs')
      .select(`
        id, user_id, mission_id, description, duration_hours,
        date_performed, photo_url, status, attempt_number, max_attempts, created_at,
        profiles!service_logs_user_id_fkey (full_name, role, troop_unit_number),
        service_missions!service_logs_mission_id_fkey (name)
      `)
      .eq('status', 'pending_verification')
      .order('created_at', { ascending: true })

    // Adult_Leader sees own troop only
    if (reviewerRole === 'Adult_Leader' && reviewerTroop) {
      query = query.eq('profiles.troop_unit_number', reviewerTroop)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError('Failed to load service logs.')
      return
    }

    const mapped: ServiceLogItem[] = (data || [])
      .filter((item: any) => item.profiles && item.service_missions)
      .map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        mission_id: item.mission_id,
        description: item.description,
        duration_hours: item.duration_hours,
        date_performed: item.date_performed,
        photo_url: item.photo_url,
        status: item.status,
        attempt_number: item.attempt_number,
        max_attempts: item.max_attempts,
        created_at: item.created_at,
        user_name: item.profiles.full_name,
        user_role: item.profiles.role,
        user_troop: item.profiles.troop_unit_number,
        mission_name: item.service_missions.name,
      }))

    // Additional client-side filter for Adult_Leader (troop match)
    const filtered = reviewerRole === 'Adult_Leader' && reviewerTroop
      ? mapped.filter((s) => s.user_troop === reviewerTroop)
      : mapped

    setServiceLogs(filtered)
  }, [user, reviewerRole, reviewerTroop])

  // ─── Load data on mount ────────────────────────────────────────────────────

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setError(null)
      await Promise.all([fetchSubmissions(), fetchServiceLogs()])
      setIsLoading(false)
    }
    loadData()
  }, [fetchSubmissions, fetchServiceLogs])

  // ─── Approve submission (Req 9.8) ─────────────────────────────────────────

  async function handleApproveSubmission(submission: SubmissionItem) {
    if (!user) return
    setIsProcessing(true)
    setActionMessage(null)

    const newStatus = getSubmissionStatus(
      submission.attempt_number,
      submission.max_attempts,
      'approve'
    )

    // Update submission status
    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        status: newStatus,
        reviewer_id: user.id,
        points_awarded: submission.challenge_points,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submission.id)

    if (updateError) {
      setActionMessage('Failed to approve submission.')
      setIsProcessing(false)
      return
    }

    // Award points via points_ledger (Req 9.8)
    await supabase.from('points_ledger').insert({
      user_id: submission.user_id,
      amount: submission.challenge_points,
      reason: 'challenge_complete',
      reference_id: submission.id,
    })

    // Update user's total_points on profile
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

    // Send notification to user (Req 9.8, 16.3)
    await supabase.from('notifications').insert({
      user_id: submission.user_id,
      title: 'Submission Approved',
      body: `Your submission for "${submission.challenge_title}" has been approved! You earned ${submission.challenge_points} points.`,
      type: 'submission_status',
      reference_id: submission.id,
    })

    setActionMessage(`Approved submission for "${submission.challenge_title}".`)
    setSubmissions((prev) => prev.filter((s) => s.id !== submission.id))
    setIsProcessing(false)
  }

  // ─── Reject submission (Req 9.9, 9.10) ──────────────────────────────────────

  async function handleRejectSubmission(submission: SubmissionItem) {
    if (!user) return
    if (!isValidFeedback(feedback)) {
      setFeedbackError('Feedback must be at least 10 characters.')
      return
    }

    setIsProcessing(true)
    setFeedbackError(null)

    const newStatus = getSubmissionStatus(
      submission.attempt_number,
      submission.max_attempts,
      'reject'
    )

    const canResubmitAgain = canResubmit(submission.attempt_number, submission.max_attempts)

    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        status: newStatus,
        reviewer_id: user.id,
        reviewer_feedback: feedback.trim(),
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submission.id)

    if (updateError) {
      setActionMessage('Failed to reject submission.')
      setIsProcessing(false)
      return
    }

    // Send notification to user (Req 16.3)
    const notifBody = canResubmitAgain
      ? `Your submission for "${submission.challenge_title}" was rejected. Feedback: ${feedback.trim()}. You may resubmit.`
      : `Your submission for "${submission.challenge_title}" has been marked as failed (max attempts reached). Feedback: ${feedback.trim()}`

    await supabase.from('notifications').insert({
      user_id: submission.user_id,
      title: canResubmitAgain ? 'Submission Rejected' : 'Submission Failed',
      body: notifBody,
      type: 'submission_status',
      reference_id: submission.id,
    })

    setActionMessage(
      canResubmitAgain
        ? `Rejected submission. User can resubmit (attempt ${submission.attempt_number}/${submission.max_attempts}).`
        : `Submission marked as failed (max attempts reached).`
    )
    setSubmissions((prev) => prev.filter((s) => s.id !== submission.id))
    setRejectingId(null)
    setRejectingType(null)
    setFeedback('')
    setIsProcessing(false)
  }

  // ─── Approve service log (Req 10.4) ────────────────────────────────────────

  async function handleApproveServiceLog(log: ServiceLogItem) {
    if (!user) return
    setIsProcessing(true)
    setActionMessage(null)

    const newStatus = getServiceLogStatus(
      log.attempt_number,
      log.max_attempts,
      'approve'
    )

    const { error: updateError } = await supabase
      .from('service_logs')
      .update({
        status: newStatus,
        verifier_id: user.id,
        verified_at: new Date().toISOString(),
      })
      .eq('id', log.id)

    if (updateError) {
      setActionMessage('Failed to verify service log.')
      setIsProcessing(false)
      return
    }

    // Award points: 10 per hour (Req 10.4) using design Property 15 formula
    const pointsToAward = calculateServicePoints(log.duration_hours)

    await supabase.from('points_ledger').insert({
      user_id: log.user_id,
      amount: pointsToAward,
      reason: 'service_hours',
      reference_id: log.id,
    })

    // Update user's total_points and total_service_hours
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_points, total_service_hours')
      .eq('id', log.user_id)
      .single()

    if (profile) {
      await supabase
        .from('profiles')
        .update({
          total_points: profile.total_points + pointsToAward,
          total_service_hours: Number(profile.total_service_hours) + log.duration_hours,
        })
        .eq('id', log.user_id)
    }

    // Send notification (Req 16.3)
    await supabase.from('notifications').insert({
      user_id: log.user_id,
      title: 'Service Log Verified',
      body: `Your service log for "${log.mission_name}" (${log.duration_hours}h) has been verified! You earned ${pointsToAward} points.`,
      type: 'submission_status',
      reference_id: log.id,
    })

    setActionMessage(`Verified service log for "${log.mission_name}".`)
    setServiceLogs((prev) => prev.filter((l) => l.id !== log.id))
    setIsProcessing(false)
  }

  // ─── Reject service log (Req 10.5, 10.6) ───────────────────────────────────

  async function handleRejectServiceLog(log: ServiceLogItem) {
    if (!user) return
    if (!isValidFeedback(feedback)) {
      setFeedbackError('Reason must be at least 10 characters.')
      return
    }

    setIsProcessing(true)
    setFeedbackError(null)

    const newStatus = getServiceLogStatus(
      log.attempt_number,
      log.max_attempts,
      'reject'
    )

    const canResubmitAgain = canResubmit(log.attempt_number, log.max_attempts)

    const { error: updateError } = await supabase
      .from('service_logs')
      .update({
        status: newStatus,
        verifier_id: user.id,
        rejection_reason: feedback.trim(),
        verified_at: new Date().toISOString(),
      })
      .eq('id', log.id)

    if (updateError) {
      setActionMessage('Failed to reject service log.')
      setIsProcessing(false)
      return
    }

    // Send notification (Req 16.3)
    const notifBody = canResubmitAgain
      ? `Your service log for "${log.mission_name}" was rejected. Reason: ${feedback.trim()}. You may resubmit.`
      : `Your service log for "${log.mission_name}" has been permanently rejected (max attempts reached). Reason: ${feedback.trim()}`

    await supabase.from('notifications').insert({
      user_id: log.user_id,
      title: canResubmitAgain ? 'Service Log Rejected' : 'Service Log Permanently Rejected',
      body: notifBody,
      type: 'submission_status',
      reference_id: log.id,
    })

    setActionMessage(
      canResubmitAgain
        ? `Rejected service log. User can resubmit (attempt ${log.attempt_number}/${log.max_attempts}).`
        : `Service log permanently rejected (max attempts reached).`
    )
    setServiceLogs((prev) => prev.filter((l) => l.id !== log.id))
    setRejectingId(null)
    setRejectingType(null)
    setFeedback('')
    setIsProcessing(false)
  }

  // ─── Access check ──────────────────────────────────────────────────────────

  if (!user || !['Rover_Scout', 'Adult_Leader', 'Council_Admin'].includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">Access denied. You don't have permission to view the review queue.</p>
          <Link to="/app/passport" className="text-primary hover:underline text-sm">
            Back to Passport
          </Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading review queue...</p>
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
            <h1 className="text-2xl font-bold text-foreground">Review Queue</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {reviewerRole === 'Adult_Leader' && 'Showing items from your troop only'}
              {reviewerRole === 'Rover_Scout' && 'Showing submissions from Cub Scouts and Boy Scouts'}
              {reviewerRole === 'Council_Admin' && 'Showing all pending items'}
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

        {error && (
          <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'submissions'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Submissions ({submissions.length})
          </button>
          {reviewerRole !== 'Rover_Scout' && (
            <button
              onClick={() => setActiveTab('service_logs')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'service_logs'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Service Logs ({serviceLogs.length})
            </button>
          )}
        </div>

        {/* Submissions list */}
        {activeTab === 'submissions' && (
          <div className="space-y-4">
            {submissions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No pending submissions to review.</p>
              </div>
            ) : (
              submissions.map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
                  onApprove={() => handleApproveSubmission(submission)}
                  onReject={() => {
                    setRejectingId(submission.id)
                    setRejectingType('submission')
                    setFeedback('')
                    setFeedbackError(null)
                  }}
                  isProcessing={isProcessing}
                />
              ))
            )}
          </div>
        )}

        {/* Service Logs list */}
        {activeTab === 'service_logs' && reviewerRole !== 'Rover_Scout' && (
          <div className="space-y-4">
            {serviceLogs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No pending service logs to review.</p>
              </div>
            ) : (
              serviceLogs.map((log) => (
                <ServiceLogCard
                  key={log.id}
                  log={log}
                  onApprove={() => handleApproveServiceLog(log)}
                  onReject={() => {
                    setRejectingId(log.id)
                    setRejectingType('service_log')
                    setFeedback('')
                    setFeedbackError(null)
                  }}
                  isProcessing={isProcessing}
                />
              ))
            )}
          </div>
        )}

        {/* Reject feedback modal */}
        {rejectingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                {rejectingType === 'submission' ? 'Reject Submission' : 'Reject Service Log'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Please provide feedback explaining why this item is being rejected (minimum 10 characters).
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                placeholder="Enter feedback or reason for rejection..."
              />
              {feedbackError && (
                <p className="text-sm text-destructive">{feedbackError}</p>
              )}
              <p className="text-xs text-muted-foreground text-right">
                {feedback.trim().length}/10 minimum characters
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setRejectingId(null)
                    setRejectingType(null)
                    setFeedback('')
                    setFeedbackError(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (rejectingType === 'submission') {
                      const item = submissions.find((s) => s.id === rejectingId)
                      if (item) handleRejectSubmission(item)
                    } else {
                      const item = serviceLogs.find((l) => l.id === rejectingId)
                      if (item) handleRejectServiceLog(item)
                    }
                  }}
                  disabled={isProcessing || feedback.trim().length < 10}
                  className="px-4 py-2 text-sm font-semibold bg-destructive text-white rounded-lg hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface SubmissionCardProps {
  submission: SubmissionItem
  onApprove: () => void
  onReject: () => void
  isProcessing: boolean
}

function SubmissionCard({ submission, onApprove, onReject, isProcessing }: SubmissionCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-foreground">{submission.challenge_title}</h3>
          <p className="text-sm text-muted-foreground">
            by {submission.user_name} ({submission.user_role.replace('_', ' ')})
            {submission.user_troop && ` • Troop ${submission.user_troop}`}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
            {submission.challenge_points} pts
          </span>
        </div>
      </div>

      <div className="text-sm text-muted-foreground space-y-1">
        <p>Attempt {submission.attempt_number} of {submission.max_attempts}</p>
        <p>Submitted: {new Date(submission.created_at).toLocaleDateString()}</p>
        {submission.photo_url && (
          <a
            href={submission.photo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-block"
          >
            View attached photo
          </a>
        )}
        {submission.response_json && (
          <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
            <p className="font-medium mb-1">Response:</p>
            <p>{formatResponse(submission.response_json)}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <button
          onClick={onApprove}
          disabled={isProcessing}
          className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Approve
        </button>
        <button
          onClick={onReject}
          disabled={isProcessing}
          className="px-4 py-2 text-sm font-semibold bg-destructive text-white rounded-lg hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  )
}

interface ServiceLogCardProps {
  log: ServiceLogItem
  onApprove: () => void
  onReject: () => void
  isProcessing: boolean
}

function ServiceLogCard({ log, onApprove, onReject, isProcessing }: ServiceLogCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-foreground">{log.mission_name}</h3>
          <p className="text-sm text-muted-foreground">
            by {log.user_name} ({log.user_role.replace('_', ' ')})
            {log.user_troop && ` • Troop ${log.user_troop}`}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
            {log.duration_hours}h
          </span>
        </div>
      </div>

      <div className="text-sm text-muted-foreground space-y-1">
        <p>Attempt {log.attempt_number} of {log.max_attempts}</p>
        <p>Date performed: {new Date(log.date_performed).toLocaleDateString()}</p>
        <p>Submitted: {new Date(log.created_at).toLocaleDateString()}</p>
        <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
          <p className="font-medium mb-1">Description:</p>
          <p>{log.description}</p>
        </div>

        {log.photo_url && (
          <a
            href={log.photo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-block"
          >
            View photo proof
          </a>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <button
          onClick={onApprove}
          disabled={isProcessing}
          className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Verify
        </button>
        <button
          onClick={onReject}
          disabled={isProcessing}
          className="px-4 py-2 text-sm font-semibold bg-destructive text-white rounded-lg hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Reject
        </button>
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
    return `Answers: ${Object.entries(answers).map(([q, a]) => `Q${Number(q) + 1}→${a}`).join(', ')}`
  }
  return JSON.stringify(json)
}
