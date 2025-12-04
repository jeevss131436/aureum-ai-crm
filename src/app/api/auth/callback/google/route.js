// app/api/auth/callback/google/route.js
// FIXED VERSION - Proper Supabase upsert

import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

// Use service role to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const oauth2Client = new google.auth.OAuth2(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NEXT_PUBLIC_APP_URL + '/api/auth/callback/google'
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // User ID from state
    const error = searchParams.get('error')
    
    console.log('================================')
    console.log('📥 CALLBACK RECEIVED')
    console.log('  Has code:', !!code)
    console.log('  User ID:', state)
    console.log('  Error from Google:', error)
    console.log('================================')
    
    // Check if user denied access
    if (error === 'access_denied') {
      console.log('❌ User denied access')
      return Response.redirect('/calendar?error=access_denied')
    }
    
    if (!code) {
      console.error('❌ No authorization code')
      return Response.redirect('/calendar?error=no_code')
    }
    
    if (!state) {
      console.error('❌ No state (user ID)')
      return Response.redirect('/calendar?error=no_user_id')
    }
    
    // Exchange authorization code for tokens
    console.log('🔑 Exchanging code for tokens...')
    const { tokens } = await oauth2Client.getToken(code)
    console.log('✅ Got tokens from Google')
    console.log('  Access token length:', tokens.access_token?.length)
    console.log('  Has refresh token:', !!tokens.refresh_token)
    console.log('  Expiry:', new Date(tokens.expiry_date))
    
    // Prepare token data
    const tokenData = {
      user_id: state,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expiry_date: tokens.expiry_date || null,
      scope: tokens.scope || 'https://www.googleapis.com/auth/calendar',
      
    }
    
    console.log('💾 Saving to database...')
    console.log('💾 Saving to database...')
    console.log('EXACT DATA BEING SENT:')
    console.log(JSON.stringify(tokenData, null, 2))
    console.log('User ID type:', typeof state)
    console.log('User ID value:', state)
    console.log('Access token type:', typeof tokens.access_token)
    console.log('Access token length:', tokens.access_token?.length)
    console.log('  Data to insert:', JSON.stringify({
      ...tokenData,
      access_token: tokenData.access_token?.substring(0, 20) + '...',
      refresh_token: tokenData.refresh_token ? 'present' : 'null'
    }, null, 2))
    
    // Try insert first, then update if exists
    const { data: existingToken } = await supabase
      .from('google_calendar_tokens')
      .select('id')
      .eq('user_id', state)
      .single()
    
    let result
    if (existingToken) {
      console.log('  Found existing token, updating...')
      result = await supabase
        .from('google_calendar_tokens')
        .update(tokenData)
        .eq('user_id', state)
        .select()
    } else {
      console.log('  No existing token, inserting new...')
      result = await supabase
        .from('google_calendar_tokens')
        .insert(tokenData)
        .select()
    }
    
    const { data, error: dbError } = result
    
    if (dbError) {
      console.error('❌ DATABASE ERROR:')
      console.error('  Message:', dbError.message)
      console.error('  Code:', dbError.code)
      console.error('  Details:', dbError.details)
      console.error('  Hint:', dbError.hint)
      console.error('  Full error:', JSON.stringify(dbError, null, 2))
      return Response.redirect('/calendar?error=db_failed&msg=' + encodeURIComponent(dbError.message))
    }
    
    console.log('✅✅✅ SUCCESS!')
    console.log('  Saved token for user:', state)
    console.log('  Data:', data)
    console.log('================================')
    
    return Response.redirect('/calendar?sync=success')
    
  } catch (error) {
    console.error('❌ EXCEPTION in callback:')
    console.error(error)
    return Response.redirect('/calendar?error=auth_failed&msg=' + encodeURIComponent(error.message))
  }
}