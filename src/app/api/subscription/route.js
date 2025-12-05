import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function POST(request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse the request body
    const body = await request.json()
    const { action, plan, status } = body

    let updateData = {}

    switch (action) {
      case 'upgrade':
        updateData = {
          subscription_plan: plan || 'pro',
          subscription_status: 'active',
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: null,
        }
        break

      case 'cancel':
        updateData = {
          subscription_status: 'cancelled',
          subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        }
        break

      case 'reactivate':
        updateData = {
          subscription_status: 'active',
          subscription_end_date: null,
        }
        break

      case 'expire':
        updateData = {
          subscription_plan: 'free',
          subscription_status: 'expired',
        }
        break

      case 'update_status':
        updateData = {
          subscription_status: status,
        }
        break

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Update user metadata
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      { user_metadata: { ...user.user_metadata, ...updateData } }
    )

    if (error) {
      console.error('Error updating subscription:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({
      success: true,
      subscription: {
        plan: data.user.user_metadata.subscription_plan,
        status: data.user.user_metadata.subscription_status,
        end_date: data.user.user_metadata.subscription_end_date,
      }
    })

  } catch (error) {
    console.error('Subscription API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return Response.json({
      subscription: {
        plan: user.user_metadata?.subscription_plan || 'free',
        status: user.user_metadata?.subscription_status || 'active',
        start_date: user.user_metadata?.subscription_start_date,
        end_date: user.user_metadata?.subscription_end_date,
      }
    })

  } catch (error) {
    console.error('Subscription API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
