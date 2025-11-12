import { createClient } from '@supabase/supabase-js'

export async function generateDailyBriefing(userId) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  // Get today's and tomorrow's deadlines
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const todayStr = today.toISOString().split('T')[0]
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // Fetch today's deadlines
  const { data: todayDeadlines } = await supabase
    .from('timeline_items')
    .select(`
      *,
      transactions!inner (
        property_address,
        user_id,
        clients (name)
      )
    `)
    .eq('transactions.user_id', userId)
    .eq('completed', false)
    .eq('due_date', todayStr)
    .order('due_date')

  // Fetch tomorrow's deadlines
  const { data: tomorrowDeadlines } = await supabase
    .from('timeline_items')
    .select(`
      *,
      transactions!inner (
        property_address,
        user_id,
        clients (name)
      )
    `)
    .eq('transactions.user_id', userId)
    .eq('completed', false)
    .eq('due_date', tomorrowStr)
    .order('due_date')

  // Fetch overdue items
  const { data: overdueDeadlines } = await supabase
    .from('timeline_items')
    .select(`
      *,
      transactions!inner (
        property_address,
        user_id,
        clients (name)
      )
    `)
    .eq('transactions.user_id', userId)
    .eq('completed', false)
    .lt('due_date', todayStr)
    .order('due_date')

  // Fetch active transactions count
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')

  return {
    today: todayDeadlines || [],
    tomorrow: tomorrowDeadlines || [],
    overdue: overdueDeadlines || [],
    activeDealsCount: transactions?.length || 0,
    generatedAt: new Date().toISOString()
  }
}


export async function generateStrategicInsight(briefingData, userName) {
  const geminiApiKey = process.env.GEMINI_API_KEY
  
  const prompt = `You are Aureum AI, analyzing ${userName}'s real estate business.

DATA:
- Active deals: ${briefingData.activeDealsCount}
- Overdue: ${briefingData.overdue.length}
- Due today: ${briefingData.today.length}
- Due tomorrow: ${briefingData.tomorrow.length}

Generate ONE actionable insight (40 words max) that:
1. Identifies a pattern or opportunity
2. Suggests a specific action
3. Is encouraging and strategic

Examples:
- "With 3 deals closing soon, consider preparing referral requests now while clients are excited."
- "No urgent tasks today - perfect time to reach out to cold leads or update your marketing."
- "Multiple inspections this week suggest strong market activity. Time to prospect for new listings?"

Be specific, actionable, and professional. No generic advice.`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 100
          }
        })
      }
    )

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch (error) {
    console.error('Strategic insight error:', error)
    return null
  }
}


export async function generateAISummary(briefingData, userName) {
  const geminiApiKey = process.env.GEMINI_API_KEY
  
  // Calculate priority
  const urgentCount = briefingData.overdue.length + briefingData.today.length
  const urgencyLevel = urgentCount === 0 ? 'light' : urgentCount <= 2 ? 'moderate' : 'high'
  
  // Build deadline lists
  const todayList = briefingData.today.length > 0 
    ? briefingData.today.map(d => `• ${d.title} - ${d.transactions.property_address} (${d.transactions.clients.name})`).join('\n')
    : '• None - all caught up!'
  
  const tomorrowList = briefingData.tomorrow.length > 0
    ? briefingData.tomorrow.map(d => `• ${d.title} - ${d.transactions.property_address} (${d.transactions.clients.name})`).join('\n')
    : '• Nothing scheduled'
  
  const overdueList = briefingData.overdue.length > 0
    ? '\n⚠️ OVERDUE ITEMS NEED ATTENTION:\n' + briefingData.overdue.map(d => `• ${d.title} - ${d.transactions.property_address} (${d.transactions.clients.name})`).join('\n')
    : ''
  
  const prompt = `You are Aureum, an AI assistant for real estate agent ${userName}.

CONTEXT:
- Active deals in progress: ${briefingData.activeDealsCount}
- Overdue items: ${briefingData.overdue.length}
- Today's deadlines: ${briefingData.today.length}  
- Tomorrow's tasks: ${briefingData.tomorrow.length}
- Urgency level: ${urgencyLevel}

TODAY'S DEADLINES:
${todayList}

TOMORROW'S PREP:
${tomorrowList}
${overdueList}

Write a concise daily briefing (max 120 words):
1. Warm, professional greeting
2. Highlight most urgent item if any
3. Today's priority actions
4. Tomorrow's prep reminder
5. Motivating close

Tone: Confident, supportive, action-oriented. Use emojis (max 3). Be specific about properties/clients.`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 200
          }
        })
      }
    )

    const data = await response.json()
    
    if (data.candidates && data.candidates[0]) {
      return data.candidates[0].content.parts[0].text
    } else {
      throw new Error('No response from Gemini')
    }
  } catch (error) {
    console.error('Gemini API error:', error)
    // Fallback if AI fails
    return `Good morning, ${userName}! 

You have ${briefingData.today.length} tasks due today and ${briefingData.activeDealsCount} active deals in progress. 

${urgentCount > 0 ? 'Focus on your urgent deadlines first.' : 'You are all caught up - great work!'}

Stay organized and make it a productive day!`
  }
}