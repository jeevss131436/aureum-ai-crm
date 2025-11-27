// app/api/chat/route.js - Complete OpenAI Version with All Features
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

const CONVERSATION_LIMIT = 5

// Comprehensive tool definitions
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
  }
  ,
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
    const { userId, message } = await request.json()

    if (!userId || !message) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing userId or message' 
      }, { status: 400 })
    }

    // Get context and history
    const [context, history] = await Promise.all([
      getUserContext(userId),
      getConversationHistory(userId)
    ])

    // Call OpenAI with tools
    const response = await callOpenAIWithTools(userId, message, context, history)

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

async function callOpenAIWithTools(userId, userMessage, context, history) {
  const systemPrompt = buildSystemPrompt(context)

  if (!process.env.OPENAI_API_KEY) {
    return "I'm currently unavailable. Please configure the OPENAI_API_KEY environment variable."
  }

  // Format conversation history
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.message
    })),
    { role: "user", content: userMessage }
  ]

  let attempts = 0
  const maxAttempts = 5

  while (attempts < maxAttempts) {
    attempts++

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 1500
      })

      const responseMessage = completion.choices[0].message

      // Check for function calls
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        const toolCall = responseMessage.tool_calls[0]
        console.log('Function call detected:', toolCall.function.name)

        // Execute the function
        const functionArgs = JSON.parse(toolCall.function.arguments)
        const toolResult = await executeToolCall(
          userId,
          toolCall.function.name,
          functionArgs
        )

        // Add assistant's function call to messages
        messages.push(responseMessage)

        // Add function result to messages
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        })

        // Continue loop to get final text response
        continue
      }

      // No function call - return text response
      return responseMessage.content || "I processed your request but couldn't generate a response."

    } catch (error) {
      console.error('OpenAI API error:', error)
      if (error.code === 'insufficient_quota') {
        return "I've run out of API quota. Please add credits to your OpenAI account."
      }
      throw error
    }
  }

  return "I tried multiple times but couldn't complete your request. Please try rephrasing."
}

async function executeToolCall(userId, toolName, args) {
  console.log(`Executing tool: ${toolName}`, args)

  try {
    switch (toolName) {
      case 'send_email_briefing':
        try {
          const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send-briefing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
          })
          const emailData = await emailResponse.json()
          return { 
            success: emailData.success, 
            message: emailData.success ? 'Email briefing sent successfully! Check your inbox.' : emailData.error 
          }
        } catch (error) {
          return { success: false, message: `Failed to send email: ${error.message}` }
        }

      case 'send_sms_briefing':
        try {
          const smsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send-sms-briefing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
          })
          const smsData = await smsResponse.json()
          return { 
            success: smsData.success, 
            message: smsData.success ? 'SMS briefing sent successfully! Check your phone.' : smsData.error 
          }
        } catch (error) {
          return { success: false, message: `Failed to send SMS: ${error.message}` }
        }

      case 'create_transaction':
        // Find or create client
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', args.client_name)
          .single()

        let clientId = existingClient?.id

        if (!clientId) {
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert([{
              user_id: userId,
              name: args.client_name,
              status: 'warm'
            }])
            .select()
            .single()

          if (clientError) throw clientError
          clientId = newClient.id
        }

        const today = new Date().toISOString().split('T')[0]
        
        const { data: transaction, error: transError } = await supabase
          .from('transactions')
          .insert([{
            user_id: userId,
            client_id: clientId,
            property_address: args.property_address,
            transaction_type: args.transaction_type,
            contract_date: today,
            closing_date: args.closing_date,
            status: 'active'
          }])
          .select()
          .single()

        if (transError) throw transError

        // Generate timeline
        const timeline = generateTimeline(today, args.closing_date)
        await supabase.from('timeline_items').insert(
          timeline.map(item => ({
            transaction_id: transaction.id,
            ...item
          }))
        )

        return { 
          success: true, 
          transaction_id: transaction.id, 
          message: `✅ Transaction created for ${args.client_name} at ${args.property_address}. Timeline with ${timeline.length} milestones has been set up.` 
        }

      case 'add_client':
        const { data: client, error: clientErr } = await supabase
          .from('clients')
          .insert([{
            user_id: userId,
            name: args.name,
            email: args.email || null,
            phone: args.phone || null,
            status: args.status || 'warm'
          }])
          .select()
          .single()

        if (clientErr) throw clientErr
        return { 
          success: true, 
          client_id: client.id, 
          message: `✅ Client "${args.name}" added successfully as a ${args.status} lead!` 
        }

      case 'update_client_status':
        const { data: clientToUpdate } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', args.client_name)
          .single()

        if (!clientToUpdate) {
          return { success: false, message: `Client "${args.client_name}" not found` }
        }

        const { error: updateError } = await supabase
          .from('clients')
          .update({ status: args.new_status })
          .eq('id', clientToUpdate.id)

        if (updateError) throw updateError

        return { 
          success: true, 
          message: `✅ Updated "${args.client_name}" to ${args.new_status} status` 
        }

      case 'delete_client':
        const { data: clientToDelete } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', args.client_name)
          .single()

        if (!clientToDelete) {
          return { success: false, message: `Client "${args.client_name}" not found` }
        }

        const { error: deleteError } = await supabase
          .from('clients')
          .delete()
          .eq('id', clientToDelete.id)

        if (deleteError) throw deleteError

        return { 
          success: true, 
          message: `✅ Client "${args.client_name}" has been deleted` 
        }

      case 'mark_deadline_complete':
        const { data: deadlines } = await supabase
          .from('timeline_items')
          .select(`
            *,
            transactions!inner (user_id)
          `)
          .eq('transactions.user_id', userId)
          .ilike('title', `%${args.deadline_title}%`)
          .limit(1)

        if (!deadlines || deadlines.length === 0) {
          return { success: false, message: `Deadline "${args.deadline_title}" not found` }
        }

        const { error: updateErr } = await supabase
          .from('timeline_items')
          .update({ completed: true })
          .eq('id', deadlines[0].id)

        if (updateErr) throw updateErr
        return { 
          success: true, 
          message: `✅ Marked "${deadlines[0].title}" as complete!` 
        }

      case 'set_briefing_schedule':
        const scheduleData = {
          email_enabled: true,
          email_frequency: args.frequency,
          email_time: args.time,
          email_day: args.day_of_week || 1,
          timezone: 'America/New_York' // You can make this dynamic later
        }

        const { error: scheduleError } = await supabase.auth.admin.updateUserById(
          userId,
          {
            user_metadata: {
              briefing_preferences: scheduleData
            }
          }
        )

        if (scheduleError) throw scheduleError

        const scheduleText = args.frequency === 'daily' 
          ? `every day at ${args.time}` 
          : `every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][args.day_of_week || 1]} at ${args.time}`

        return { 
          success: true, 
          message: `✅ Briefing schedule set! You'll receive automated email briefings ${scheduleText}.` 
        }

      case 'generate_client_brief':
        return await generateClientBrief(userId, args)

      default:
        return { success: false, message: `Unknown tool: ${toolName}` }
    }
  } catch (error) {
    console.error(`Error executing ${toolName}:`, error)
    return { success: false, message: error.message }
  }
}

function generateTimeline(contractDate, closingDate) {
  const contract = new Date(contractDate)
  const closing = new Date(closingDate)
  const totalDays = Math.ceil((closing - contract) / (1000 * 60 * 60 * 24))
  
  const timeline = [
    { title: 'Contract Signed', description: 'Purchase agreement executed', days_offset: 0, item_order: 1 },
    { title: 'Home Inspection', description: 'Schedule and complete home inspection', days_offset: 7, item_order: 2 },
    { title: 'Inspection Response', description: 'Respond to inspection findings', days_offset: 10, item_order: 3 },
    { title: 'Appraisal', description: 'Property appraisal completed', days_offset: 14, item_order: 4 },
    { title: 'Loan Approval', description: 'Final loan approval from lender', days_offset: Math.floor(totalDays * 0.7), item_order: 5 },
    { title: 'Final Walkthrough', description: 'Buyer final property walkthrough', days_offset: totalDays - 2, item_order: 6 },
    { title: 'Closing Day', description: 'Sign documents and transfer ownership', days_offset: totalDays, item_order: 7 }
  ]

  return timeline.map(item => {
    const dueDate = new Date(contract)
    dueDate.setDate(dueDate.getDate() + item.days_offset)
    return {
      ...item,
      due_date: dueDate.toISOString().split('T')[0]
    }
  })
}

async function getConversationHistory(userId) {
  const { data: history } = await supabase
    .from('chat_history')
    .select('role, message')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(CONVERSATION_LIMIT)

  return history || []
}

async function getUserContext(userId) {
  const today = new Date().toISOString().split('T')[0]
  
  const { data: deadlines } = await supabase
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
    .gte('due_date', today)
    .order('due_date')
    .limit(10)

  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      *,
      clients (name, email, phone)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(20)

  const { data: clients } = await supabase
    .from('clients')
    .select('name, status, email, phone, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  return {
    deadlines: deadlines || [],
    transactions: transactions || [],
    clients: clients || []
  }
}

function buildSystemPrompt(context) {
  const deadlinesList = context.deadlines.length > 0
    ? context.deadlines.map(d => 
        `- ${d.title} for ${d.transactions.property_address} (${d.transactions.clients.name}) - Due: ${d.due_date}`
      ).join('\n')
    : '- No upcoming deadlines'

  const transactionsList = context.transactions.length > 0
    ? context.transactions.map(t => 
        `- ${t.property_address} (${t.clients.name}) - ${t.transaction_type} deal, closes ${t.closing_date}`
      ).join('\n')
    : '- No active transactions'

  const clientsList = context.clients.length > 0
    ? context.clients.map(c => 
        `- ${c.name} (${c.status}) ${c.email ? `- ${c.email}` : ''}${c.phone ? ` - ${c.phone}` : ''}`
      ).join('\n')
    : '- No clients yet'

  return `You are NAVIUS, an elite AI assistant and real estate expert helping agents close more deals and manage their business effectively.

## YOUR CAPABILITIES

### 1. TAKE ACTIONS (Use your tools proactively!)
When users ask you to DO something, USE YOUR TOOLS immediately:
- **Send briefings**: email or SMS with deadlines and priorities
- **Manage clients**: add new clients, update their status (hot/warm/cold), or delete them
- **Create transactions**: set up new deals with automatic timeline generation
- **Mark tasks complete**: check off completed deadlines
- **Schedule briefings**: set up automated daily/weekly email briefings at specific times

### 2. PROVIDE EXPERT REAL ESTATE ADVICE
You are deeply knowledgeable about:
- **Sales & Negotiation**: Closing techniques, objection handling, pricing strategies, competitive market analysis
- **Lead Generation**: Prospecting methods, sphere of influence, networking, digital marketing, cold calling
- **Client Management**: Building rapport, understanding buyer/seller psychology, managing expectations
- **Transaction Process**: Contract details, inspection contingencies, financing options, title/escrow
- **Market Knowledge**: Understanding market cycles, reading CMAs, pricing strategies, investment analysis
- **Legal/Compliance**: Disclosure requirements, fair housing laws, agency relationships, ethics
- **Marketing**: Listing presentations, open houses, staging advice, social media strategies
- **Business Development**: Building a brand, time management, building a team, scaling operations

### 3. ANALYZE USER'S BUSINESS
Review their data and provide strategic insights about opportunities, risks, and next actions.

## USER'S CURRENT BUSINESS DATA

Active Transactions:
${transactionsList}

Upcoming Deadlines:
${deadlinesList}

Recent Clients:
${clientsList}

## RESPONSE STYLE

- **Be proactive**: If you see they have urgent deadlines, suggest sending a briefing
- **Be specific**: Reference actual properties, clients, and dates from their data
- **Use markdown**: Bold key points, use bullet lists for clarity
- **Be encouraging**: You're their business partner helping them succeed
- **Take action**: When they ask you to DO something, use your tools immediately - don't just explain how

Examples:
❌ "You can add a client by going to the clients page"
✅ "I'll add Sarah Johnson as a hot lead right now!" [uses add_client tool]

❌ "You should set up briefings"
✅ "Want me to set up daily email briefings at 6 AM? Just say yes!" [ready to use set_briefing_schedule]

Be concise, action-oriented, and genuinely helpful!`
}

async function generateClientBrief(userId, args) {
  const { client_name } = args

  try {
    // 1. Find the client
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

    // 2. Check if cached brief is fresh (< 24 hours)
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

    // 3. Gather data for brief
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

    // 4. Build engagement description
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

    // 5. Build property details
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

    // 6. Generate AI brief
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

    // 7. Cache the brief
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