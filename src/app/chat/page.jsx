"use client"
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'

export default function ChatPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [chatSessions, setChatSessions] = useState([])
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const messagesEndRef = useRef(null)
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/'
    } else {
      setUser(user)
      await loadChatSessions(user.id)
      setLoading(false)
    }
  }

  async function loadChatSessions(userId) {
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (sessions && sessions.length > 0) {
      setChatSessions(sessions)
      await loadSession(sessions[0].id)
    } else {
      await createNewSession(userId)
    }
  }

  async function loadSession(sessionId) {
    setCurrentSessionId(sessionId)
    
    const { data: history } = await supabase
      .from('chat_history')
      .select('role, message, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (history && history.length > 0) {
      setMessages(history.map(msg => ({
        role: msg.role,
        content: msg.message,
        timestamp: new Date(msg.created_at)
      })))
    } else {
      // Show welcome message for new sessions
      const firstName = user?.user_metadata?.first_name || user?.user_metadata?.full_name?.split(' ')[0] || 'there'
      setMessages([{
        role: 'assistant',
        content: `Welcome back, ${firstName}! 👋\n\nI'm **NAVIUS**, your AI real estate advisor.\n\n**I can help you:**\n- Manage transactions and deadlines\n- Provide expert real estate advice\n- Execute actions (send briefings, add clients)\n- Answer any questions about real estate\n\nWhat would you like to work on today?`,
        timestamp: new Date()
      }])
    }
  }

  async function createNewSession(userId) {
    const firstName = user?.user_metadata?.first_name || 'User'
    
    const { data: newSession, error } = await supabase
      .from('chat_sessions')
      .insert([{
        user_id: userId,
        title: `Chat with ${firstName}`,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      return
    }

    setChatSessions(prev => [newSession, ...prev])
    await loadSession(newSession.id)
  }

  async function deleteSession(sessionId, e) {
    e.stopPropagation()
    
    if (!confirm('Delete this conversation?')) return

    await supabase.from('chat_history').delete().eq('session_id', sessionId)
    await supabase.from('chat_sessions').delete().eq('id', sessionId)

    const remainingSessions = chatSessions.filter(s => s.id !== sessionId)
    setChatSessions(remainingSessions)

    if (currentSessionId === sessionId) {
      if (remainingSessions.length > 0) {
        await loadSession(remainingSessions[0].id)
      } else {
        await createNewSession(user.id)
      }
    }
  }

  async function updateSessionTitle(sessionId, firstMessage) {
    const title = firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '')
    
    await supabase
      .from('chat_sessions')
      .update({ 
        title,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    setChatSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, title, updated_at: new Date().toISOString() } : s
    ))
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleSendMessage(e) {
    e.preventDefault()
    if (!input.trim() || isTyping) return

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    // Save user message
    await supabase.from('chat_history').insert([{
      session_id: currentSessionId,
      role: 'user',
      message: input
    }])

    // Update session title if first message
    if (messages.length <= 1) {
      await updateSessionTitle(currentSessionId, input)
    }

    // Update session timestamp
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentSessionId)

    try {
      // Call your AI API here
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          userId: user.id
        })
      })

      const data = await response.json()
      
      const aiMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiMessage])

      // Save AI response
      await supabase.from('chat_history').insert([{
        session_id: currentSessionId,
        role: 'assistant',
        message: data.message
      }])

    } catch (error) {
      console.error('Error:', error)
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F7F5EF]">
        <div className="text-[#B89A5A] text-lg font-medium animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#F7F5EF]">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-64' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col overflow-hidden`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Image src="/aureum-logo.png" alt="Aureum" width={32} height={32} />
              <span className="font-bold text-[#B89A5A]">NAVIUS</span>
            </div>
            <button
              onClick={() => createNewSession(user.id)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="New chat"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <div className="space-y-1">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-[#F7F5EF] hover:text-[#1e40af] rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </button>
            <button
              onClick={() => router.push('/transactions')}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-[#F7F5EF] hover:text-[#1e40af] rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Transactions
            </button>
          </div>
        </div>

        {/* Chat Sessions */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-xs font-semibold text-gray-500 px-3 py-2">Recent Chats</div>
          {chatSessions.map(session => (
            <button
              key={session.id}
              onClick={() => loadSession(session.id)}
              className={`w-full text-left px-3 py-2 rounded-lg mb-1 group transition-colors ${
                currentSessionId === session.id
                  ? 'bg-[#F7F5EF] text-[#B89A5A]'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm truncate flex-1">{session.title}</span>
                <button
                  onClick={(e) => deleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity"
                >
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </button>
          ))}
        </div>

        {/* User Profile */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => router.push('/profile')}
              className="w-full flex items-center gap-3 mb-3 p-2 hover:bg-[#F7F5EF] rounded-lg transition-colors group"
              title="View Profile"
            >
              <div className="w-8 h-8 bg-[#B89A5A] rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {user?.user_metadata?.first_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate group-hover:text-[#B89A5A] transition-colors">
                  {user?.user_metadata?.full_name || user?.email}
                </p>
                <p className="text-xs text-gray-500">View Profile</p>
              </div>
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-sm text-gray-600 hover:text-red-600 py-2 transition-colors"
            >
              Sign Out
            </button>
          </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Image src="/aureum-logo.png" alt="Aureum" width={32} height={32} />
            <div>
              <h2 className="font-semibold text-gray-800">NAVIUS</h2>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-500">Online</span>
              </div>
            </div>
          </div>
          
          {/* Profile Button in Header */}
          <button
            onClick={() => router.push('/profile')}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#F7F5EF] rounded-lg border border-[#B89A5A]/30 hover:border-[#B89A5A] hover:bg-[#F7F5EF]/80 cursor-pointer transition-all group"
            title="View Profile"
          >
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-700 font-medium group-hover:text-[#B89A5A] transition-colors">
              {user?.user_metadata?.full_name || user?.email}
            </span>
            <svg className="w-4 h-4 text-gray-400 group-hover:text-[#B89A5A] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 border-2 border-[#B89A5A]">
                    <Image src="/aureum-logo.png" alt="AI" width={20} height={20} />
                  </div>
                )}
                <div className={`max-w-2xl ${msg.role === 'user' ? 'bg-[#B89A5A] text-white' : 'bg-white'} rounded-2xl px-5 py-3 shadow-sm`}>
                  {msg.role === 'user' ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({node, ...props}) => <p className="mb-3 last:mb-0 text-gray-700 leading-relaxed" {...props} />,
                          ul: ({node, ...props}) => <ul className="mb-3 space-y-1 text-gray-700" {...props} />,
                          ol: ({node, ...props}) => <ol className="mb-3 space-y-1 text-gray-700" {...props} />,
                          li: ({node, ...props}) => <li className="ml-4" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold text-gray-900" {...props} />,
                          code: ({node, inline, ...props}) => 
                            inline ?
                              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-[#B89A5A]" {...props} /> :
                              <code className="block bg-gray-100 p-3 rounded-lg text-sm font-mono overflow-x-auto" {...props} />,
                          h3: ({node, ...props}) => <h3 className="font-semibold text-gray-900 mb-2 mt-4" {...props} />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-600 font-semibold text-sm">
                      {user?.user_metadata?.first_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center border-2 border-[#B89A5A]">
                  <Image src="/aureum-logo.png" alt="AI" width={20} height={20} />
                </div>
                <div className="bg-white rounded-2xl px-5 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage(e)
                  }
                }}
                placeholder="Ask about your transactions, deadlines, or clients..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none resize-none"
                rows="1"
                style={{ minHeight: '48px', maxHeight: '200px' }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="px-6 py-3 bg-[#B89A5A] text-white rounded-lg hover:bg-[#A68949] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              NAVIUS is an AI assistant. Information provided is for guidance only and not financial/legal advice.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}