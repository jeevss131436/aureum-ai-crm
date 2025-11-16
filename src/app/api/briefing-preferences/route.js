// API route for managing user briefing preferences
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET - Retrieve user's current briefing preferences
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing userId'
      }, { status: 400 })
    }

    // Get user metadata
    const { data: user, error } = await supabase.auth.admin.getUserById(userId)

    if (error) {
      console.error('Error fetching user:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch user data'
      }, { status: 500 })
    }

    const preferences = user.user_metadata?.briefing_preferences || {
      email_enabled: false,
      email_frequency: 'weekly',
      email_day: 1, // Monday
      email_time: '09:00',
      timezone: 'America/New_York'
    }

    return NextResponse.json({
      success: true,
      preferences
    })

  } catch (error) {
    console.error('Get preferences error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// POST - Update user's briefing preferences
export async function POST(request) {
  try {
    const { userId, preferences } = await request.json()

    if (!userId || !preferences) {
      return NextResponse.json({
        success: false,
        error: 'Missing userId or preferences'
      }, { status: 400 })
    }

    // Validate preferences
    const validatedPreferences = {
      email_enabled: Boolean(preferences.email_enabled),
      email_frequency: ['daily', 'weekly'].includes(preferences.email_frequency)
        ? preferences.email_frequency
        : 'weekly',
      email_day: Number.isInteger(preferences.email_day) && preferences.email_day >= 0 && preferences.email_day <= 6
        ? preferences.email_day
        : 1,
      email_time: /^\d{2}:\d{2}$/.test(preferences.email_time)
        ? preferences.email_time
        : '09:00',
      timezone: preferences.timezone || 'America/New_York'
    }

    // Update user metadata
    const { data: user, error } = await supabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          briefing_preferences: validatedPreferences
        }
      }
    )

    if (error) {
      console.error('Error updating user metadata:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to update preferences'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      preferences: validatedPreferences,
      message: 'Briefing preferences updated successfully'
    })

  } catch (error) {
    console.error('Update preferences error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
