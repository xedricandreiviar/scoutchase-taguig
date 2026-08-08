import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'

interface ReferralData {
  id: string
  referral_code: string
  referred_user_id: string | null
  created_at: string
  redeemed_at: string | null
  expires_at: string
}

/**
 * Referral page — authenticated users can generate and manage their
 * "Bring-a-Friend" referral links. Each link has a unique code with
 * 90-day expiry. New users who register through the link get attributed
 * to the referrer.
 *
 * Validates: Requirements 12.3, 12.4
 */
export default function Referral() {
  const { user } = useAuthStore()
  const [referrals, setReferrals] = useState<ReferralData[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadReferrals = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('referrals')
        .select('id, referral_code, referred_user_id, created_at, redeemed_at, expires_at')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw new Error(fetchError.message)
      setReferrals(data ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load referrals.'
      )
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadReferrals()
  }, [loadReferrals])

  /**
   * Generate a new referral link with a unique code and 90-day expiry.
   * Uses crypto.randomUUID() for unique code generation.
   */
  async function handleGenerateLink() {
    if (!user) return
    setGenerating(true)
    setError(null)

    try {
      const referralCode = crypto.randomUUID()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 90) // 90-day expiry

      const { error: insertError } = await supabase
        .from('referrals')
        .insert({
          referrer_id: user.id,
          referral_code: referralCode,
          expires_at: expiresAt.toISOString(),
        })

      if (insertError) throw new Error(insertError.message)

      // Reload referrals list
      await loadReferrals()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate referral link.'
      )
    } finally {
      setGenerating(false)
    }
  }

  /**
   * Copy referral link to clipboard.
   */
  async function handleCopyLink(code: string) {
    const link = `${window.location.origin}/join-scouting?ref=${code}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = link
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function getReferralLink(code: string): string {
    return `${window.location.origin}/join-scouting?ref=${code}`
  }

  function isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date()
  }

  // Stats
  const totalReferrals = referrals.length
  const successfulReferrals = referrals.filter((r) => r.redeemed_at !== null).length
  const activeLinks = referrals.filter(
    (r) => !isExpired(r.expires_at) && r.redeemed_at === null
  ).length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading referral data...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-primary">
            Bring-a-Friend Referral
          </h1>
          <p className="text-muted-foreground">
            Share your unique referral link to invite friends to ScoutChase.
            When they register through your link within 90 days, the referral
            is attributed to you.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalReferrals}</p>
            <p className="text-xs text-muted-foreground">Links Generated</p>
          </div>
          <div className="bg-card rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-primary">{successfulReferrals}</p>
            <p className="text-xs text-muted-foreground">Successful Referrals</p>
          </div>
          <div className="bg-card rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-primary">{activeLinks}</p>
            <p className="text-xs text-muted-foreground">Active Links</p>
          </div>
        </div>

        {/* Generate New Link */}
        <div className="bg-card rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Generate a New Referral Link
          </h2>
          <p className="text-sm text-muted-foreground">
            Each link is valid for 90 days and can be used by one new user to register.
          </p>
          <Button
            onClick={handleGenerateLink}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate New Link'}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3" role="alert">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Referral Links List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Your Referral Links
          </h2>
          {referrals.length === 0 ? (
            <div className="bg-card rounded-lg border p-8 text-center">
              <p className="text-muted-foreground">
                You haven't generated any referral links yet. Create one above to start inviting friends!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {referrals.map((referral) => {
                const expired = isExpired(referral.expires_at)
                const redeemed = referral.redeemed_at !== null

                return (
                  <div
                    key={referral.id}
                    className="bg-card rounded-lg border p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-muted-foreground truncate">
                          {getReferralLink(referral.referral_code)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {redeemed && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                            Redeemed
                          </span>
                        )}
                        {expired && !redeemed && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                            Expired
                          </span>
                        )}
                        {!expired && !redeemed && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Created: {new Date(referral.created_at).toLocaleDateString()}
                      </span>
                      <span>
                        Expires: {new Date(referral.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                    {!expired && !redeemed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyLink(referral.referral_code)}
                        className="w-full"
                      >
                        {copied ? '✓ Copied!' : 'Copy Link'}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
