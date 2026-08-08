/**
 * Supabase Edge Function: generate-certificate
 *
 * Generates a digital certificate (SVG stored as PNG-compatible file) for a user
 * who has earned a badge. The certificate contains the user's name, badge name,
 * and date earned. The generated certificate is stored in Supabase Storage and
 * its URL is saved in the user_badges table.
 *
 * Accepts POST with { user_id, badge_id }
 * Returns { success: true, certificate_url } or { error: string }
 *
 * Validates: Requirements 11.3, 11.6
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Certificate SVG Generation ──────────────────────────────────────────────

/**
 * Generates an SVG certificate containing the user name, badge name, and date earned.
 * The SVG is designed to be visually appealing and fits within a standard certificate
 * layout with ScoutChase Taguig branding.
 *
 * The generated SVG will be well under the 5MB limit specified in Req 11.3.
 */
function generateCertificateSVG(
  userName: string,
  badgeName: string,
  dateEarned: string
): string {
  // Escape XML special characters to prevent injection
  const escapeXml = (str: string): string =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

  const safeUserName = escapeXml(userName)
  const safeBadgeName = escapeXml(badgeName)

  // Format date for display
  const dateObj = new Date(dateEarned)
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const safeDate = escapeXml(formattedDate)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1B5E20;stop-opacity:0.05"/>
      <stop offset="100%" style="stop-color:#FFD700;stop-opacity:0.05"/>
    </linearGradient>
    <linearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1B5E20"/>
      <stop offset="50%" style="stop-color:#FFD700"/>
      <stop offset="100%" style="stop-color:#1B5E20"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="800" height="600" fill="white"/>
  <rect width="800" height="600" fill="url(#bgGradient)"/>

  <!-- Decorative border -->
  <rect x="20" y="20" width="760" height="560" fill="none" stroke="url(#borderGradient)" stroke-width="3" rx="10"/>
  <rect x="30" y="30" width="740" height="540" fill="none" stroke="#1B5E20" stroke-width="1" rx="8" stroke-dasharray="4,4"/>

  <!-- Header decoration -->
  <circle cx="400" cy="80" r="30" fill="none" stroke="#FFD700" stroke-width="2"/>
  <polygon points="400,55 408,72 427,75 413,88 416,107 400,99 384,107 387,88 373,75 392,72" fill="#FFD700"/>

  <!-- Title -->
  <text x="400" y="140" text-anchor="middle" font-family="Georgia, serif" font-size="28" font-weight="bold" fill="#1B5E20">CERTIFICATE OF ACHIEVEMENT</text>

  <!-- Subtitle -->
  <text x="400" y="175" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#555">ScoutChase Taguig – Boy Scouts of the Philippines</text>

  <!-- Divider -->
  <line x1="200" y1="200" x2="600" y2="200" stroke="#FFD700" stroke-width="1"/>

  <!-- Presented to -->
  <text x="400" y="240" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#666">This certificate is proudly presented to</text>

  <!-- User name -->
  <text x="400" y="290" text-anchor="middle" font-family="Georgia, serif" font-size="32" font-weight="bold" fill="#1A237E">${safeUserName}</text>

  <!-- Underline for name -->
  <line x1="200" y1="300" x2="600" y2="300" stroke="#1A237E" stroke-width="0.5"/>

  <!-- For earning -->
  <text x="400" y="345" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#666">for earning the badge</text>

  <!-- Badge name -->
  <text x="400" y="390" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="bold" fill="#B71C1C">${safeBadgeName}</text>

  <!-- Date -->
  <text x="400" y="440" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#666">Date Earned: ${safeDate}</text>

  <!-- Bottom divider -->
  <line x1="200" y1="470" x2="600" y2="470" stroke="#FFD700" stroke-width="1"/>

  <!-- Footer -->
  <text x="400" y="510" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#888">ScoutChase Taguig – Heritage Exploration &amp; Community Engagement Platform</text>
  <text x="400" y="530" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#aaa">Boy Scouts of the Philippines – Taguig City Council</text>

  <!-- Corner decorations -->
  <path d="M50,50 L80,50 L80,55 L55,55 L55,80 L50,80 Z" fill="#1B5E20"/>
  <path d="M750,50 L720,50 L720,55 L745,55 L745,80 L750,80 Z" fill="#1B5E20"/>
  <path d="M50,550 L80,550 L80,545 L55,545 L55,520 L50,520 Z" fill="#1B5E20"/>
  <path d="M750,550 L720,550 L720,545 L745,545 L745,520 L750,520 Z" fill="#1B5E20"/>
</svg>`
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

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { user_id, badge_id } = await req.json()

    // Validate request body
    if (!user_id || typeof user_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'missing_user_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!badge_id || typeof badge_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'missing_badge_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for DB operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ─── Step 1: Fetch user profile (name) ─────────────────────────────────

    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user_id)
      .single()

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: 'user_not_found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ─── Step 2: Fetch badge info and user_badges record ────────────────────

    const { data: badge, error: badgeError } = await supabase
      .from('badges')
      .select('name')
      .eq('id', badge_id)
      .single()

    if (badgeError || !badge) {
      return new Response(
        JSON.stringify({ error: 'badge_not_found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user actually earned this badge
    const { data: userBadge, error: userBadgeError } = await supabase
      .from('user_badges')
      .select('id, earned_at, certificate_url')
      .eq('user_id', user_id)
      .eq('badge_id', badge_id)
      .single()

    if (userBadgeError || !userBadge) {
      return new Response(
        JSON.stringify({ error: 'badge_not_earned' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // If certificate already exists, return it (allows retry without regeneration)
    if (userBadge.certificate_url) {
      return new Response(
        JSON.stringify({
          success: true,
          certificate_url: userBadge.certificate_url,
          already_generated: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ─── Step 3: Generate the certificate SVG ────────────────────────────────

    const certificateSVG = generateCertificateSVG(
      userProfile.full_name,
      badge.name,
      userBadge.earned_at
    )

    // Validate size (must be under 5MB as per Req 11.3)
    const svgBytes = new TextEncoder().encode(certificateSVG)
    const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
    if (svgBytes.length > MAX_SIZE_BYTES) {
      return new Response(
        JSON.stringify({ error: 'certificate_too_large' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ─── Step 4: Upload to Supabase Storage ─────────────────────────────────

    const fileName = `${user_id}/${badge_id}_${Date.now()}.svg`
    const storagePath = `certificates/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(fileName, svgBytes, {
        contentType: 'image/svg+xml',
        cacheControl: '31536000', // 1 year cache
        upsert: false,
      })

    if (uploadError) {
      console.error('Certificate upload failed:', uploadError)
      return new Response(
        JSON.stringify({
          error: 'certificate_generation_failed',
          message: 'Failed to store the certificate. Please retry.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get the public URL for the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from('certificates')
      .getPublicUrl(fileName)

    const certificateUrl = publicUrlData.publicUrl

    // ─── Step 5: Update user_badges with certificate URL ─────────────────────

    const { error: updateError } = await supabase
      .from('user_badges')
      .update({ certificate_url: certificateUrl })
      .eq('user_id', user_id)
      .eq('badge_id', badge_id)

    if (updateError) {
      console.error('Failed to update user_badges with certificate URL:', updateError)
      // The certificate was uploaded successfully, so return the URL even if
      // the DB update fails — the user can still download it
    }

    // ─── Return success ──────────────────────────────────────────────────────

    return new Response(
      JSON.stringify({
        success: true,
        certificate_url: certificateUrl,
        already_generated: false,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('generate-certificate error:', err)
    // Req 11.6: Return error message allowing retry without losing badge record
    return new Response(
      JSON.stringify({
        error: 'certificate_generation_failed',
        message: 'An unexpected error occurred while generating the certificate. Please retry.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
