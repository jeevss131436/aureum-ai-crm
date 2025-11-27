// app/api/calendar/setup-watch/route.js
// This route SETS UP the webhook (call once when user connects Google Calendar)

import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { userId } = await request.json()
    
    if (!userId) {
      return Response.json({ error: 'User ID required' }, { status: 400 })
    }
    
    // Get user's Google tokens
    const { data: tokenData } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (!tokenData) {
      return Response.json({ error: 'Not connected to Google Calendar' }, { status: 401 })
    }
    
    // Set up OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    
    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token
    })
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    
    // Generate unique channel ID
    const channelId = uuidv4()
    
    // Set up webhook watch
    const watchResponse = await calendar.events.watch({
      calendarId: 'primary',
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/webhook`,
        // Token for additional security (optional)
        token: process.env.WEBHOOK_SECRET || 'your-secret-token',
        // Webhook expires after 1 week (max allowed by Google)
        expiration: Date.now() + (7 * 24 * 60 * 60 * 1000)
      }
    })
    
    // Store channel information in database
    await supabase
      .from('google_calendar_channels')
      .upsert({
        channel_id: channelId,
        user_id: userId,
        resource_id: watchResponse.data.resourceId,
        expiration: watchResponse.data.expiration,
        created_at: new Date().toISOString()
      })
    
    console.log('Webhook watch set up:', {
      channelId,
      resourceId: watchResponse.data.resourceId,
      expiration: new Date(parseInt(watchResponse.data.expiration))
    })
    
    return Response.json({
      success: true,
      channelId,
      resourceId: watchResponse.data.resourceId,
      expiration: watchResponse.data.expiration
    })
    
  } catch (error) {
    console.error('Setup watch error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}