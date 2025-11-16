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
      setLoading(false)
      loadChatHistory(user.id)
    }
  }

  async function loadChatHistory(userId) {
    const { data: history } = await supabase
      .from('chat_history')
      .select('role, message')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(20)

    if (history) {
      setMessages(history.map(h => ({ role: h.role, content: h.message })))
    }
  }

  async function handleSendBriefing(type) {
    if (!user) return

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
        // Add the messages to chat
        setMessages(prev => [...prev, 
          { role: 'user', content: type === 'email' ? 'Send me an email briefing' : 'Send me an SMS briefing' },
          { role: 'assistant', content: data.response }
        ])
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
    if (!input.trim() || sending || !user) return

    const userMessage = input.trim()
    setInput('')
    setSending(true)

    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, message: userMessage })
      })

      const data = await response.json()

      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Error: ${data.error}` 
        }])
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }])
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#B89A5A]/20 border-t-[#B89A5A] rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading NAVIUS...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Collapsible Sidebar */}
      <aside className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-40 ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}>
        {/* Logo & Toggle */}
        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-4">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <Image src="/aureum-logo.png" alt="Aureum" width={32} height={32} className="object-contain" />
              <span style={{ fontFamily: 'Trajan Pro, serif' }} className="text-lg font-bold bg-gradient-to-r from-[#B89A5A] to-[#9B8049] bg-clip-text text-transparent">
                AUREUM
              </span>
            </div>
          )}
          {!sidebarOpen && (
            <Image src="/aureum-logo.png" alt="Aureum" width={32} height={32} className="object-contain mx-auto" />
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? "M11 19l-7-7 7-7m8 14l-7-7 7-7" : "M13 5l7 7-7 7M5 5l7 7-7 7"} />
            </svg>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-2">
          <button
            onClick={() => router.push('/dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              sidebarOpen ? 'justify-start' : 'justify-center'
            } text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {sidebarOpen && <span>Dashboard</span>}
          </button>

          <button
            onClick={() => router.push('/transactions')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              sidebarOpen ? 'justify-start' : 'justify-center'
            } text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {sidebarOpen && <span>Transactions</span>}
          </button>

          <button
            onClick={() => router.push('/chat')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              sidebarOpen ? 'justify-start' : 'justify-center'
            } bg-[#B89A5A]/10 text-[#B89A5A] font-medium`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {sidebarOpen && <span>NAVIUS AI</span>}
          </button>

          <button
            onClick={() => router.push('/profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              sidebarOpen ? 'justify-start' : 'justify-center'
            } text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {sidebarOpen && <span>Profile</span>}
          </button>
        </nav>

        {/* Logout Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              sidebarOpen ? 'justify-start' : 'justify-center'
            } text-red-600 hover:bg-red-50`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-gray-200/50 shadow-sm">
          <div className="px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Image src="/aureum-logo.png" alt="NAVIUS" width={40} height={40} className="object-contain" />
                <div>
                  <h1 style={{ fontFamily: 'Trajan Pro, serif' }}className="text-lg font-bold text-gray-900">NAVIUS AI</h1>
                  <p className="text-xs text-gray-500">Your AI Real Estate Assistant</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <Image src="/aureum-logo.png" alt="NAVIUS" width={64} height={64} className="object-contain mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Welcome to NAVIUS</h3>
              <p className="text-gray-600 text-center max-w-md">
                I'm your AI real estate assistant. Ask me anything about your business, deals, or the real estate industry.
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <Image src="/aureum-logo.png" alt="NAVIUS" width={32} height={32} className="object-contain flex-shrink-0" />
                  )}
                  <div
                    className={`max-w-2xl px-4 py-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white'
                        : 'bg-white border border-gray-200 text-gray-900'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSend} className="space-y-3">
              {/* Briefing Buttons */}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => handleSendBriefing('email')}
                  disabled={briefingLoading.email || sending}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
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
                      Email Brief
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSendBriefing('sms')}
                  disabled={briefingLoading.sms || sending}
                  className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {briefingLoading.sms ? (
                    <>
                      <div className="w-3 h-3 border-2 border-green-700 border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      SMS Brief
                    </>
                  )}
                </button>
              </div>

              {/* Message Input */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask NAVIUS anything..."
                  disabled={sending}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="px-6 py-3 bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white rounded-xl font-medium hover:shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {sending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-gray-500 text-center mt-2">
                 NAVIUS is an AI assistant. Information provided is for guidance only and not financial/legal advice. Always verify important information
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}