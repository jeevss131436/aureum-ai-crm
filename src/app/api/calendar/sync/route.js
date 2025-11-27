import { google } from 'googleapis'
import { supabase } from '@/utils/supabaseClient'

export async function POST(request) {
  const { userId } = await request.json()
  
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
  
  try {
    // Get Aureum events
    const { data: auremEvents } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
    
    // Sync each event to Google Calendar
    for (const event of auremEvents) {
      const googleEvent = {
        summary: event.title,
        description: event.notes || '',
        location: event.location || '',
        start: {
          dateTime: event.start_time,
          timeZone: 'America/Los_Angeles',
        },
        end: {
          dateTime: event.end_time || event.start_time,
          timeZone: 'America/Los_Angeles',
        },
      }
      
      // Check if event already exists in Google Calendar
      if (event.google_event_id) {
        // Update existing
        await calendar.events.update({
          calendarId: 'primary',
          eventId: event.google_event_id,
          resource: googleEvent,
        })
      } else {
        // Create new
        const response = await calendar.events.insert({
          calendarId: 'primary',
          resource: googleEvent,
        })
        
        // Store Google event ID
        await supabase
          .from('calendar_events')
          .update({ google_event_id: response.data.id })
          .eq('id', event.id)
      }
    }
    
    return Response.json({ success: true, synced: auremEvents.length })
  } catch (error) {
    console.error('Sync error:', error)
    return Response.json({ error: 'Sync failed' }, { status: 500 })
  }
}