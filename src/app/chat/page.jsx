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
  const [sending, setSending] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [briefingLoading, setBriefingLoading] = useState({ email: false, sms: false })
  const [chatSessions, setChatSessions] = useState([])
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [showSessionMenu, setShowSessionMenu] = useState(false)
  const messagesEndRef = useRef(null)
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

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
      // Load the most recent session
      await loadSession(sessions[0].id)
    } else {
      // Create a new session if none exist
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
      // Show welcome message for empty sessions
      const firstName = user?.user_metadata?.first_name || 'there'
      setMessages([{
        role: 'assistant',
        content: `Welcome back, ${firstName}! 👋\n\nI'm **NAVIUS**, your AI real estate advisor. How can I help you today?`,
        timestamp: new Date()
      }])
    }
  }

  async function createNewSession(userId, title = null) {
    const sessionTitle = title || `Chat ${new Date().toLocaleDateString()}`
    
    const { data: newSession, error } = await supabase
      .from('chat_sessions')
      .insert([{
        user_id: userId,
        title: sessionTitle,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      return
    }

    setChatSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    
    const firstName = user?.user_metadata?.first_name || 'there'
    setMessages([{
      role: 'assistant',
      content: `Welcome back, ${firstName}! 👋\n\nI'm **NAVIUS**, your AI real estate advisor. How can I help you today?`,
      timestamp: new Date()
    }])
  }

  async function deleteSession(sessionId, e) {
    e.stopPropagation()
    
    if (!confirm('Delete this conversation? This cannot be undone.')) return

    // Delete chat history first
    await supabase.from('chat_history').delete().eq('session_id', sessionId)
    
    // Delete session
    await supabase.from('chat_sessions').delete().eq('id', sessionId)

    // Update local state
    const remainingSessions = chatSessions.filter(s => s.id !== sessionId)
    setChatSessions(remainingSessions)

    // If we deleted the current session, load another or create new
    if (currentSessionId === sessionId) {
      if (remainingSessions.length > 0) {
        await loadSession(remainingSessions[0].id)
      } else {
        await createNewSession(user.id)
      }
    }
  }

  async function renameSession(sessionId, newTitle) {
    await supabase
      .from('chat_sessions')
      .update({ title: newTitle })
      .eq('id', sessionId)

    setChatSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, title: newTitle } : s
    ))
  }

  async function updateSessionTitle(sessionId, firstMessage) {
    // Auto-generate title from first message
    const title = firstMessage.substring(0, 40) + (firstMessage.length > 40 ? '...' : '')
    
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

  async function handleSendBriefing(type) {
    if (!user || !currentSessionId) return

    setBriefingLoading({ ...briefingLoading, [type]: true })

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          message: type === 'email' 
            ? 'Send me an email briefing with my deadlines' 
            : 'Send me an SMS briefing with my deadlines'
        })
      })

      const data = await response.json()

      if (data.success) {
        const userMsg = { role: 'user', content: type === 'email' ? 'Send me an email briefing' : 'Send me an SMS briefing' }
        const aiMsg = { role: 'assistant', content: data.response }
        
        setMessages(prev => [...prev, userMsg, aiMsg])

        // Save to database
        await supabase.from('chat_history').insert([
          { session_id: currentSessionId, role: 'user', message: userMsg.content },
          { session_id: currentSessionId, role: 'assistant', message: aiMsg.content }
        ])

        // Update session timestamp
        await supabase
          .from('chat_sessions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', currentSessionId)
      } else {
        alert(`Failed to send ${type} briefing: ${data.error}`)
      }
    } catch (error) {
      console.error('Briefing error:', error)
      alert(`Error sending ${type} briefing`)
    } finally {
      setBriefingLoading({ ...briefingLoading, [type]: false })
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || sending || !user || !currentSessionId) return

    const userMessage = input.trim()
    setInput('')
    setSending(true)

    const userMsg = { role: 'user', content: userMessage, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])

    // Save user message
    await supabase.from('chat_history').insert([{
      session_id: currentSessionId,
      role: 'user',
      message: userMessage
    }])

    // Update session title if first message
    const session = chatSessions.find(s => s.id === currentSessionId)
    if (messages.length <= 1 || session?.title?.startsWith('Chat ')) {
      await updateSessionTitle(currentSessionId, userMessage)
    }

    // Update session timestamp
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentSessionId)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          message: userMessage
        })
      })

      const data = await response.json()

      const aiMsg = { 
        role: 'assistant', 
        content: data.success ? data.response : 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiMsg])

      // Save AI response
      await supabase.from('chat_history').insert([{
        session_id: currentSessionId,
        role: 'assistant',
        message: aiMsg.content
      }])

    } catch (error) {
      console.error('Chat error:', error)
      const errorMsg = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setSending(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F7F5EF]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#B89A5A]/20 border-t-[#B89A5A] rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading NAVIUS...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#F7F5EF]">
      {/* Sidebar with Chat Sessions */}
      {sidebarOpen && (
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Image src="/aureum-logo.png" alt="Aureum" width={32} height={32} />
          
                <span style={{ fontFamily: 'Trajan Pro, serif' }} className="text-lg font-bold bg-gradient-to-r from-[#B89A5A] to-[#9B8049] bg-clip-text text-transparent"> AUREUM</span>
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

            {/* Navigation Links */}
            <div className="space-y-1">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-[#F7F5EF] rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </button>
              <button
                onClick={() => router.push('/transactions')}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-[#F7F5EF] rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Transactions
              </button>

              <button
                onClick={() => router.push('/calendar')}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-[#F7F5EF] rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
                Calendar
              </button>
              
            </div>
          </div>

          {/* Chat Sessions List */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-xs font-semibold text-gray-500 px-3 py-2 flex items-center justify-between">
              <span>Recent Chats</span>
              <span className="text-gray-400">({chatSessions.length})</span>
            </div>
            {chatSessions.map(session => (
              <div
                key={session.id}
                className={`relative group w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors cursor-pointer ${
                  currentSessionId === session.id
                    ? 'bg-[#F7F5EF] text-[#B89A5A] border border-[#B89A5A]/20'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div 
                    onClick={() => loadSession(session.id)}
                    className="flex-1 min-w-0"
                  >
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(session.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 rounded transition-all"
                    title="Delete chat"
                  >
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* User Profile */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => router.push('/profile')}
              className="w-full flex items-center gap-3 mb-3 p-2 hover:bg-[#F7F5EF] rounded-lg transition-colors group"
            >
              <div className="w-8 h-8 bg-[#B89A5A] rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {user?.user_metadata?.first_name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-800 truncate group-hover:text-[#B89A5A] transition-colors">
                  {user?.user_metadata?.full_name || user?.email}
                </p>
                <p className="text-xs text-gray-500">View Profile</p>
              </div>
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-sm text-gray-600 hover:text-red-600 py-2 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Image src="/aureum-logo.png" alt="Aureum" width={32} height={32} />
            <div>
              <h2 className="font-semibold text-gray-800" style={{ fontFamily: 'Trajan Pro, serif' }}>NAVIUS</h2>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-500">Online</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Subscription Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#B89A5A]/10 to-[#9B8049]/10 rounded-lg border border-[#B89A5A]/20">
              <div className={`w-2 h-2 rounded-full ${
                user?.user_metadata?.subscription_status === 'active' ? 'bg-green-500' :
                user?.user_metadata?.subscription_status === 'cancelled' ? 'bg-yellow-500' :
                'bg-gray-400'
              }`}></div>
              <span className="text-xs font-semibold text-gray-700">
                {user?.user_metadata?.subscription_plan?.toUpperCase() || 'FREE'}
              </span>
            </div>

            <button
              onClick={() => router.push('/profile')}
              className="flex items-center gap-2 px-4 py-2 bg-[#F7F5EF] rounded-lg border border-[#B89A5A]/30 hover:border-[#B89A5A] transition-all"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-700 font-medium">
                {user?.user_metadata?.first_name || 'User'}
              </span>
            </button>
          </div>
        </div>

        {/* Messages Area */}
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

            {sending && (
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

        {/* Input Area with Briefing Buttons */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <form onSubmit={handleSend} className="max-w-3xl mx-auto">
            {/* Quick Actions */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500 font-medium">Quick actions:</span>
              <button
                type="button"
                onClick={() => handleSendBriefing('email')}
                disabled={briefingLoading.email}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {briefingLoading.email ? (
                  <>
                    <div className="w-3 h-3 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email Briefing
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSendBriefing('sms')}
                disabled={briefingLoading.sms}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {briefingLoading.sms ? (
                  <>
                    <div className="w-3 h-3 border-2 border-green-700 border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    SMS Briefing
                  </>
                )}
              </button>
            </div>

            {/* Chat Input */}
            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend(e)
                  }
                }}
                placeholder="Ask about transactions, deadlines, or clients..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none resize-none"
                rows="1"
                style={{ minHeight: '48px', maxHeight: '200px' }}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="px-6 py-3 bg-[#B89A5A] text-white rounded-lg hover:bg-[#A68949] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              NAVIUS is an AI assistant. Information provided is for guidance only.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}