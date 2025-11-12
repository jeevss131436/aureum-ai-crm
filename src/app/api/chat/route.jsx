// app/api/chat/route.js - Working Gemini AI Agent with Function Calling
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CONVERSATION_LIMIT = 10

// Tool definitions in Gemini's format
const TOOLS = [
  {
    function_declarations: [
      {
        name: "send_email_briefing",
        description: "Sends an email briefing with today's and tomorrow's deadlines to the user",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "send_sms_briefing",
        description: "Sends an SMS text message briefing to the user's phone",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
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
      },
      {
        name: "add_client",
        description: "Adds a new client to the CRM",
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
              description: "Client's lead status"
            }
          },
          required: ["name", "status"]
        }
      },
      {
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
    ]
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

    // Save user message
    await saveMessageToHistory(userId, 'user', message)
    
    // Get context and history
    const [context, history] = await Promise.all([
      getUserContext(userId),
      getConversationHistory(userId)
    ])

    // Call Gemini with function calling
    const response = await callGeminiWithTools(userId, message, context, history)

    // Save assistant response
    await saveMessageToHistory(userId, 'assistant', response)

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

async function callGeminiWithTools(userId, userMessage, context, history) {
  const systemPrompt = buildSystemPrompt(context)
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return "I'm currently unavailable. Please configure the GEMINI_API_KEY environment variable."
  }

  // Format conversation history for Gemini
  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.message }]
  }))

  // Add current user message
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  })

  let attempts = 0
  const maxAttempts = 5

  while (attempts < maxAttempts) {
    attempts++

    const payload = {
      contents: contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      tools: TOOLS,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Gemini API error:', errorData)
      return `I encountered an error: ${errorData.error?.message || 'Unknown error'}`
    }

    const data = await response.json()
    const candidate = data.candidates?.[0]
    const parts = candidate?.content?.parts || []

    // Check for function calls
    const functionCall = parts.find(part => part.functionCall)

    if (functionCall) {
      console.log('Function call detected:', functionCall.functionCall)

      // Execute the function
      const toolResult = await executeToolCall(
        userId, 
        functionCall.functionCall.name, 
        functionCall.functionCall.args || {}
      )

      // Add model's function call to history
      contents.push({
        role: 'model',
        parts: [{ functionCall: functionCall.functionCall }]
      })

      // Add function response to history
      contents.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: functionCall.functionCall.name,
            response: toolResult
          }
        }]
      })

      // Continue loop to get final text response
      continue
    }

    // No function call - return text response
    const textPart = parts.find(part => part.text)
    if (textPart) {
      return textPart.text
    }

    // Fallback
    return "I processed your request but couldn't generate a response."
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
            message: emailData.success ? 'Email briefing sent successfully' : emailData.error 
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
            message: smsData.success ? 'SMS briefing sent successfully' : smsData.error 
          }
        } catch (error) {
          return { success: false, message: `Failed to send SMS: ${error.message}` }
        }

      case 'create_transaction':
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
          message: `Transaction created for ${args.client_name} at ${args.property_address}` 
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
          message: `Client ${args.name} added successfully` 
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
          return { success: false, message: 'Deadline not found' }
        }

        const { error: updateErr } = await supabase
          .from('timeline_items')
          .update({ completed: true })
          .eq('id', deadlines[0].id)

        if (updateErr) throw updateErr
        return { 
          success: true, 
          message: `Marked "${deadlines[0].title}" as complete` 
        }

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

async function saveMessageToHistory(userId, role, message) {
  const { error } = await supabase
    .from('chat_history')
    .insert({ user_id: userId, role, message })
    
  if (error) console.error('Error saving message:', error)
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

### 1. TAKE ACTIONS (Use your tools when appropriate)
- Send email/SMS briefings about deadlines
- Create new transactions with automatic timeline generation
- Add new clients to the CRM
- Mark tasks/deadlines as complete
- When a user asks you to DO something, USE YOUR TOOLS immediately

### 2. PROVIDE EXPERT REAL ESTATE ADVICE
You are deeply knowledgeable about:
- **Sales & Negotiation**: Closing techniques, objection handling, pricing strategies, competitive market analysis
- **Lead Generation**: Prospecting methods, sphere of influence, networking, digital marketing, cold calling scripts
- **Client Management**: Building rapport, understanding buyer/seller psychology, managing expectations
- **Transaction Process**: Contract details, inspection contingencies, financing options, title/escrow process
- **Market Knowledge**: Understanding market cycles, reading CMAs, pricing strategies, investment analysis
- **Legal/Compliance**: Disclosure requirements, fair housing laws, agency relationships, ethics
- **Marketing**: Listing presentations, open houses, staging advice, social media strategies
- **Business Development**: Building a brand, time management, building a team, scaling operations

### 3. ANALYZE USER'S BUSINESS
Review their current situation and provide strategic insights:
- Identify opportunities in their pipeline
- Suggest next actions for stale leads
- Warn about upcoming deadlines
- Recommend business improvements

## USER'S CURRENT BUSINESS DATA

Active Transactions:
${transactionsList}

Upcoming Deadlines:
${deadlinesList}

Recent Clients:
${clientsList}

## RESPONSE FORMATTING

**Use Markdown formatting for better readability:**
- Use **bold** for emphasis on key points
- Use bullet points for lists
- Use numbered lists for step-by-step instructions
- Keep paragraphs short (2-3 sentences max)
- Use line breaks between sections

**For Questions (What/How/Why/Explain):**
- Start with a direct answer
- Provide clear, actionable advice
- Use real estate examples
- Include specific strategies when helpful
- Keep responses focused and scannable

**For Action Requests (Send/Create/Add/Mark):**
- Use your tools immediately
- Confirm what you did in 1-2 sentences
- Be clear and concise

**For Business Analysis:**
- Use bullet points
- Be specific with property addresses and client names
- Prioritize by urgency

**Tone:** Professional yet conversational, like a trusted advisor. Be confident, practical, and encouraging.

**Length:** 
- General questions: 2-4 short paragraphs
- How-to guides: Numbered lists with brief explanations
- Action confirmations: 1-2 sentences
- Business reviews: Concise bullet points

Remember: Format responses for easy scanning. Use whitespace and markdown to improve readability.`
}