/**
 * Admin Analytics Dashboard page.
 *
 * Displays platform metrics for Council_Admin users:
 * - Total participants by role
 * - Active heritage sites
 * - QR scans with daily/weekly trends
 * - Completed challenges
 * - Pending review items
 * - Verified service hours
 * - New sign-ups (weekly/cumulative)
 * - Retention rate (30-day active/total)
 * - Partner count
 * - Satisfaction rating
 *
 * Features:
 * - Date range filter (up to 365 days) with recalculation within 10 seconds (Req 15.2)
 * - CSV export (download within 10 seconds) (Req 15.3)
 * - Auto-refresh every 60 seconds (Req 15.4)
 * - Partial error handling (Req 15.5)
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DailyScan {
  scan_date: string
  scan_count: number
}

interface WeeklyScan {
  week_start: string
  scan_count: number
}

interface WeeklySignup {
  week_start: string
  signup_count: number
}

interface AnalyticsSummary {
  total_participants: number
  participants_by_role: Record<string, number>
  active_sites: number
  total_qr_scans: number
  daily_scans: DailyScan[]
  weekly_scans: WeeklyScan[]
  completed_challenges: number
  pending_reviews: number
  verified_service_hours: number
  weekly_signups: WeeklySignup[]
  cumulative_signups: number
  retention_rate: number
  partner_count: number
  satisfaction_rating: number
}

type MetricStatus = 'loading' | 'loaded' | 'error'

interface MetricState {
  data: AnalyticsSummary | null
  status: MetricStatus
  errorMessage: string | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AUTO_REFRESH_INTERVAL_MS = 60_000 // 60 seconds (Req 15.4)
const MAX_DATE_RANGE_DAYS = 365

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return formatDate(d)
}

// ─── Stat Card Component ─────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  status,
  errorMessage,
}: {
  title: string
  value: string | number
  subtitle?: string
  status: MetricStatus
  errorMessage?: string | null
}) {
  if (status === 'error') {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4" role="alert">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-destructive mt-1">
          {errorMessage || 'Failed to load this metric'}
        </p>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="rounded-lg border border-border bg-card p-4 animate-pulse">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="h-8 bg-muted rounded mt-1 w-16" />
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  )
}

// ─── Trend Chart (Simple Bar) ────────────────────────────────────────────────

function SimpleTrend({
  title,
  data,
  labelKey,
  valueKey,
}: {
  title: string
  data: Array<Record<string, unknown>>
  labelKey: string
  valueKey: string
}) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
        <p className="text-xs text-muted-foreground">No data available</p>
      </div>
    )
  }

  const maxValue = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-muted-foreground mb-3">{title}</p>
      <div className="space-y-1">
        {data.slice(-10).map((entry, idx) => {
          const value = Number(entry[valueKey]) || 0
          const label = String(entry[labelKey])
          const pct = (value / maxValue) * 100
          return (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <span className="w-20 text-muted-foreground truncate">{label}</span>
              <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-bsp-green rounded"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-right text-foreground font-medium">{value}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user } = useAuthStore()

  // Date range state
  const [startDate, setStartDate] = useState(getDaysAgo(30))
  const [endDate, setEndDate] = useState(formatDate(new Date()))

  // Metrics state with partial error handling (Req 15.5)
  const [metrics, setMetrics] = useState<MetricState>({
    data: null,
    status: 'loading',
    errorMessage: null,
  })

  // Export state
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Auto-refresh timer ref
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Fetch analytics data ──────────────────────────────────────────────────

  const fetchAnalytics = useCallback(async () => {
    setMetrics((prev) => ({ ...prev, status: 'loading', errorMessage: null }))

    try {
      const { data, error } = await supabase.rpc('get_analytics_summary', {
        p_start_date: startDate,
        p_end_date: endDate,
      })

      if (error) {
        setMetrics({
          data: null,
          status: 'error',
          errorMessage: error.message || 'Failed to fetch analytics data',
        })
        return
      }

      setMetrics({
        data: data as AnalyticsSummary,
        status: 'loaded',
        errorMessage: null,
      })
    } catch (err) {
      setMetrics({
        data: null,
        status: 'error',
        errorMessage: 'Network error fetching analytics',
      })
    }
  }, [startDate, endDate])

  // Initial load and re-fetch on date range change
  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Auto-refresh every 60 seconds (Req 15.4)
  useEffect(() => {
    refreshTimerRef.current = setInterval(fetchAnalytics, AUTO_REFRESH_INTERVAL_MS)
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [fetchAnalytics])

  // ─── Date range validation ─────────────────────────────────────────────────

  function handleStartDateChange(value: string) {
    setStartDate(value)
  }

  function handleEndDateChange(value: string) {
    setEndDate(value)
  }

  function getDateRangeError(): string | null {
    if (!startDate || !endDate) return null
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (start > end) return 'Start date must be before end date'
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > MAX_DATE_RANGE_DAYS) return `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`
    return null
  }

  const dateRangeError = getDateRangeError()

  // ─── CSV Export (Req 15.3) ─────────────────────────────────────────────────

  async function handleExport() {
    setIsExporting(true)
    setExportError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setExportError('Not authenticated')
        setIsExporting(false)
        return
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/export-analytics-csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        setExportError(errorData?.error || 'Export failed')
        setIsExporting(false)
        return
      }

      // Trigger download
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `scoutchase-analytics-${startDate}-to-${endDate}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError('Network error during export')
    } finally {
      setIsExporting(false)
    }
  }

  // ─── Access check ──────────────────────────────────────────────────────────

  if (!user || user.role !== 'Council_Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">Access denied. Only Council Admins can view analytics.</p>
          <Link to="/app/passport" className="text-primary hover:underline text-sm">
            Back to Passport
          </Link>
        </div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const data = metrics.data
  const overallStatus = metrics.status

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Platform usage metrics and impact monitoring
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={overallStatus === 'loading'}>
              Refresh
            </Button>
            <Button size="sm" onClick={handleExport} disabled={isExporting || overallStatus === 'error'}>
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </header>

        {exportError && (
          <div className="rounded-lg p-3 text-sm bg-red-50 border border-red-200 text-red-800" role="alert">
            Export failed: {exportError}
          </div>
        )}

        {/* Date Range Filter (Req 15.2) */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                max={endDate}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                max={formatDate(new Date())}
                min={startDate}
              />
            </div>
            <p className="text-xs text-muted-foreground">Auto-refreshes every 60s</p>
          </div>
          {dateRangeError && (
            <p className="text-xs text-destructive mt-2">{dateRangeError}</p>
          )}
        </div>

        {/* Overall error state (Req 15.5) */}
        {overallStatus === 'error' && !data && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center" role="alert">
            <p className="text-destructive font-medium">Failed to load analytics data</p>
            <p className="text-sm text-muted-foreground mt-1">{metrics.errorMessage}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchAnalytics}>
              Retry
            </Button>
          </div>
        )}

        {/* Stat Cards Grid (Req 15.1) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Participants"
            value={data?.total_participants ?? 0}
            subtitle={
              data?.participants_by_role
                ? Object.entries(data.participants_by_role)
                    .map(([role, count]) => `${role.replace('_', ' ')}: ${count}`)
                    .join(', ')
                : undefined
            }
            status={overallStatus}
            errorMessage={metrics.errorMessage}
          />
          <StatCard
            title="Active Heritage Sites"
            value={data?.active_sites ?? 0}
            status={overallStatus}
            errorMessage={metrics.errorMessage}
          />
          <StatCard
            title="Total QR Scans"
            value={data?.total_qr_scans ?? 0}
            status={overallStatus}
            errorMessage={metrics.errorMessage}
          />
          <StatCard
            title="Completed Challenges"
            value={data?.completed_challenges ?? 0}
            status={overallStatus}
            errorMessage={metrics.errorMessage}
          />
          <StatCard
            title="Pending Review Items"
            value={data?.pending_reviews ?? 0}
            status={overallStatus}
            errorMessage={metrics.errorMessage}
          />
          <StatCard
            title="Verified Service Hours"
            value={data?.verified_service_hours ?? 0}
            subtitle="Total hours in date range"
            status={overallStatus}
            errorMessage={metrics.errorMessage}
          />
          <StatCard
            title="Cumulative Sign-ups"
            value={data?.cumulative_signups ?? 0}
            status={overallStatus}
            errorMessage={metrics.errorMessage}
          />
          <StatCard
            title="Retention Rate"
            value={data ? `${data.retention_rate}%` : '0%'}
            subtitle="Active in last 30 days / total"
            status={overallStatus}
            errorMessage={metrics.errorMessage}
          />
          <StatCard
            title="Partner Organizations"
            value={data?.partner_count ?? 0}
            status={overallStatus}
            errorMessage={metrics.errorMessage}
          />
          <StatCard
            title="Satisfaction Rating"
            value={data ? `${data.satisfaction_rating}/5` : '0/5'}
            status={overallStatus}
            errorMessage={metrics.errorMessage}
          />
        </div>

        {/* Trend Charts */}
        {data && overallStatus === 'loaded' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SimpleTrend
              title="Daily QR Scans (last 10 days)"
              data={data.daily_scans as unknown as Array<Record<string, unknown>>}
              labelKey="scan_date"
              valueKey="scan_count"
            />
            <SimpleTrend
              title="Weekly QR Scans"
              data={data.weekly_scans as unknown as Array<Record<string, unknown>>}
              labelKey="week_start"
              valueKey="scan_count"
            />
            <SimpleTrend
              title="Weekly Sign-ups"
              data={data.weekly_signups as unknown as Array<Record<string, unknown>>}
              labelKey="week_start"
              valueKey="signup_count"
            />
          </div>
        )}

        {/* Participants by Role breakdown */}
        {data?.participants_by_role && overallStatus === 'loaded' && (
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">Participants by Role</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(data.participants_by_role).map(([role, count]) => (
                <div key={role} className="text-center p-2 rounded bg-muted/50">
                  <p className="text-lg font-bold text-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground">{role.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
