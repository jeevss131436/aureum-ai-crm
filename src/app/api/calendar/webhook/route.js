// app/api/calendar/webhook/route.js
// Google Calendar Webhook Handler

import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase with service role (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for server
)

export async function POST(request) {
  try {
    // Get notification headers from Google
    const channelId = request.headers.get('X-Goog-Channel-ID')
    const resourceState = request.headers.get('X-Goog-Resource-State')
    const resourceId = request.headers.get('X-Goog-Resource-ID')
    
    console.log('Webhook received:', { channelId, resourceState, resourceId })
    
    // Google sends 'sync' on initial setup - acknowledge it
    if (resourceState === 'sync') {
      return Response.json({ success: true, message: 'Channel verified' })
    }
    
    // For 'exists' state, fetch the changes
    if (resourceState === 'exists') {
      // Get user ID from channel ID (you'll need to store this mapping)
      const { data: channelData } = await supabase
        .from('google_calendar_channels')
        .select('user_id')
        .eq('channel_id', channelId)
        .single()
      
      if (!channelData) {
        console.error('Channel not found:', channelId)
        return Response.json({ error: 'Channel not found' }, { status: 404 })
      }
      
      // Get user's Google tokens
      const { data: tokenData } = await supabase
        .from('google_calendar_tokens')
        .select('*')
        .eq('user_id', channelData.user_id)
        .single()
      
      if (!tokenData) {
        return Response.json({ error: 'No tokens found' }, { status: 401 })
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
      
      // Fetch calendar events from Google
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime'
      })
      
      const googleEvents = response.data.items || []
      
      // Sync each Google event to Supabase
      for (const gEvent of googleEvents) {
        // Check if event exists in Aureum
        const { data: existingEvent } = await supabase
          .from('calendar_events')
          .select('id')
          .eq('google_event_id', gEvent.id)
          .single()
        
        const eventData = {
          user_id: channelData.user_id,
          title: gEvent.summary || 'Untitled Event',
          start_time: gEvent.start.dateTime || gEvent.start.date,
          end_time: gEvent.end.dateTime || gEvent.end.date,
          location: gEvent.location || null,
          notes: gEvent.description || null,
          google_event_id: gEvent.id,
          event_type: 'meeting' // Default type
        }
        
        if (existingEvent) {
          // Update existing event
          await supabase
            .from('calendar_events')
            .update(eventData)
            .eq('id', existingEvent.id)
        } else {
          // Create new event
          await supabase
            .from('calendar_events')
            .insert([eventData])
        }
      }
      
      console.log(`Synced ${googleEvents.length} events for user ${channelData.user_id}`)
    }
    
    return Response.json({ success: true })
    
  } catch (error) {
    console.error('Webhook error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// Handle Google's webhook verification
export async function GET(request) {
  // Google may send GET requests to verify the endpoint
  return Response.json({ status: 'Webhook endpoint active' })
}