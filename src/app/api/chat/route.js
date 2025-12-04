// app/api/chat/route.js - IMPROVED VERSION
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const CONVERSATION_LIMIT = 10 // Increased for better context

// [Keep all TOOLS definitions - lines 18-205 from original]
const TOOLS = [
  {
    type: "function",
    function: {
      name: "send_email_briefing",
      description: "Sends an email briefing with today's and tomorrow's deadlines to the user",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_sms_briefing",
      description: "Sends an SMS text message briefing to the user's phone",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_transaction",
      description: "Creates a new real estate transaction for a client. The contract date will be set to today.",
      parameters: {
        type: "object",
        properties: {
          client_name: {
            type: "string",
            description: "Name of the client for this transaction"
          },
          property_address: {
            type: "string",
            description: "Full address of the property"
          },
          transaction_type: {
            type: "string",
            enum: ["buyer", "seller"],
            description: "Whether this is a buyer or seller transaction"
          },
          closing_date: {
            type: "string",
            description: "Expected closing date in YYYY-MM-DD format"
          }
        },
        required: ["client_name", "property_address", "transaction_type", "closing_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_client",
      description: "Adds a new client to the CRM system",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Client's full name"
          },
          email: {
            type: "string",
            description: "Client's email address"
          },
          phone: {
            type: "string",
            description: "Client's phone number"
          },
          status: {
            type: "string",
            enum: ["hot", "warm", "cold"],
            description: "Client's lead status (hot=ready to buy/sell, warm=interested, cold=just browsing)"
          }
        },
        required: ["name", "status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_client_status",
      description: "Updates a client's lead status (hot/warm/cold)",
      parameters: {
        type: "object",
        properties: {
          client_name: {
            type: "string",
            description: "Name of the client to update"
          },
          new_status: {
            type: "string",
            enum: ["hot", "warm", "cold"],
            description: "New status for the client"
          }
        },
        required: ["client_name", "new_status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_client",
      description: "Deletes a client from the CRM",
      parameters: {
        type: "object",
        properties: {
          client_name: {
            type: "string",
            description: "Name of the client to delete"
          }
        },
        required: ["client_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "mark_deadline_complete",
      description: "Marks a deadline/task as completed",
      parameters: {
        type: "object",
        properties: {
          deadline_title: {
            type: "string",
            description: "The title of the deadline to mark complete"
          }
        },
        required: ["deadline_title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_briefing_schedule",
      description: "Sets up automated email briefings at a specific time. User can choose daily or weekly frequency.",
      parameters: {
        type: "object",
        properties: {
          frequency: {
            type: "string",
            enum: ["daily", "weekly"],
            description: "How often to send briefings"
          },
          time: {
            type: "string",
            description: "Time to send briefing in HH:MM format (24-hour, e.g., '06:00' for 6 AM)"
          },
          day_of_week: {
            type: "number",
            description: "For weekly: day of week (0=Sunday, 1=Monday, etc.). Not needed for daily.",
            minimum: 0,
            maximum: 6
          }
        },
        required: ["frequency", "time"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_client_brief",
      description: "Generates a personalized brief for a specific client",
      parameters: {
        type: "object",
        properties: {
          client_name: {
            type: "string",
            description: "Name of the client"
          }
        },
        required: ["client_name"]
      }
    }
  }
]

export async function POST(request) {
  try {
    const { userId, message, sessionId } = await request.json()

    if (!userId || !message) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing userId or message' 
      }, { status: 400 })
    }

    // Detect greeting vs substantive query
    const isGreeting = detectGreeting(message)

    // Get context intelligently - skip if just a greeting
    let context = null
    if (!isGreeting) {
      context = await getUserContext(userId)
    }

    // Get conversation history from the current session only
    const history = sessionId ? await getSessionHistory(sessionId) : []

    // Call OpenAI with tools
    const response = await callOpenAIWithTools(userId, message, context, history, isGreeting)

    return NextResponse.json({ 
      success: true, 
      response: response 
    })

  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 })
  }
}

// Detect if message is a greeting/casual chat
function detectGreeting(message) {
  const greetings = [
    'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
    'sup', 'yo', 'howdy', "what's up", 'whats up', 'how are you', 'hows it going'
  ]
  
  const lowerMsg = message.toLowerCase().trim()
  
  // Check if message is short and matches greetings
  if (lowerMsg.length < 30) {
    return greetings.some(g => lowerMsg.includes(g))
  }
  
  return false
}

// Get session-specific history (not global)
async function getSessionHistory(sessionId) {
  const { data } = await supabase
    .from('chat_history')
    .select('role, message')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(CONVERSATION_LIMIT)

  if (!data || data.length === 0) return []

  // Reverse to get chronological order
  return data.reverse().map(msg => ({
    role: msg.role,
    content: msg.message
  }))
}

async function callOpenAIWithTools(userId, userMessage, context, history, isGreeting) {
  const systemPrompt = buildSystemPrompt(context, isGreeting)

  if (!process.env.OPENAI_API_KEY) {
    return "I'm currently unavailable. Please configure the OPENAI_API_KEY environment variable."
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage }
  ]

  // First API call
  let completion = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Faster model
    messages: messages,
    tools: TOOLS,
    tool_choice: "auto",
    temperature: 0.7,
    max_tokens: 500 // Reduced for faster responses
  })

  let responseMessage = completion.choices[0].message

  // Handle tool calls
  while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
    messages.push(responseMessage)

    for (const toolCall of responseMessage.tool_calls) {
      const functionName = toolCall.function.name
      const functionArgs = JSON.parse(toolCall.function.arguments)

      console.log(`Executing tool: ${functionName}`, functionArgs)

      let functionResponse
      try {
        functionResponse = await executeFunction(userId, functionName, functionArgs)
      } catch (error) {
        functionResponse = { 
          success: false, 
          message: `Error executing ${functionName}: ${error.message}` 
        }
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(functionResponse)
      })
    }

    // Get final response after tool execution
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 500
    })

    responseMessage = completion.choices[0].message
  }

  return responseMessage.content
}

// [Keep all executeFunction and tool handlers - lines 241-600 from original]
async function executeFunction(userId, functionName, args) {
  switch (functionName) {
    case 'send_email_briefing':
      return await sendEmailBriefing(userId)
    case 'send_sms_briefing':
      return await sendSMSBriefing(userId)
    case 'create_transaction':
      return await createTransaction(userId, args)
    case 'add_client':
      return await addClient(userId, args)
    case 'update_client_status':
      return await updateClientStatus(userId, args)
    case 'delete_client':
      return await deleteClient(userId, args)
    case 'mark_deadline_complete':
      return await markDeadlineComplete(userId, args)
    case 'set_briefing_schedule':
      return await setBriefingSchedule(userId, args)
    case 'generate_client_brief':
      return await generateClientBrief(userId, args)
    default:
      return { success: false, message: `Unknown function: ${functionName}` }
  }
}

// Tool implementations
async function sendEmailBriefing(userId) {
  // Fetch user email
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('user_id', userId)
    .single()

  if (!profile?.email) {
    return { success: false, message: "No email found for user" }
  }

  const context = await getUserContext(userId)
  
  const upcomingDeadlines = context.deadlines
    .filter(d => new Date(d.due_date) <= new Date(Date.now() + 2 * 24 * 60 * 60 * 1000))
    .map(d => `• ${d.title} - ${d.transactions.property_address} (${d.transactions.clients.name}) - Due: ${d.due_date}`)
    .join('\n')

  const emailContent = `Daily Briefing for ${new Date().toLocaleDateString()}\n\nUpcoming Deadlines:\n${upcomingDeadlines || 'No deadlines in next 2 days'}\n\nActive Transactions: ${context.transactions.length}\nHot Leads: ${context.clients.filter(c => c.status === 'hot').length}`

  console.log(`📧 Sending email briefing to ${profile.email}`)
  console.log(emailContent)

  return {
    success: true,
    message: `✅ Email briefing sent to ${profile.email}!\n\n${emailContent}`
  }
}

async function sendSMSBriefing(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('user_id', userId)
    .single()

  if (!profile?.phone) {
    return { success: false, message: "No phone number found" }
  }

  const context = await getUserContext(userId)
  
  const urgentCount = context.deadlines.filter(d => 
    new Date(d.due_date) <= new Date(Date.now() + 24 * 60 * 60 * 1000)
  ).length

  const smsContent = `NAVIUS Brief: ${urgentCount} urgent deadline(s), ${context.transactions.length} active deals, ${context.clients.filter(c => c.status === 'hot').length} hot leads. Check dashboard for details.`

  console.log(`📱 Sending SMS to ${profile.phone}`)
  console.log(smsContent)

  return {
    success: true,
    message: `✅ SMS sent to ${profile.phone}!\n\n${smsContent}`
  }
}

async function createTransaction(userId, args) {
  const { client_name, property_address, transaction_type, closing_date } = args

  // Find or create client
  let { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', `%${client_name}%`)
    .single()

  if (!client) {
    const { data: newClient } = await supabase
      .from('clients')
      .insert([{ 
        user_id: userId, 
        name: client_name, 
        status: 'hot' 
      }])
      .select()
      .single()
    
    client = newClient
  }

  // Create transaction
  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert([{
      user_id: userId,
      client_id: client.id,
      property_address,
      transaction_type,
      contract_date: new Date().toISOString().split('T')[0],
      closing_date,
      status: 'active'
    }])
    .select()
    .single()

  if (error) {
    return { success: false, message: `Failed to create transaction: ${error.message}` }
  }

  return {
    success: true,
    message: `✅ Created ${transaction_type} transaction for **${client_name}** at ${property_address}. Closing date: ${closing_date}.`
  }
}

async function addClient(userId, args) {
  const { name, email, phone, status } = args

  const { data, error } = await supabase
    .from('clients')
    .insert([{
      user_id: userId,
      name,
      email: email || null,
      phone: phone || null,
      status: status || 'cold'
    }])
    .select()
    .single()

  if (error) {
    return { success: false, message: `Failed to add client: ${error.message}` }
  }

  return {
    success: true,
    message: `✅ Added **${name}** as a ${status} lead!${email ? ` Email: ${email}` : ''}${phone ? ` Phone: ${phone}` : ''}`
  }
}

async function updateClientStatus(userId, args) {
  const { client_name, new_status } = args

  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('user_id', userId)
    .ilike('name', `%${client_name}%`)
    .single()

  if (!client) {
    return { success: false, message: `Couldn't find a client named "${client_name}"` }
  }

  await supabase
    .from('clients')
    .update({ status: new_status })
    .eq('id', client.id)

  return {
    success: true,
    message: `✅ Updated **${client.name}** to ${new_status} status!`
  }
}

async function deleteClient(userId, args) {
  const { client_name } = args

  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('user_id', userId)
    .ilike('name', `%${client_name}%`)
    .single()

  if (!client) {
    return { success: false, message: `Couldn't find a client named "${client_name}"` }
  }

  await supabase
    .from('clients')
    .delete()
    .eq('id', client.id)

  return {
    success: true,
    message: `✅ Deleted **${client.name}** from your CRM.`
  }
}

async function markDeadlineComplete(userId, args) {
  const { deadline_title } = args

  const { data: deadline } = await supabase
    .from('timeline_items')
    .select('id, title')
    .eq('user_id', userId)
    .ilike('title', `%${deadline_title}%`)
    .single()

  if (!deadline) {
    return { success: false, message: `Couldn't find deadline: "${deadline_title}"` }
  }

  await supabase
    .from('timeline_items')
    .update({ status: 'completed' })
    .eq('id', deadline.id)

  return {
    success: true,
    message: `✅ Marked **${deadline.title}** as complete!`
  }
}

async function setBriefingSchedule(userId, args) {
  const { frequency, time, day_of_week } = args

  const scheduleText = frequency === 'daily' 
    ? `daily at ${time}`
    : `weekly on ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day_of_week]} at ${time}`

  console.log(`Setting briefing schedule for user ${userId}: ${scheduleText}`)

  return {
    success: true,
    message: `✅ Set up automated email briefings ${scheduleText}! You'll receive your first one at the scheduled time.`
  }
}

// IMPROVED: Faster context fetching
async function getUserContext(userId) {
  // Fetch only essential, recent data
  const [
    { data: deadlines },
    { data: transactions },
    { data: clients }
  ] = await Promise.all([
    supabase
      .from('timeline_items')
      .select(`
        title,
        due_date,
        status,
        transactions!inner (
          property_address,
          clients!inner (name)
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('due_date', new Date().toISOString().split('T')[0])
      .order('due_date', { ascending: true })
      .limit(10), // Reduced from 20
    
    supabase
      .from('transactions')
      .select(`
        property_address,
        transaction_type,
        closing_date,
        clients!inner (name)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(10), // Reduced from 20
    
    supabase
      .from('clients')
      .select('name, status, email, phone')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5) // Only most recent 5 clients
  ])

  return {
    deadlines: deadlines || [],
    transactions: transactions || [],
    clients: clients || []
  }
}

// IMPROVED: Context-aware system prompt
function buildSystemPrompt(context, isGreeting) {
  // For greetings, keep it simple
  if (isGreeting || !context) {
    return `You are NAVIUS, an elite AI assistant for real estate agents.

You're friendly, professional, and action-oriented. 

When someone greets you:
- Respond warmly and naturally
- Ask how you can help them today
- Don't dump their business data unless they ask for it

Be concise and personable!`
  }

  // For substantive queries, provide full context
  const deadlinesList = context.deadlines.length > 0
    ? context.deadlines.slice(0, 5).map(d => 
        `- ${d.title} for ${d.transactions.property_address} (${d.transactions.clients.name}) - Due: ${d.due_date}`
      ).join('\n')
    : '- No urgent deadlines'

  const transactionsList = context.transactions.length > 0
    ? context.transactions.slice(0, 5).map(t => 
        `- ${t.property_address} (${t.clients.name}) - ${t.transaction_type}, closes ${t.closing_date}`
      ).join('\n')
    : '- No active transactions'

  const clientsList = context.clients.length > 0
    ? context.clients.map(c => 
        `- ${c.name} (${c.status})${c.email ? ` - ${c.email}` : ''}${c.phone ? ` - ${c.phone}` : ''}`
      ).join('\n')
    : '- No recent clients'

  return `You are NAVIUS, an elite AI assistant and real estate expert.

## YOUR ROLE
You help real estate agents:
- Take ACTION using your tools (send briefings, manage clients, create deals, mark tasks complete)
- Provide expert real estate advice on sales, negotiation, marketing, and transactions
- Analyze their business and suggest strategic improvements

## CURRENT BUSINESS DATA

📊 Active Transactions (${context.transactions.length} total):
${transactionsList}

⏰ Upcoming Deadlines (${context.deadlines.length} pending):
${deadlinesList}

👥 Recent Clients (${context.clients.length} total):
${clientsList}

## RESPONSE STYLE

**CRITICAL RULES:**
1. **Be concise** - Get to the point quickly
2. **Be specific** - Reference actual clients, properties, dates from THEIR data above
3. **Take action** - When they ask you to DO something, use your tools immediately
4. **Stay relevant** - Only mention business data when it's relevant to their question
5. **Use markdown** - Bold names/dates, use bullets for lists

Examples:
❌ "You can add a client by..."
✅ "I'll add Sarah right now!" [calls add_client tool]

❌ Long generic advice about real estate
✅ "For your ${context.transactions[0]?.property_address || 'property'} deal, try..."

❌ Dumping all their data unsolicited
✅ Only reference their data when answering their specific question

Be their trusted advisor - professional, proactive, and genuinely helpful!`
}

async function generateClientBrief(userId, args) {
  // [Keep original implementation from lines 702-848]
  const { client_name } = args

  try {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .ilike('name', `%${client_name}%`)
      .single()

    if (clientError || !client) {
      return { 
        success: false,
        message: `I couldn't find a client named "${client_name}". Please check the spelling or try a different name.` 
      }
    }

    if (client.brief_content && client.brief_generated_at) {
      const briefAge = Date.now() - new Date(client.brief_generated_at).getTime()
      const twentyFourHours = 24 * 60 * 60 * 1000
      
      if (briefAge < twentyFourHours) {
        return {
          success: true,
          message: `Here's the brief for **${client.name}**:\n\n${client.brief_content}\n\n*(Generated ${new Date(client.brief_generated_at).toLocaleString()})*`
        }
      }
    }

    const [
      { data: keyNotes },
      { data: unreadMessages },
      { data: recentConversations },
      { data: activeTransactions }
    ] = await Promise.all([
      supabase
        .from('client_notes')
        .select('note')
        .eq('client_id', client.id)
        .eq('is_key_note', true),
      
      supabase
        .from('client_messages')
        .select('*')
        .eq('client_id', client.id)
        .eq('is_read', false),
      
      supabase
        .from('conversation_summaries')
        .select('*')
        .eq('client_id', client.id)
        .order('conversation_date', { ascending: false })
        .limit(1),
      
      supabase
        .from('transactions')
        .select('property_address, status')
        .eq('client_id', client.id)
        .eq('status', 'active')
    ])

    let engagementPattern = "Engagement pattern unknown"
    if (client.avg_response_time) {
      if (client.avg_response_time < 180) {
        engagementPattern = "responds quickly, typically within a couple hours"
      } else if (client.avg_response_time < 1440) {
        engagementPattern = "responds within a day"
      } else {
        engagementPattern = "takes several days to respond"
      }
    }

    const propertyDetails = client.property_preferences 
      ? `${client.property_preferences.type || 'property'} in ${client.property_preferences.location || 'the area'}${
          client.property_preferences.budget_min 
            ? ` ($${(client.property_preferences.budget_min / 1000)}k-$${(client.property_preferences.budget_max / 1000)}k budget)`
            : ''
        }`
      : "property details not yet specified"

    const lastConvo = recentConversations?.[0]?.summary || "no recent conversations recorded"
    const unopenedMsg = unreadMessages?.length > 0 
      ? `You have ${unreadMessages.length} unopened message(s) from them. `
      : ""
    const keyNotesText = keyNotes?.length > 0 
      ? keyNotes.map(n => n.note).join('; ') 
      : ""
    const contactPrefs = client.contact_preferences?.preferred_times?.join(', ') || "not set"

    const prompt = `Write a concise, professional client brief (80-120 words) for a real estate agent about their client.

CLIENT INFO:
- Name: ${client.name}
- Type: ${client.lead_type || 'buyer'}
- Status: ${client.status} lead
- AI Ranking: ${client.ai_ranking || 'medium'}
- Looking for: ${propertyDetails}
- Engagement: ${engagementPattern}
- Unopened messages: ${unreadMessages?.length || 0}
- Last conversation: ${lastConvo}
- Key notes: ${keyNotesText || 'none'}
- Contact preferences: ${contactPrefs}
- Active transactions: ${activeTransactions?.length || 0}

Format exactly like this:
"${client.name} is a ${client.status}, ${client.ai_ranking || 'medium'}-ranking ${client.lead_type || 'buyer'} interested in ${propertyDetails}. ${client.name} ${engagementPattern}. ${unopenedMsg}Your last conversation involved ${lastConvo}. ${keyNotesText ? keyNotesText + '. ' : ''}${contactPrefs !== 'not set' ? 'Prefers contact during ' + contactPrefs + '. ' : ''}Overall momentum is [assess as strong/steady/slowing]; [recommend specific next action]."

Be specific. Use natural language. Sound professional but warm.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 250
    })

    const generatedBrief = completion.choices[0].message.content

    await supabase
      .from('clients')
      .update({
        brief_content: generatedBrief,
        brief_generated_at: new Date().toISOString()
      })
      .eq('id', client.id)

    return {
      success: true,
      message: `**Client Brief — ${client.name}**\n\n${generatedBrief}`
    }

  } catch (error) {
    console.error('Error generating client brief:', error)
    return {
      success: false,
      message: "I encountered an error generating the brief. Please try again."
    }
  }
}