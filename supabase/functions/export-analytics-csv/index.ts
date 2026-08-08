/**
 * Supabase Edge Function: export-analytics-csv
 *
 * Generates a CSV file from the analytics summary data for the given date range.
 * Restricted to Council_Admin users. Must complete within 10 seconds.
 *
 * Validates: Requirements 15.3
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── CSV Utilities ───────────────────────────────────────────────────────────

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsvFromAnalytics(data: Record<string, unknown>): string {
  const lines: string[] = []

  // Header row
  lines.push('Metric,Value')

  // Flat metrics
  lines.push(`Total Participants,${escapeCsvValue(data.total_participants as number)}`)
  lines.push(`Active Heritage Sites,${escapeCsvValue(data.active_sites as number)}`)
  lines.push(`Total QR Scans,${escapeCsvValue(data.total_qr_scans as number)}`)
  lines.push(`Completed Challenges,${escapeCsvValue(data.completed_challenges as number)}`)
  lines.push(`Pending Review Items,${escapeCsvValue(data.pending_reviews as number)}`)
  lines.push(`Verified Service Hours,${escapeCsvValue(data.verified_service_hours as number)}`)
  lines.push(`Cumulative Sign-ups,${escapeCsvValue(data.cumulative_signups as number)}`)
  lines.push(`Retention Rate (%),${escapeCsvValue(data.retention_rate as number)}`)
  lines.push(`Partner Count,${escapeCsvValue(data.partner_count as number)}`)
  lines.push(`Satisfaction Rating,${escapeCsvValue(data.satisfaction_rating as number)}`)

  // Participants by role
  const roleBreakdown = data.participants_by_role as Record<string, number> | null
  if (roleBreakdown) {
    lines.push('')
    lines.push('Role,Count')
    for (const [role, count] of Object.entries(roleBreakdown)) {
      lines.push(`${escapeCsvValue(role)},${escapeCsvValue(count)}`)
    }
  }

  // Daily scans trend
  const dailyScans = data.daily_scans as Array<{ scan_date: string; scan_count: number }> | null
  if (dailyScans && dailyScans.length > 0) {
    lines.push('')
    lines.push('Daily QR Scans')
    lines.push('Date,Scan Count')
    for (const entry of dailyScans) {
      lines.push(`${escapeCsvValue(entry.scan_date)},${escapeCsvValue(entry.scan_count)}`)
    }
  }

  // Weekly scans trend
  const weeklyScans = data.weekly_scans as Array<{ week_start: string; scan_count: number }> | null
  if (weeklyScans && weeklyScans.length > 0) {
    lines.push('')
    lines.push('Weekly QR Scans')
    lines.push('Week Start,Scan Count')
    for (const entry of weeklyScans) {
      lines.push(`${escapeCsvValue(entry.week_start)},${escapeCsvValue(entry.scan_count)}`)
    }
  }

  // Weekly signups
  const weeklySignups = data.weekly_signups as Array<{ week_start: string; signup_count: number }> | null
  if (weeklySignups && weeklySignups.length > 0) {
    lines.push('')
    lines.push('Weekly Sign-ups')
    lines.push('Week Start,Sign-up Count')
    for (const entry of weeklySignups) {
      lines.push(`${escapeCsvValue(entry.week_start)},${escapeCsvValue(entry.signup_count)}`)
    }
  }

  return lines.join('\n')
}

// ─── Edge Function Handler ───────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Extract auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify user is Council_Admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check role
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'Council_Admin') {
      return new Response(
        JSON.stringify({ error: 'forbidden' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse date range from body
    const body = await req.json()
    const startDate = body.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = body.end_date || new Date().toISOString().split('T')[0]

    // Call the analytics RPC
    const { data: analyticsData, error: rpcError } = await serviceClient
      .rpc('get_analytics_summary', {
        p_start_date: startDate,
        p_end_date: endDate,
      })

    if (rpcError) {
      console.error('Analytics RPC error:', rpcError)
      return new Response(
        JSON.stringify({ error: 'analytics_query_failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Generate CSV
    const csv = buildCsvFromAnalytics(analyticsData as Record<string, unknown>)

    // Return CSV as downloadable file
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="scoutchase-analytics-${startDate}-to-${endDate}.csv"`,
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('export-analytics-csv error:', err)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
