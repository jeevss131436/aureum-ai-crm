import { google } from 'googleapis'
import { supabase } from '@/utils/supabaseClient'
import { cookies } from 'next/headers'

const oauth2Client = new google.auth.OAuth2(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NEXT_PUBLIC_APP_URL + '/api/auth/callback/google'
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (!code) {
    return Response.redirect('/calendar?error=no_code')
  }
  
  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)
    
    // Get user from Supabase (you'll need to pass user ID somehow)
    // Store tokens in Supabase
    const { data: { user } } = await supabase.auth.getUser()
    
    await supabase
      .from('google_calendar_tokens')
      .upsert({
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        scope: tokens.scope
      })
    
    return Response.redirect('/calendar?sync=success')
  } catch (error) {
    console.error('Error during OAuth:', error)
    return Response.redirect('/calendar?error=auth_failed')
  }
}