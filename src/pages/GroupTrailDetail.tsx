import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { calculateGroupProgress, getMemberUnlockCount } from '@/lib/trails/group-progress'
import { validateGroupSize } from '@/lib/validators/group-trail'

interface GroupAttemptDetail {
  id: string
  trail_id: string
  leader_id: string
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
  completed_at: string | null
  trail_name: string
  trail_theme: string
  total_sites: number
}

interface GroupMember {
  id: string
  user_id: string
  display_name: string | null
  full_name: string
  invitation_status: 'pending' | 'accepted' | 'declined' | 'expired'
  invited_at: string
  responded_at: string | null
  unlocked_sites: string[]
}

/**
 * Group Trail Detail page.
 * Shows group details, member unlock counts, group progress,
 * invitation management, and group actions.
 *
 * Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5, 17.6
 */
export default function GroupTrailDetail() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [attempt, setAttempt] = useState<GroupAttemptDetail | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)

  const isLeader = attempt?.leader_id === user?.id
  const isActive = attempt?.status === 'active'

  const loadAttemptDetails = useCallback(async () => {
    if (!attemptId || !user?.id) return

    setLoading(true)
    setError(null)

    try {
      // Fetch attempt details
      const { data: attemptData, error: attemptError } = await supabase
        .from('group_trail_attempts')
        .select(`
          id,
          trail_id,
          leader_id,
          status,
          created_at,
          completed_at,
          trails ( name, theme, site_count )
        `)
        .eq('id', attemptId)
        .single()

      if (attemptError) throw new Error(attemptError.message)
      if (!attemptData) throw new Error('Group trail attempt not found.')

      const trail = attemptData.trails as unknown as {
        name: string
        theme: string
        site_count: number
      } | null

      setAttempt({
        id: attemptData.id,
        trail_id: attemptData.trail_id,
        leader_id: attemptData.leader_id,
        status: attemptData.status,
        created_at: attemptData.created_at,
        completed_at: attemptData.completed_at,
        trail_name: trail?.name ?? 'Unknown Trail',
        trail_theme: trail?.theme ?? '',
        total_sites: trail?.site_count ?? 0,
      })

      // Fetch members with their profile info
      const { data: memberData, error: memberError } = await supabase
        .from('group_trail_members')
        .select(`
          id,
          user_id,
          invitation_status,
          invited_at,
          responded_at,
          profiles ( display_name, full_name )
        `)
        .eq('attempt_id', attemptId)

      if (memberError) throw new Error(memberError.message)

      // For accepted members, fetch their QR scan data for this trail's sites
      const { data: trailSites } = await supabase
        .from('heritage_sites')
        .select('id')
        .eq('trail_id', attemptData.trail_id)

      const trailSiteIds = (trailSites ?? []).map((s) => s.id)

      const membersWithUnlocks: GroupMember[] = await Promise.all(
        (memberData ?? []).map(async (m) => {
          const profile = m.profiles as unknown as {
            display_name: string | null
            full_name: string
          } | null

          let unlocked_sites: string[] = []

          if (m.invitation_status === 'accepted' && trailSiteIds.length > 0) {
            const { data: scans } = await supabase
              .from('qr_scans')
              .select('heritage_site_id')
              .eq('user_id', m.user_id)
              .in('heritage_site_id', trailSiteIds)

            unlocked_sites = (scans ?? []).map((s) => s.heritage_site_id)
          }

          return {
            id: m.id,
            user_id: m.user_id,
            display_name: profile?.display_name ?? null,
            full_name: profile?.full_name ?? 'Unknown User',
            invitation_status: m.invitation_status,
            invited_at: m.invited_at,
            responded_at: m.responded_at,
            unlocked_sites,
          }
        })
      )

      // Also include the leader's unlocks
      if (trailSiteIds.length > 0) {
        const { data: leaderScans } = await supabase
          .from('qr_scans')
          .select('heritage_site_id')
          .eq('user_id', attemptData.leader_id)
          .in('heritage_site_id', trailSiteIds)

        const leaderUnlocks = (leaderScans ?? []).map((s) => s.heritage_site_id)

        // Get leader profile
        const { data: leaderProfile } = await supabase
          .from('profiles')
          .select('display_name, full_name')
          .eq('id', attemptData.leader_id)
          .single()

        // Insert leader as first member entry
        membersWithUnlocks.unshift({
          id: 'leader',
          user_id: attemptData.leader_id,
          display_name: leaderProfile?.display_name ?? null,
          full_name: leaderProfile?.full_name ?? 'Leader',
          invitation_status: 'accepted',
          invited_at: attemptData.created_at,
          responded_at: attemptData.created_at,
          unlocked_sites: leaderUnlocks,
        })
      }

      setMembers(membersWithUnlocks)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load group trail details.'
      )
    } finally {
      setLoading(false)
    }
  }, [attemptId, user?.id])

  useEffect(() => {
    loadAttemptDetails()
  }, [loadAttemptDetails])

  // Check invitation expiry (72 hours)
  useEffect(() => {
    if (!isLeader || !isActive) return

    const checkExpiry = async () => {
      const now = new Date()
      const pendingMembers = members.filter(
        (m) => m.invitation_status === 'pending'
      )

      for (const member of pendingMembers) {
        const invitedAt = new Date(member.invited_at)
        const hoursDiff =
          (now.getTime() - invitedAt.getTime()) / (1000 * 60 * 60)

        if (hoursDiff >= 72) {
          // Mark as expired
          await supabase
            .from('group_trail_members')
            .update({ invitation_status: 'expired', responded_at: now.toISOString() })
            .eq('id', member.id)
        }
      }
    }

    checkExpiry()
  }, [members, isLeader, isActive])

  // Calculate group progress
  const acceptedMembers = members.filter(
    (m) => m.invitation_status === 'accepted'
  )
  const memberUnlocks = acceptedMembers.map((m) => m.unlocked_sites)
  const groupProgress = calculateGroupProgress(
    memberUnlocks,
    attempt?.total_sites ?? 0
  )

  // Check group completion (Req 17.5)
  useEffect(() => {
    if (!attempt || !isActive || !groupProgress.isComplete) return

    const markComplete = async () => {
      await supabase
        .from('group_trail_attempts')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', attempt.id)

      // Notify all members
      for (const member of acceptedMembers) {
        await supabase.from('notifications').insert({
          user_id: member.user_id,
          title: 'Group Trail Completed!',
          body: `Your group has completed the "${attempt.trail_name}" trail. All heritage sites have been unlocked!`,
          type: 'trail_launch',
          reference_id: attempt.id,
        })
      }

      loadAttemptDetails()
    }

    markComplete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupProgress.isComplete])

  // Handle invitation acceptance/decline (Req 17.2)
  const handleInvitationResponse = async (accept: boolean) => {
    if (!attemptId || !user?.id) return

    setActionLoading(true)
    try {
      await supabase
        .from('group_trail_members')
        .update({
          invitation_status: accept ? 'accepted' : 'declined',
          responded_at: new Date().toISOString(),
        })
        .eq('attempt_id', attemptId)
        .eq('user_id', user.id)

      // Notify leader if declined (Req 17.3)
      if (!accept && attempt) {
        await supabase.from('notifications').insert({
          user_id: attempt.leader_id,
          title: 'Invitation Declined',
          body: `${user.display_name ?? user.full_name} declined the invitation to join "${attempt.trail_name}" group trail.`,
          type: 'trail_launch',
          reference_id: attemptId,
        })
      }

      loadAttemptDetails()
    } catch {
      setError('Failed to respond to invitation.')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle leader leaving (Req 17.6)
  const handleLeaderLeave = async () => {
    if (!attempt || !isLeader) return

    setActionLoading(true)
    try {
      // Cancel the attempt
      await supabase
        .from('group_trail_attempts')
        .update({ status: 'cancelled' })
        .eq('id', attempt.id)

      // Notify all members
      for (const member of acceptedMembers) {
        if (member.user_id !== user?.id) {
          await supabase.from('notifications').insert({
            user_id: member.user_id,
            title: 'Group Trail Cancelled',
            body: `The group trail attempt for "${attempt.trail_name}" has been cancelled because the leader left.`,
            type: 'trail_launch',
            reference_id: attempt.id,
          })
        }
      }

      navigate('/app/group-trails')
    } catch {
      setError('Failed to cancel group trail attempt.')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle inviting new members (Req 17.1)
  const handleInvite = async () => {
    if (!attempt || !isLeader || !inviteEmail.trim()) return

    setInviteError(null)

    // Validate group size
    const currentInvitees = members.filter(
      (m) => m.id !== 'leader'
    ).length
    const validation = validateGroupSize(currentInvitees + 1)
    if (!validation.valid) {
      setInviteError(validation.error ?? 'Cannot add more members.')
      return
    }

    setActionLoading(true)
    try {
      // Find user by email (from auth metadata or profile lookup)
      const { data: targetProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .ilike('full_name', inviteEmail.trim())
        .limit(1)
        .single()

      if (profileError || !targetProfile) {
        setInviteError('User not found. Please enter a valid user name.')
        setActionLoading(false)
        return
      }

      // Check if already invited
      const existingMember = members.find(
        (m) => m.user_id === targetProfile.id
      )
      if (existingMember) {
        setInviteError('This user has already been invited.')
        setActionLoading(false)
        return
      }

      // Create invitation
      await supabase.from('group_trail_members').insert({
        attempt_id: attempt.id,
        user_id: targetProfile.id,
        invitation_status: 'pending',
        invited_at: new Date().toISOString(),
      })

      // Send notification to invited user
      await supabase.from('notifications').insert({
        user_id: targetProfile.id,
        title: 'Group Trail Invitation',
        body: `You have been invited to join a group trail attempt for "${attempt.trail_name}". Accept or decline within 72 hours.`,
        type: 'trail_launch',
        reference_id: attempt.id,
      })

      setInviteEmail('')
      loadAttemptDetails()
    } catch {
      setInviteError('Failed to send invitation.')
    } finally {
      setActionLoading(false)
    }
  }

  // Check if current user has a pending invitation
  const userMembership = members.find(
    (m) => m.user_id === user?.id && m.id !== 'leader'
  )
  const hasPendingInvitation = userMembership?.invitation_status === 'pending'

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center space-y-4">
          <div className="text-destructive text-4xl" aria-hidden="true">⚠️</div>
          <h2 className="text-lg font-semibold text-foreground">Error</h2>
          <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          <button
            onClick={loadAttemptDetails}
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
        <p className="text-muted-foreground">Loading group trail details...</p>
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Group trail attempt not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <button
            onClick={() => navigate('/app/group-trails')}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            ← Back to Group Trails
          </button>
          <h1 className="text-3xl font-bold text-primary">
            {attempt.trail_name}
          </h1>
          <div className="flex items-center gap-2">
            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {attempt.trail_theme}
            </span>
            <span
              className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
                attempt.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : attempt.status === 'completed'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {attempt.status === 'active'
                ? 'Active'
                : attempt.status === 'completed'
                  ? 'Completed'
                  : 'Cancelled'}
            </span>
          </div>
        </div>

        {/* Pending Invitation Banner (Req 17.2) */}
        {hasPendingInvitation && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800 font-medium mb-3">
              You have been invited to join this group trail attempt.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleInvitationResponse(true)}
                disabled={actionLoading}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => handleInvitationResponse(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-muted text-foreground rounded-md font-medium text-sm hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Group Progress (Req 17.4) */}
        <div className="bg-card rounded-lg border p-5 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Group Progress
          </h2>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {groupProgress.uniqueSitesUnlocked} of {attempt.total_sites} sites unlocked by group
            </span>
            <span className="text-lg font-bold text-primary">
              {groupProgress.progress}%
            </span>
          </div>
          <div
            className="h-3 w-full rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={groupProgress.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Group progress: ${groupProgress.progress}%`}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${groupProgress.progress}%` }}
            />
          </div>
          {groupProgress.isComplete && (
            <p className="text-sm text-green-700 font-medium">
              🎉 All trail sites have been unlocked by the group!
            </p>
          )}
        </div>

        {/* Members Section (Req 17.4) */}
        <div className="bg-card rounded-lg border p-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Members ({acceptedMembers.length})
          </h2>

          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-md"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {member.display_name ?? member.full_name}
                    {member.user_id === attempt.leader_id && (
                      <span className="ml-2 text-xs text-primary font-normal">
                        (Leader)
                      </span>
                    )}
                  </p>
                  {member.invitation_status !== 'accepted' && (
                    <p className="text-xs text-muted-foreground capitalize">
                      {member.invitation_status}
                    </p>
                  )}
                </div>

                {member.invitation_status === 'accepted' && (
                  <div className="text-right">
                    <span className="text-sm font-semibold text-primary">
                      {getMemberUnlockCount(member.unlocked_sites)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      / {attempt.total_sites} sites
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Invite Members (Req 17.1 - Senior Scout only, active attempt) */}
        {isLeader && isActive && (
          <div className="bg-card rounded-lg border p-5 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Invite Members
            </h2>
            <p className="text-sm text-muted-foreground">
              Invite users to join this group trail attempt. Maximum group size is 10 (including you).
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter user's name"
                className="flex-1 px-3 py-2 border rounded-md text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={handleInvite}
                disabled={actionLoading || !inviteEmail.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Invite
              </button>
            </div>
            {inviteError && (
              <p className="text-sm text-destructive">{inviteError}</p>
            )}
          </div>
        )}

        {/* Leader Actions (Req 17.6) */}
        {isLeader && isActive && (
          <div className="bg-card rounded-lg border border-destructive/20 p-5 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Leader Actions
            </h2>
            <p className="text-sm text-muted-foreground">
              Leaving the group will cancel the attempt and notify all members.
            </p>
            <button
              onClick={handleLeaderLeave}
              disabled={actionLoading}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md font-medium text-sm hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              Leave & Cancel Group Attempt
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
