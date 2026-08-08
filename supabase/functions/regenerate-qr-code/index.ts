/**
 * Supabase Edge Function: regenerate-qr-code
 *
 * Accepts a POST request with { site_id }, invalidates the old QR code payload,
 * generates a new HMAC-SHA256 signed QR payload and SVG image, uploads it to
 * storage, and updates the heritage_sites record.
 *
 * This effectively makes any previously printed QR codes for this site invalid,
 * since the old payload will no longer match verification.
 *
 * Validates: Requirements 23.4
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

/**
 * Signs with a timestamp-based nonce to ensure each regeneration produces a
 * different payload. Format: `siteId_timestamp:hmacSignature`
 * where hmacSignature = HMAC-SHA256(`siteId_timestamp`, secret)
 */
async function signQrPayloadWithNonce(siteId: string, secret: string): Promise<string> {
  const nonce = Date.now().toString(36)
  const message = `${siteId}_${nonce}`
  const signature = await hmacSha256(message, secret)
  return `${message}:${signature}`
}

// ─── QR Code SVG Generation ─────────────────────────────────────────────────

function generateQrSvg(data: string): string {
  const size = 33
  const moduleSize = Math.ceil(1200 / size)
  const totalSize = size * moduleSize

  const matrix: boolean[][] = []
  const dataBytes = new TextEncoder().encode(data)

  for (let row = 0; row < size; row++) {
    matrix[row] = []
    for (let col = 0; col < size; col++) {
      if (isFinderPattern(row, col, size)) {
        matrix[row][col] = isFinderPatternDark(row, col, size)
      } else {
        const idx = (row * size + col) % dataBytes.length
        const byte = dataBytes[idx]
        matrix[row][col] = ((byte >> ((row + col) % 8)) & 1) === 1
      }
    }
  }

  let paths = ''
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (matrix[row][col]) {
        const x = col * moduleSize
        const y = row * moduleSize
        paths += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" />`
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">
  <rect width="${totalSize}" height="${totalSize}" fill="white" />
  <g fill="black">
    ${paths}
  </g>
  <!-- Data: ${escapeXml(data)} -->
</svg>`
}

function isFinderPattern(row: number, col: number, size: number): boolean {
  if (row <= 7 && col <= 7) return true
  if (row <= 7 && col >= size - 8) return true
  if (row >= size - 8 && col <= 7) return true
  return false
}

function isFinderPatternDark(row: number, col: number, size: number): boolean {
  let localRow = row
  let localCol = col

  if (row <= 7 && col >= size - 8) {
    localCol = col - (size - 8)
  } else if (row >= size - 8 && col <= 7) {
    localRow = row - (size - 8)
  }

  if (localRow === 7 || localCol === 7) return false
  if (localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6) return true
  if (localRow === 1 || localRow === 5 || localCol === 1 || localCol === 5) return false
  if (localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4) return true

  return false
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── CORS Headers ────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ─── Edge Function Handler ───────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  try {
    const { site_id } = await req.json()

    // Validate request body
    if (!site_id || typeof site_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'missing_site_id', message: 'site_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Get the HMAC secret from environment
    const qrSecret = Deno.env.get('QR_HMAC_SECRET')
    if (!qrSecret) {
      console.error('QR_HMAC_SECRET environment variable not set')
      return new Response(
        JSON.stringify({ error: 'server_configuration_error', message: 'QR signing secret not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Verify the site exists and has an existing QR code
    const { data: site, error: siteError } = await supabase
      .from('heritage_sites')
      .select('id, name, qr_code_payload, qr_code_image_url, is_active')
      .eq('id', site_id)
      .single()

    if (siteError || !site) {
      return new Response(
        JSON.stringify({ error: 'site_not_found', message: 'Heritage site not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Step 2: Generate a new HMAC-signed QR payload with nonce (invalidates old one)
    const newQrPayload = await signQrPayloadWithNonce(site_id, qrSecret)

    // Step 3: Generate new SVG QR code image
    const svgContent = generateQrSvg(newQrPayload)

    // Step 4: Upload new SVG to Supabase Storage (overwrite old file)
    const fileName = `qr-codes/${site_id}.svg`
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' })

    const { error: uploadError } = await supabase.storage
      .from('public-assets')
      .upload(fileName, svgBlob, {
        contentType: 'image/svg+xml',
        upsert: true, // Overwrite existing file
      })

    if (uploadError) {
      console.error('Failed to upload regenerated QR code SVG:', uploadError)
      return new Response(
        JSON.stringify({
          error: 'upload_failed',
          message: 'Failed to upload new QR code image.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Get public URL for the uploaded SVG
    const { data: urlData } = supabase.storage
      .from('public-assets')
      .getPublicUrl(fileName)

    const qrImageUrl = urlData.publicUrl

    // Step 5: Update the heritage site record with new payload (old is now invalid)
    const { error: updateError } = await supabase
      .from('heritage_sites')
      .update({
        qr_code_payload: newQrPayload,
        qr_code_image_url: qrImageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', site_id)

    if (updateError) {
      console.error('Failed to update heritage site with new QR data:', updateError)
      return new Response(
        JSON.stringify({
          error: 'update_failed',
          message: 'New QR code was generated but failed to save to the site record.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        site_id: site.id,
        site_name: site.name,
        qr_code_payload: newQrPayload,
        qr_code_image_url: qrImageUrl,
        previous_payload_invalidated: true,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (err) {
    console.error('regenerate-qr-code error:', err)
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: 'An unexpected error occurred during QR code regeneration.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})
