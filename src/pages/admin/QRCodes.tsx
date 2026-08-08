/**
 * Admin QR Codes management page.
 *
 * Allows Council_Admin to generate, regenerate, and download QR codes
 * for heritage sites. Shows QR status for each site and handles
 * deactivated sites (invalid QR, "site inactive" on scan).
 *
 * Validates: Requirements 23.1, 23.2, 23.3, 23.4, 23.5
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────

interface HeritageSiteQR {
  id: string
  name: string
  is_active: boolean
  qr_code_payload: string | null
  qr_code_image_url: string | null
  trail_name?: string
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminQRCodes() {
  const { user } = useAuthStore()
  const [sites, setSites] = useState<HeritageSiteQR[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // ─── Fetch sites ───────────────────────────────────────────────────────────

  const fetchSites = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('heritage_sites')
      .select(`
        id,
        name,
        is_active,
        qr_code_payload,
        qr_code_image_url,
        trails ( name )
      `)
      .order('name', { ascending: true })

    if (fetchError) {
      setError('Failed to load heritage sites.')
      return
    }

    const mapped: HeritageSiteQR[] = (data || []).map((site: Record<string, unknown>) => ({
      id: site.id as string,
      name: site.name as string,
      is_active: site.is_active as boolean,
      qr_code_payload: site.qr_code_payload as string | null,
      qr_code_image_url: site.qr_code_image_url as string | null,
      trail_name: (site.trails as { name: string } | null)?.name || undefined,
    }))

    setSites(mapped)
  }, [])

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      await fetchSites()
      setIsLoading(false)
    }
    load()
  }, [fetchSites])

  // ─── Generate QR code ──────────────────────────────────────────────────────

  async function handleGenerateQR(siteId: string) {
    setProcessingId(siteId)
    setActionMessage(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await supabase.functions.invoke('generate-qr-code', {
        body: { site_id: siteId },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      if (response.error) {
        const errorData = response.error
        setActionMessage({
          type: 'error',
          text: `QR generation failed: ${errorData.message || 'Unknown error occurred'}`,
        })
        return
      }

      const result = response.data
      if (result?.success) {
        setActionMessage({
          type: 'success',
          text: `QR code generated for "${result.site_name}".`,
        })
        await fetchSites()
      } else {
        setActionMessage({
          type: 'error',
          text: result?.message || 'QR code generation failed.',
        })
      }
    } catch {
      setActionMessage({
        type: 'error',
        text: 'An unexpected error occurred during QR code generation.',
      })
    } finally {
      setProcessingId(null)
    }
  }

  // ─── Regenerate QR code ────────────────────────────────────────────────────

  async function handleRegenerateQR(siteId: string, siteName: string) {
    const confirmed = window.confirm(
      `Regenerate QR code for "${siteName}"?\n\nThis will invalidate the current QR code. Any printed copies will no longer work.`
    )
    if (!confirmed) return

    setProcessingId(siteId)
    setActionMessage(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await supabase.functions.invoke('regenerate-qr-code', {
        body: { site_id: siteId },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      if (response.error) {
        const errorData = response.error
        setActionMessage({
          type: 'error',
          text: `QR regeneration failed: ${errorData.message || 'Unknown error occurred'}`,
        })
        return
      }

      const result = response.data
      if (result?.success) {
        setActionMessage({
          type: 'success',
          text: `QR code regenerated for "${result.site_name}". Previous QR code has been invalidated.`,
        })
        await fetchSites()
      } else {
        setActionMessage({
          type: 'error',
          text: result?.message || 'QR code regeneration failed.',
        })
      }
    } catch {
      setActionMessage({
        type: 'error',
        text: 'An unexpected error occurred during QR code regeneration.',
      })
    } finally {
      setProcessingId(null)
    }
  }

  // ─── Download QR code ──────────────────────────────────────────────────────

  function handleDownloadQR(site: HeritageSiteQR) {
    if (!site.qr_code_image_url) return

    // Create a temporary anchor to trigger download
    const link = document.createElement('a')
    link.href = site.qr_code_image_url
    link.download = `qr-code-${site.name.toLowerCase().replace(/\s+/g, '-')}.svg`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ─── Get QR status label ───────────────────────────────────────────────────

  function getQRStatus(site: HeritageSiteQR): {
    label: string
    color: string
  } {
    if (!site.is_active) {
      return { label: 'Inactive (QR Invalid)', color: 'text-red-600 bg-red-50 border-red-200' }
    }
    if (site.qr_code_payload) {
      return { label: 'QR Active', color: 'text-green-600 bg-green-50 border-green-200' }
    }
    return { label: 'No QR Code', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' }
  }

  // ─── Access check ──────────────────────────────────────────────────────────

  if (!user || user.role !== 'Council_Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">
            Access denied. Only Council Admins can manage QR codes.
          </p>
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
        <p className="text-muted-foreground">Loading heritage sites...</p>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const activeSites = sites.filter((s) => s.is_active)
  const inactiveSites = sites.filter((s) => !s.is_active)
  const sitesWithQR = sites.filter((s) => s.qr_code_payload && s.is_active)
  const sitesWithoutQR = activeSites.filter((s) => !s.qr_code_payload)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header>
          <h1 className="text-2xl font-bold text-foreground">QR Code Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate, regenerate, and download QR codes for heritage sites.
          </p>
        </header>

        {/* Stats summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{sites.length}</p>
            <p className="text-xs text-muted-foreground">Total Sites</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{sitesWithQR.length}</p>
            <p className="text-xs text-muted-foreground">With QR Code</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{sitesWithoutQR.length}</p>
            <p className="text-xs text-muted-foreground">Without QR Code</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{inactiveSites.length}</p>
            <p className="text-xs text-muted-foreground">Inactive Sites</p>
          </div>
        </div>

        {/* Action message */}
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

        {error && (
          <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
            {error}
          </div>
        )}

        {/* Sites list */}
        {sites.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No heritage sites found. Add sites first before generating QR codes.
            </p>
            <Link to="/admin/sites" className="text-primary hover:underline text-sm mt-2 inline-block">
              Go to Site Management
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sites.map((site) => {
              const status = getQRStatus(site)
              const isProcessing = processingId === site.id

              return (
                <div
                  key={site.id}
                  className={`rounded-lg border bg-card p-4 ${
                    !site.is_active ? 'border-red-200 opacity-75' : 'border-border'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Site info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground truncate">{site.name}</h3>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      {site.trail_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Trail: {site.trail_name}
                        </p>
                      )}
                      {!site.is_active && (
                        <p className="text-xs text-red-600 mt-1">
                          Site is deactivated. QR code scanning returns &ldquo;site inactive&rdquo; message.
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {site.is_active && !site.qr_code_payload && (
                        <Button
                          size="sm"
                          onClick={() => handleGenerateQR(site.id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? 'Generating...' : 'Generate QR'}
                        </Button>
                      )}

                      {site.is_active && site.qr_code_payload && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadQR(site)}
                            disabled={isProcessing || !site.qr_code_image_url}
                            aria-label={`Download QR code for ${site.name}`}
                          >
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRegenerateQR(site.id, site.name)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? 'Regenerating...' : 'Regenerate'}
                          </Button>
                        </>
                      )}

                      {!site.is_active && site.qr_code_payload && (
                        <span className="text-xs text-red-600 italic">
                          QR invalidated
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
