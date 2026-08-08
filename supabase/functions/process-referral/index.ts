/**
 * Supabase Edge Function: process-referral
 *
 * Processes referral attribution when a new user registers through a referral link.
 * Validates the referral code, checks expiry (90-day), and attributes the
 * registration to the referrer.
 *
 * Handles multiple referral source conflicts by using the referral link
 * from the actual registration session (Req 12.4).
 *
 * Validates: Requirements 12.3, 12.4
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ProcessReferralRequest {
  referral_code: string
  referred_user_id: string
}

interface ReferralRecord {
  id: string
  referrer_id: string
  referred_user_id: string | null
  referral_code: string
  expires_at: string
  redeemed_at: string | null
}

Deno.serve(async (req: Request) => {
  // Only allow POST requests
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
    const body: ProcessReferralRequest = await req.json()

    const { referral_code, referred_user_id } = body

    // Validate required fields
    if (!referral_code || typeof referral_code !== 'string') {
      return new Response(
        JSON.stringify({ error: 'missing_referral_code' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!referred_user_id || typeof referred_user_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'missing_referred_user_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Look up the referral by code
    const { data: referral, error: lookupError } = await supabase
      .from('referrals')
      .select('id, referrer_id, referred_user_id, referral_code, expires_at, redeemed_at')
      .eq('referral_code', referral_code)
      .single()

    if (lookupError || !referral) {
      return new Response(
        JSON.stringify({ error: 'referral_not_found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const referralData = referral as ReferralRecord

    // Step 2: Check if referral has already been redeemed
    if (referralData.redeemed_at !== null) {
      return new Response(
        JSON.stringify({ error: 'referral_already_redeemed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Check if referral has expired (90-day expiry)
    const expiresAt = new Date(referralData.expires_at)
    if (expiresAt < new Date()) {
      return new Response(
        JSON.stringify({ error: 'referral_expired' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Step 4: Prevent self-referral
    if (referralData.referrer_id === referred_user_id) {
      return new Response(
        JSON.stringify({ error: 'self_referral_not_allowed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Step 5: Handle multiple referral conflict (Req 12.4)
    // Check if this user was already attributed to a different referral.
    // Per Req 12.4, we use the referral link from the actual registration session,
    // which is the one being processed here. If a previous attribution exists,
    // we overwrite it with the session referral.
    const { data: existingAttribution } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_user_id', referred_user_id)
      .not('id', 'eq', referralData.id)
      .single()

    if (existingAttribution) {
      // Remove the previous attribution — session referral takes precedence
      await supabase
        .from('referrals')
        .update({
          referred_user_id: null,
          redeemed_at: null,
        })
        .eq('id', existingAttribution.id)
    }

    // Step 6: Attribute the registration to the referrer
    const { error: updateError } = await supabase
      .from('referrals')
      .update({
        referred_user_id,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', referralData.id)

    if (updateError) {
      console.error('Failed to update referral attribution:', updateError)
      return new Response(
        JSON.stringify({ error: 'attribution_failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Return success with referrer info
    return new Response(
      JSON.stringify({
        success: true,
        referrer_id: referralData.referrer_id,
        referral_id: referralData.id,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('process-referral error:', err)
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
