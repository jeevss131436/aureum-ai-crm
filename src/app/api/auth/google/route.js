// app/api/auth/google/route.js
// Fixed version with user ID in state parameter

import { google } from 'googleapis'

const oauth2Client = new google.auth.OAuth2(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NEXT_PUBLIC_APP_URL + '/api/auth/callback/google'
)

export async function GET(request) {
  try {
    // Get user ID from query parameter
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      console.error('No userId provided to OAuth route')
      return Response.redirect('/calendar?error=no_user_id')
    }
    
    console.log('Starting OAuth for user:', userId)
    
    // Generate OAuth URL with user ID in state
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
      prompt: 'consent',
      state: userId // Pass user ID through state parameter
    })
    
    console.log('Redirecting to Google OAuth')
    return Response.redirect(url)
    
  } catch (error) {
    console.error('OAuth route error:', error)
    return Response.redirect('/calendar?error=oauth_init_failed')
  }
}