// app/api/test-oauth-flow/route.js
// TEST ROUTE - Diagnose OAuth issues

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  
  const results = {
    timestamp: new Date().toISOString(),
    environment: {
      hasClientId: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
    },
    database: {},
    testInsert: {}
  }
  
  // Test database connection
  try {
    const { data, error } = await supabase
      .from('google_calendar_tokens')
      .select('count')
      .limit(1)
    
    results.database.canConnect = !error
    results.database.error = error?.message || null
  } catch (err) {
    results.database.canConnect = false
    results.database.error = err.message
  }
  
  // Test if we can insert (if userId provided)
  if (userId) {
    try {
      // Try to insert test data
      const { data, error } = await supabase
        .from('google_calendar_tokens')
        .upsert({
          user_id: userId,
          access_token: 'test-token-' + Date.now(),
          refresh_token: 'test-refresh',
          expiry_date: Date.now() + 3600000,
          scope: 'test'
        })
        .select()
      
      results.testInsert.success = !error
      results.testInsert.error = error?.message || null
      results.testInsert.data = data
      
      // Clean up test data
      if (!error) {
        await supabase
          .from('google_calendar_tokens')
          .delete()
          .eq('user_id', userId)
          .eq('scope', 'test')
      }
    } catch (err) {
      results.testInsert.success = false
      results.testInsert.error = err.message
    }
  }
  
  // Check RLS policies
  try {
    const { data: policies } = await supabase
      .from('pg_policies')
      .select('*')
      .in('tablename', ['google_calendar_tokens', 'google_calendar_channels'])
    
    results.rlsPolicies = policies?.map(p => ({
      table: p.tablename,
      policy: p.policyname,
      hasServiceRole: (p.qual?.includes('service_role') || p.with_check?.includes('service_role'))
    })) || []
  } catch (err) {
    results.rlsPolicies = { error: err.message }
  }
  
  return Response.json(results, { 
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}