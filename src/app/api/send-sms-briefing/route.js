// app/api/chat/route.js - Enhanced AI Agent with Function Calling with Gemini
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Initialize the Google Gen AI Client
const ai = new GoogleGenAI({}) 

const CONVERSATION_LIMIT = 10

// --- Tool Definitions for Gemini API ---
// These are wrapped in an array of { function_declarations: [...] } for the API
const AVAILABLE_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "send_email_briefing",
        description: "Sends an email briefing with today's and tomorrow's deadlines to the user",
        parameters: {
          type: "object",
          properties: {},
        }
      },
      {
        name: "send_sms_briefing",
        description: "Sends an SMS text message briefing to the user's phone",
        parameters: {
          type: "object",
          properties: {},
        }
      },
      {
        name: "create_transaction",
        description: "Creates a new real estate transaction for a client",
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
            contract_date: {
              type: "string",
              description: "Contract date in YYYY-MM-DD format"
            },
            closing_date: {
              type: "string",
              description: "Expected closing date in YYYY-MM-DD format"
            }
          },
          required: ["client_name", "property_address", "transaction_type", "contract_date", "closing_date"]
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
            },
            notes: {
              type: "string",
              description: "Additional notes about the client"
            }
          },
          required: ["name"]
        }
      },
      {
        name: "update_deadline_status",
        description: "Marks a deadline/task as completed or incomplete",
        parameters: {
          type: "object",
          properties: {
            deadline_title: {
              type: "string",
              description: "The title of the deadline to update"
            },
            completed: {
              type: "boolean",
              description: "Whether the deadline is completed (true) or not (false)"
            }
          },
          required: ["deadline_title", "completed"]
        }
      },
      {
        name: "schedule_briefing",
        description: "Schedules automatic daily email or SMS briefings at a specific time",
        parameters: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["email", "sms"],
              description: "Type of briefing to schedule"
            },
            time: {
              type: "string",
              description: "Time in 24-hour format (HH:MM) like 09:00 for 9 AM"
            },
            enabled: {
              type: "boolean",
              description: "Whether to enable or disable the scheduled briefing"
            }
          },
          required: ["type", "enabled"]
        }
      }
    ]
  }
]

export async function POST(request) {
  try {
    const { userId, message } = await request.json()
    console.log('Chat request received:', { userId, message: message.substring(0, 100) })

    // Save user message
    // NOTE: This assumes the user is authenticated and userId is a valid auth.users.id
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

// CORRECTED function for Gemini to properly handle history and system prompt
async function callGeminiWithTools(userId, userMessage, context, history) {
  const systemPrompt = buildSystemPrompt(context)
  
  // 1. Format conversation history for Gemini (roles must be 'user' or 'model')
  const historyParts = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user', // Convert 'assistant' to 'model'
    parts: [{ text: msg.message }]
  }));
  
  // 2. Prepend the system prompt to the history as the very first 'user' part.
  // The first turn in the history array must contain the context/instructions.
  const initialUserMessage = {
      role: 'user',
      parts: [{ text: systemPrompt }]
  };

  // 3. Combine the initial instructions with the previous turns.
  const fullHistory = [initialUserMessage, ...historyParts];

  // 4. Create the chat session with the full history and tools
  const chat = ai.chats.create({
    model: 'gemini-2.5-pro',
    config: {
      tools: AVAILABLE_TOOLS,
    },
    // Pass the combined history for context
    history: fullHistory, 
  })
  
  // 5. Send the NEW user message (the current query)
  let result = await chat.sendMessage({
    role: 'user',
    parts: [{ text: userMessage }]
  })
  
  let toolUseCount = 0; // Guardrail to prevent infinite loop

  // Handle tool use (function calling)
  while (result.functionCalls && toolUseCount < 5) { // Check for functionCalls
    toolUseCount++;
    console.log('Gemini Function Call(s):', result.functionCalls)
    
    const functionResponses = []

    for (const funcCall of result.functionCalls) {
      const toolName = funcCall.name
      const toolArgs = funcCall.args
      
      console.log('Tool called:', toolName, toolArgs)

      // Execute the tool
      const toolResult = await executeToolCall(userId, toolName, toolArgs, context)

      // Collect the function response for the next turn
      functionResponses.push({
        functionResponse: {
          name: toolName,
          response: toolResult
        }
      })
    }

    // Send the function response back to Gemini to get the final text reply
    // The role MUST be 'tool' for function responses
    result = await chat.sendMessage({
      role: 'tool',
      parts: functionResponses
    })
  }

  // Extract final text response
  return result.text || "I've completed that action for you."
}

// --- Supabase Data Retrieval and System Prompt Building Functions ---

async function executeToolCall(userId, toolName, input, context) {
  console.log(`Executing tool: ${toolName}`, input)

  try {
    switch (toolName) {
      case 'send_email_briefing':
        // Assumes a separate /api/send-briefing route exists
        const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send-briefing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        })
        const emailData = await emailResponse.json()
        return { success: emailData.success, message: 'Email briefing sent successfully' }

      case 'send_sms_briefing':
        // Assumes a separate /api/send-sms-briefing route exists
        const smsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send-sms-briefing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        })
        const smsData = await smsResponse.json()
        return { success: smsData.success, message: 'SMS briefing sent successfully' }

      case 'create_transaction':
        // Find or create client first
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', input.client_name)
          .single()

        let clientId = existingClient?.id

        if (!clientId) {
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert([{
              user_id: userId,
              name: input.client_name,
              status: 'warm'
            }])
            .select()
            .single()

          if (clientError) throw clientError
          clientId = newClient.id
        }

        // Create transaction
        const { data: transaction, error: transError } = await supabase
          .from('transactions')
          .insert([{
            user_id: userId,
            client_id: clientId,
            property_address: input.property_address,
            transaction_type: input.transaction_type,
            contract_date: input.contract_date,
            closing_date: input.closing_date,
            status: 'active'
          }])
          .select()
          .single()

        if (transError) throw transError

        // Generate timeline items
        const timeline = generateTimeline(input.contract_date, input.closing_date)
        await supabase.from('timeline_items').insert(
          timeline.map(item => ({
            transaction_id: transaction.id,
            ...item
          }))
        )

        return { success: true, transaction_id: transaction.id, message: 'Transaction created successfully' }

      case 'add_client':
        const { data: client, error: clientErr } = await supabase
          .from('clients')
          .insert([{
            user_id: userId,
            name: input.name,
            email: input.email || null,
            phone: input.phone || null,
            status: input.status || 'warm',
            notes: input.notes || null
          }])
          .select()
          .single()

        if (clientErr) throw clientErr
        return { success: true, client_id: client.id, message: 'Client added successfully' }

      case 'update_deadline_status':
        // Find the deadline by title
        const { data: deadlines } = await supabase
          .from('timeline_items')
          .select(`
            *,
            transactions!inner (user_id)
          `)
          .eq('transactions.user_id', userId)
          .ilike('title', `%${input.deadline_title}%`)
          .limit(1)

        if (!deadlines || deadlines.length === 0) {
          return { success: false, message: 'Deadline not found' }
        }

        const { error: updateErr } = await supabase
          .from('timeline_items')
          .update({ completed: input.completed })
          .eq('id', deadlines[0].id)

        if (updateErr) throw updateErr
        return { success: true, message: `Deadline marked as ${input.completed ? 'completed' : 'incomplete'}` }

      case 'schedule_briefing':
        // Store scheduling preference in user metadata
        // Note: Supabase Admin access required for this, which SUPABASE_SERVICE_ROLE_KEY provides
        const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(userId)
        if (userErr) throw userErr

        const schedules = user.user_metadata?.briefing_schedules || {}
        schedules[input.type] = {
          enabled: input.enabled,
          time: input.time || '09:00'
        }

        const { error: updateUserErr } = await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...user.user_metadata,
            briefing_schedules: schedules
          }
        })

        if (updateUserErr) throw updateUserErr
        return { 
          success: true, 
          message: `${input.type} briefing ${input.enabled ? 'enabled' : 'disabled'}${input.time ? ` at ${input.time}` : ''}` 
        }

      default:
        return { success: false, message: 'Unknown tool' }
    }
  } catch (error) {
    console.error(`Error executing ${toolName}:`, error)
    return { success: false, error: error.message }
  }
}

function generateTimeline(contractDate, closingDate) {
  const contract = new Date(contractDate)
  const closing = new Date(closingDate)
  const totalDays = Math.ceil((closing - contract) / (1000 * 60 * 60 * 24))
  
  // Define standard real estate milestones
  const timeline = [
    { title: 'Contract Signed', description: 'Purchase agreement executed', days_offset: 0, item_order: 1 },
    { title: 'Home Inspection', description: 'Schedule and complete home inspection', days_offset: 7, item_order: 2 },
    { title: 'Inspection Response', description: 'Respond to inspection findings', days_offset: 10, item_order: 3 },
    { title: 'Appraisal', description: 'Property appraisal completed', days_offset: 14, item_order: 4 },
    { title: 'Loan Approval', description: 'Final loan approval from lender', days_offset: Math.floor(totalDays * 0.7), item_order: 5 },
    { title: 'Final Walkthrough', description: 'Buyer final property walkthrough', days_offset: totalDays - 2, item_order: 6 },
    { title: 'Closing Day', description: 'Sign documents and transfer ownership', days_offset: totalDays, item_order: 7 }
  ]

  // Calculate the actual due date based on contract date and offset
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
  // Uses SUPABASE_SERVICE_ROLE_KEY, bypassing RLS. 
  // This is acceptable in a secure serverless function like an API route.
  const { error } = await supabase
    .from('chat_history')
    .insert({ user_id: userId, role, message })
    
  if (error) console.error('Error saving message:', error)
}

async function getConversationHistory(userId) {
  // Uses SUPABASE_SERVICE_ROLE_KEY, bypassing RLS.
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
  
  // Fetch deadlines (for active transactions only)
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

  // Fetch active transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      *,
      clients (name, email, phone)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(20)

  // Fetch recent clients
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

  return `You are NAVIUS, an intelligent AI assistant for real estate professionals. Your goal is to simplify the user's workflow by being proactive and taking actions.
- Answer questions about deadlines, transactions, and clients based on the provided context.
- **CRITICAL**: When a user asks you to perform a task (e.g., 'send email briefing', 'create new deal', 'mark task complete', 'schedule daily updates'), you MUST use your AVAILABLE TOOLS to carry out the action. Do not just reply with text explaining how to do it.

**CURRENT CONTEXT:**
Active Transactions:
${transactionsList}

Upcoming Deadlines (Next 10):
${deadlinesList}

Recent Clients (Last 10):
${clientsList}

Be concise, friendly, and action-oriented. After executing a tool, confirm the action clearly in your reply. If a user asks for information not in your context, respond appropriately.`
}