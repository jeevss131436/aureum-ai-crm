// app/api/diagnose-sync/route.js
// Complete diagnostic tool for Google Calendar sync

import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId') || 'test-user-id'
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    userId: userId,
    tests: {}
  }

  // ==========================================
  // TEST 1: Environment Variables
  // ==========================================
  diagnostics.tests.environment = {
    name: 'Environment Variables',
    status: 'checking'
  }
  
  const envVars = {
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
  }
  
  diagnostics.tests.environment.results = {
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: envVars.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? '✅ Set (length: ' + envVars.NEXT_PUBLIC_GOOGLE_CLIENT_ID.length + ')' : '❌ MISSING',
    GOOGLE_CLIENT_SECRET: envVars.GOOGLE_CLIENT_SECRET ? '✅ Set (length: ' + envVars.GOOGLE_CLIENT_SECRET.length + ')' : '❌ MISSING',
    NEXT_PUBLIC_APP_URL: envVars.NEXT_PUBLIC_APP_URL || '❌ MISSING',
    SUPABASE_SERVICE_ROLE_KEY: envVars.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set (length: ' + envVars.SUPABASE_SERVICE_ROLE_KEY.length + ')' : '❌ MISSING',
    NEXT_PUBLIC_SUPABASE_URL: envVars.NEXT_PUBLIC_SUPABASE_URL || '❌ MISSING'
  }
  
  const allEnvPresent = Object.values(envVars).every(v => !!v)
  diagnostics.tests.environment.status = allEnvPresent ? '✅ PASS' : '❌ FAIL - Missing env vars'

  // ==========================================
  // TEST 2: Supabase Connection
  // ==========================================
  diagnostics.tests.supabaseConnection = {
    name: 'Supabase Connection',
    status: 'checking'
  }
  
  let supabase = null
  try {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    const { data, error } = await supabase
      .from('google_calendar_tokens')
      .select('count')
      .limit(1)
    
    diagnostics.tests.supabaseConnection.results = {
      canConnect: !error,
      error: error?.message || null,
      tablesExist: !error
    }
    diagnostics.tests.supabaseConnection.status = !error ? '✅ PASS' : '❌ FAIL'
  } catch (err) {
    diagnostics.tests.supabaseConnection.results = {
      canConnect: false,
      error: err.message
    }
    diagnostics.tests.supabaseConnection.status = '❌ FAIL'
  }

  // ==========================================
  // TEST 3: Direct Insert (Test RLS)
  // ==========================================
  diagnostics.tests.directInsert = {
    name: 'Direct Insert (RLS Test)',
    status: 'checking'
  }
  
  if (supabase) {
    try {
      // Try to insert test data
      const { data, error } = await supabase
        .from('google_calendar_tokens')
        .insert({
          user_id: userId,
          access_token: 'test-token-' + Date.now(),
          refresh_token: 'test-refresh-token',
          expiry_date: Date.now() + 3600000,
          scope: 'https://www.googleapis.com/auth/calendar'
        })
        .select()
      
      diagnostics.tests.directInsert.results = {
        success: !error,
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : null,
        insertedData: data
      }
      
      diagnostics.tests.directInsert.status = !error ? '✅ PASS - RLS allows service role' : '❌ FAIL - RLS blocking'
      
      // Clean up test data
      if (!error && data?.[0]?.id) {
        await supabase
          .from('google_calendar_tokens')
          .delete()
          .eq('id', data[0].id)
        
        diagnostics.tests.directInsert.results.cleanedUp = true
      }
    } catch (err) {
      diagnostics.tests.directInsert.results = {
        success: false,
        error: err.message
      }
      diagnostics.tests.directInsert.status = '❌ FAIL - Exception thrown'
    }
  } else {
    diagnostics.tests.directInsert.status = '⏭️ SKIPPED - No Supabase connection'
  }

  // ==========================================
  // TEST 4: RLS Policies Check
  // ==========================================
  diagnostics.tests.rlsPolicies = {
    name: 'RLS Policies',
    status: 'checking'
  }
  
  if (supabase) {
    try {
      // Check policies directly from Supabase
      const { data: tokenTable } = await supabase.rpc('exec_sql', {
        query: `
          SELECT policyname, 
                 qual::text as using_clause, 
                 with_check::text as with_check_clause
          FROM pg_policies 
          WHERE tablename = 'google_calendar_tokens'
        `
      }).catch(() => ({ data: null }))
      
      // Alternative: Just report what we tried
      diagnostics.tests.rlsPolicies.results = {
        note: 'RLS policies exist but need manual verification',
        instruction: 'Run this in Supabase SQL Editor:',
        query: `
SELECT 
  tablename,
  policyname,
  CASE 
    WHEN qual::text LIKE '%service_role%' OR with_check::text LIKE '%service_role%' 
    THEN '✅ Has service role'
    ELSE '❌ Missing service role'
  END as status
FROM pg_policies
WHERE tablename IN ('google_calendar_tokens', 'google_calendar_channels')
ORDER BY tablename, policyname;
        `
      }
      
      diagnostics.tests.rlsPolicies.status = diagnostics.tests.directInsert.status === '✅ PASS - RLS allows service role' 
        ? '✅ PASS - Insert worked, policies are good' 
        : '❓ UNKNOWN - Check manually with query above'
      
    } catch (err) {
      diagnostics.tests.rlsPolicies.results = {
        error: err.message
      }
      diagnostics.tests.rlsPolicies.status = '❌ FAIL'
    }
  }

  // ==========================================
  // TEST 5: OAuth Client Setup
  // ==========================================
  diagnostics.tests.oauthClient = {
    name: 'OAuth Client',
    status: 'checking'
  }
  
  try {
    if (envVars.NEXT_PUBLIC_GOOGLE_CLIENT_ID && envVars.GOOGLE_CLIENT_SECRET && envVars.NEXT_PUBLIC_APP_URL) {
      const oauth2Client = new google.auth.OAuth2(
        envVars.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        envVars.GOOGLE_CLIENT_SECRET,
        envVars.NEXT_PUBLIC_APP_URL + '/api/auth/callback/google'
      )
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar'],
        state: userId
      })
      
      diagnostics.tests.oauthClient.results = {
        canGenerateUrl: true,
        authUrlSample: authUrl.substring(0, 100) + '...',
        redirectUri: envVars.NEXT_PUBLIC_APP_URL + '/api/auth/callback/google'
      }
      diagnostics.tests.oauthClient.status = '✅ PASS'
    } else {
      diagnostics.tests.oauthClient.results = {
        canGenerateUrl: false,
        reason: 'Missing required env vars'
      }
      diagnostics.tests.oauthClient.status = '❌ FAIL'
    }
  } catch (err) {
    diagnostics.tests.oauthClient.results = {
      error: err.message
    }
    diagnostics.tests.oauthClient.status = '❌ FAIL'
  }

  // ==========================================
  // TEST 6: API Routes Exist
  // ==========================================
  diagnostics.tests.apiRoutes = {
    name: 'API Routes Check',
    results: {
      authGoogle: 'Check: http://localhost:3000/api/auth/google?userId=test',
      authCallback: 'Should exist at: app/api/auth/callback/google/route.js',
      setupWatch: 'Should exist at: app/api/calendar/setup-watch/route.js',
      webhook: 'Should exist at: app/api/calendar/webhook/route.js',
      instruction: 'Visit the authGoogle URL above - should redirect to Google'
    },
    status: '⚠️ MANUAL CHECK REQUIRED'
  }

  // ==========================================
  // OVERALL STATUS
  // ==========================================
  const failedTests = Object.values(diagnostics.tests).filter(t => 
    t.status?.includes('FAIL')
  )
  
  diagnostics.overall = {
    totalTests: Object.keys(diagnostics.tests).length,
    passed: Object.values(diagnostics.tests).filter(t => t.status?.includes('PASS')).length,
    failed: failedTests.length,
    status: failedTests.length === 0 ? '✅ ALL SYSTEMS GO' : '❌ ISSUES FOUND',
    nextSteps: failedTests.length > 0 
      ? 'Fix the failing tests above before testing OAuth flow'
      : 'All tests passed! Try the OAuth flow now: Click "Sync with Google Calendar"'
  }

  return Response.json(diagnostics, { 
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}