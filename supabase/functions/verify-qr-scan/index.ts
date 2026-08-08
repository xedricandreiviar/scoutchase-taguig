/**
 * Supabase Edge Function: verify-qr-scan
 *
 * Accepts a POST request with { payload, user_id }, verifies the HMAC-SHA256
 * signed QR code, checks site existence, handles duplicate scans, and awards
 * points on new unlocks.
 *
 * Validates: Requirements 6.3, 6.4, 6.5, 6.7, 6.8, 21.1, 21.6
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── HMAC Utilities ──────────────────────────────────────────────────────────

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

async function hmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const msgData = encoder.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  return bufferToHex(signature)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

interface VerifyResult {
  valid: boolean
  siteId?: string
}

async function verifyQrPayload(payload: string, secret: string): Promise<VerifyResult> {
  if (!payload || typeof payload !== 'string') {
    return { valid: false }
  }

  const lastColonIndex = payload.lastIndexOf(':')
  if (lastColonIndex === -1 || lastColonIndex === 0) {
    return { valid: false }
  }

  const siteId = payload.substring(0, lastColonIndex)
  const providedSignature = payload.substring(lastColonIndex + 1)

  if (!siteId || !providedSignature) {
    return { valid: false }
  }

  if (providedSignature.length !== 64) {
    return { valid: false }
  }

  const expectedSignature = await hmacSha256(siteId, secret)

  if (timingSafeEqual(expectedSignature, providedSignature)) {
    return { valid: true, siteId }
  }

  return { valid: false }
}

// ─── Edge Function Handler ───────────────────────────────────────────────────

const POINTS_PER_SCAN = 10

Deno.serve(async (req: Request) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

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

  try {
    const { payload, user_id } = await req.json()

    // Validate request body
    if (!payload || typeof payload !== 'string') {
      return new Response(
        JSON.stringify({ error: 'missing_payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!user_id || typeof user_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'missing_user_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get the HMAC secret from environment
    const qrSecret = Deno.env.get('QR_HMAC_SECRET')
    if (!qrSecret) {
      console.error('QR_HMAC_SECRET environment variable not set')
      return new Response(
        JSON.stringify({ error: 'server_configuration_error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Step 1: Verify the HMAC-SHA256 signature (Req 6.3, 6.4, 21.1)
    const verification = await verifyQrPayload(payload, qrSecret)

    if (!verification.valid || !verification.siteId) {
      return new Response(
        JSON.stringify({ error: 'invalid_qr_code' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const siteId = verification.siteId

    // Create Supabase client with service role for DB operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 2: Check that the site exists and is active (Req 6.5)
    const { data: site, error: siteError } = await supabase
      .from('heritage_sites')
      .select('id, name, is_active')
      .eq('id', siteId)
      .single()

    if (siteError || !site) {
      return new Response(
        JSON.stringify({ error: 'site_not_found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!site.is_active) {
      return new Response(
        JSON.stringify({ error: 'site_inactive' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Check if user already has this site unlocked (Req 6.8, 21.6)
    const { data: existingScan } = await supabase
      .from('qr_scans')
      .select('id')
      .eq('user_id', user_id)
      .eq('heritage_site_id', siteId)
      .single()

    if (existingScan) {
      // Already unlocked — return success without duplicate points or record (Req 6.8)
      return new Response(
        JSON.stringify({
          success: true,
          already_unlocked: true,
          site_id: site.id,
          site_name: site.name,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Step 4: New unlock — insert qr_scans record (Req 6.7)
    const { error: insertError } = await supabase
      .from('qr_scans')
      .insert({
        user_id,
        heritage_site_id: siteId,
        scanned_at: new Date().toISOString(),
      })

    if (insertError) {
      // Handle race condition with unique constraint (duplicate insert)
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({
            success: true,
            already_unlocked: true,
            site_id: site.id,
            site_name: site.name,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      console.error('Failed to insert qr_scan:', insertError)
      return new Response(
        JSON.stringify({ error: 'scan_failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Step 5: Award points via points_ledger
    const { error: pointsError } = await supabase
      .from('points_ledger')
      .insert({
        user_id,
        amount: POINTS_PER_SCAN,
        reason: 'qr_scan',
        reference_id: siteId,
      })

    if (pointsError) {
      console.error('Failed to award points:', pointsError)
      // Don't fail the whole scan if points fail — the unlock is recorded
    }

    // Update profile total_points
    const { error: profileError } = await supabase.rpc('award_points', {
      p_user_id: user_id,
      p_amount: POINTS_PER_SCAN,
      p_reason: 'qr_scan',
      p_ref_id: siteId,
    }).catch(() => {
      // Fallback: manually increment total_points if RPC not available yet
      return supabase
        .from('profiles')
        .select('total_points')
        .eq('id', user_id)
        .single()
        .then(({ data }) => {
          if (data) {
            return supabase
              .from('profiles')
              .update({ total_points: (data.total_points || 0) + POINTS_PER_SCAN })
              .eq('id', user_id)
          }
          return { error: null }
        })
    })

    if (profileError) {
      console.error('Failed to update profile points:', profileError)
    }

    // Return success with site info
    return new Response(
      JSON.stringify({
        success: true,
        already_unlocked: false,
        site_id: site.id,
        site_name: site.name,
        points_awarded: POINTS_PER_SCAN,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('verify-qr-scan error:', err)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
