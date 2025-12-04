"use client"
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'

export default function TransactionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const transactionId = params.id

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [transaction, setTransaction] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  // NAVIUS Chat State
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    checkUser()
    
    // Add modal animation styles
    const style = document.createElement('style')
    style.textContent = `
      @keyframes scale-in {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .animate-scale-in {
        animation: scale-in 0.2s ease-out;
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/'
    } else {
      setUser(user)
      await fetchData(user.id)
      setLoading(false)
      
      // Initialize NAVIUS with context
      if (chatMessages.length === 0) {
        setChatMessages([{
          role: 'assistant',
          content: `Hi! I'm NAVIUS, your AI assistant for this transaction. I can help you with tasks, deadlines, and answer any real estate questions. What would you like to know?`
        }])
      }
    }
  }

  async function fetchData(userId) {
    const { data: transactionData } = await supabase
      .from('transactions')
      .select(`
        *,
        clients (
          id,
          name,
          email,
          phone,
          status
        )
      `)
      .eq('id', transactionId)
      .eq('user_id', userId)
      .single()

    if (transactionData) {
      setTransaction(transactionData)
      
      const { data: timelineData } = await supabase
        .from('timeline_items')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('due_date', { ascending: true })

      setTimeline(timelineData || [])
    } else {
      router.push('/transactions')
    }
  }

  async function toggleTaskComplete(taskId, currentStatus) {
    await supabase
      .from('timeline_items')
      .update({ completed: !currentStatus })
      .eq('id', taskId)

    setTimeline(timeline.map(item => 
      item.id === taskId ? { ...item, completed: !currentStatus } : item
    ))
  }

  async function handleDeleteTransaction() {
    setDeleting(true)
    
    try {
      // Delete timeline items first (foreign key constraint)
      await supabase
        .from('timeline_items')
        .delete()
        .eq('transaction_id', transactionId)

      // Delete the transaction
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user.id)

      if (error) throw error

      // Redirect to transactions page
      router.push('/transactions')
    } catch (error) {
      console.error('Error deleting transaction:', error)
      alert('Failed to delete transaction. Please try again.')
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  async function handleChatSend(e) {
    e.preventDefault()
    if (!chatInput.trim() || chatSending) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatSending(true)

    // Add user message
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      // Add transaction context to the message
      const contextMessage = `[Transaction Context: ${transaction.property_address}, Client: ${transaction.clients.name}, Type: ${transaction.transaction_type}, Closing: ${transaction.closing_date}]\n\n${userMessage}`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          message: contextMessage
        })
      })

      const data = await response.json()

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: data.success ? data.response : 'Sorry, I encountered an error. Please try again.'
      }])
    } catch (error) {
      console.error('Chat error:', error)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }])
    } finally {
      setChatSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#B89A5A]/20 border-t-[#B89A5A] rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading transaction...</p>
        </div>
      </div>
    )
  }

  if (!transaction) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Transaction not found</p>
          <button
            onClick={() => router.push('/transactions')}
            className="px-4 py-2 bg-[#B89A5A] text-white rounded-lg hover:bg-[#A68949]"
          >
            Back to Transactions
          </button>
        </div>
      </div>
    )
  }

  const daysUntilClosing = Math.ceil((new Date(transaction.closing_date) - new Date()) / (1000 * 60 * 60 * 24))
  const completedTasks = timeline.filter(t => t.completed).length
  const totalTasks = timeline.length

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/transactions')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <Image src="/aureum-logo.png" alt="Aureum" width={28} height={28} />
              <div className="hidden md:flex items-center gap-6">
                <button 
                  onClick={() => router.push('/dashboard')}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => router.push('/transactions')}
                  className="text-sm text-[#B89A5A] font-medium"
                >
                  Transactions
                </button>
                <button 
                  onClick={() => router.push('/chat')}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  NAVIUS
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/profile')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-[#B89A5A] flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {user?.user_metadata?.first_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:inline">
                  {user?.user_metadata?.first_name || 'User'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Fixed Height Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Section - Client Info & Tasks */}
        <div className="flex-1 flex overflow-hidden">
          {/* Client Sidebar */}
          <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
            <div className="p-5">
              {/* Client Avatar */}
              <div className="flex flex-col items-center text-center mb-5 pb-5 border-b border-gray-200">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#B89A5A] to-[#9B8049] flex items-center justify-center mb-2">
                  <span className="text-white text-xl font-bold">
                    {transaction.clients?.name?.charAt(0) || 'C'}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">
                  {transaction.clients?.name}
                </h2>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  transaction.clients?.status === 'hot' 
                    ? 'bg-red-100 text-red-700'
                    : transaction.clients?.status === 'warm'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {transaction.clients?.status?.charAt(0).toUpperCase() + transaction.clients?.status?.slice(1)} Lead
                </span>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 mb-5 pb-5 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</h3>
                
                {transaction.clients?.phone && (
                  <a 
                    href={`tel:${transaction.clients.phone}`}
                    className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-[#B89A5A] transition-colors"
                  >
                    <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <span className="text-sm">{transaction.clients.phone}</span>
                  </a>
                )}

                {transaction.clients?.email && (
                  <a 
                    href={`mailto:${transaction.clients.email}`}
                    className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-[#B89A5A] transition-colors"
                  >
                    <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="truncate text-sm">{transaction.clients.email}</span>
                  </a>
                )}

                <div className="flex items-start gap-2.5 text-sm text-gray-700">
                  <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-xs text-gray-500 leading-relaxed">{transaction.property_address}</span>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</h3>
                
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Type</span>
                    <span className={`font-medium px-2 py-0.5 rounded text-xs ${
                      transaction.transaction_type === 'buyer' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {transaction.transaction_type === 'buyer' ? 'Buyer' : 'Seller'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Status</span>
                    <span className={`font-medium px-2 py-0.5 rounded text-xs ${
                      transaction.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {transaction.status === 'active' ? 'Active' : 'Closed'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Contract</span>
                    <span className="font-medium text-gray-900 text-xs">
                      {new Date(transaction.contract_date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Closing</span>
                    <span className="font-medium text-[#B89A5A] text-xs">
                      {new Date(transaction.closing_date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Days Left</span>
                    <span className={`font-bold text-sm ${daysUntilClosing < 7 ? 'text-red-600' : 'text-gray-900'}`}>
                      {daysUntilClosing}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium text-gray-900 text-xs">
                        {completedTasks}/{totalTasks}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-[#B89A5A] h-1.5 rounded-full transition-all"
                        style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Delete Transaction Button */}
                <div className="mt-5 pt-5 border-t border-gray-200">
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all font-medium text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Transaction
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tasks Section */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-5">
              {/* Property Header */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-5 h-5 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <h1 className="text-xl font-bold text-gray-900">{transaction.property_address}</h1>
                    </div>
                    <p className="text-sm text-gray-600">
                      {transaction.transaction_type === 'buyer' ? 'Buyer Transaction' : 'Seller Transaction'} • 
                      Closes in <span className="font-semibold text-[#B89A5A]">{daysUntilClosing} days</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Tasks Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h2 className="text-lg font-bold text-gray-900">Tasks</h2>
                  </div>
                  <button className="text-[#B89A5A] text-sm font-medium hover:text-[#A68949] flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Task
                  </button>
                </div>

                <div className="space-y-2">
                  {timeline.map((item) => {
                    const isPast = new Date(item.due_date) < new Date()
                    const isToday = new Date(item.due_date).toDateString() === new Date().toDateString()
                    
                    return (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-all hover:shadow-sm ${
                          item.completed
                            ? 'bg-gray-50 border-gray-200'
                            : isToday
                            ? 'bg-yellow-50 border-yellow-200'
                            : isPast
                            ? 'bg-red-50 border-red-200'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <button
                          onClick={() => toggleTaskComplete(item.id, item.completed)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                            item.completed
                              ? 'bg-[#B89A5A] border-[#B89A5A]'
                              : 'border-gray-300 hover:border-[#B89A5A]'
                          }`}
                        >
                          {item.completed && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <h3 className={`font-medium text-sm mb-0.5 ${
                            item.completed ? 'text-gray-400 line-through' : 'text-gray-900'
                          }`}>
                            {item.title}
                          </h3>
                          <p className={`text-xs ${
                            item.completed ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {item.description}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className={`text-xs font-medium ${
                            item.completed
                              ? 'text-gray-400'
                              : isToday
                              ? 'text-yellow-700'
                              : isPast
                              ? 'text-red-600'
                              : 'text-gray-700'
                          }`}>
                            {new Date(item.due_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                          {isToday && !item.completed && (
                            <span className="text-[10px] text-yellow-700 font-medium">Due Today</span>
                          )}
                          {isPast && !item.completed && (
                            <span className="text-[10px] text-red-600 font-medium">Overdue</span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {timeline.length === 0 && (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-gray-500 text-sm">No tasks yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NAVIUS Chat Panel - Integrated Right Sidebar */}
        <div className="w-96 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col">
          {/* Chat Header */}
          <div className="bg-gradient-to-br from-[#B89A5A] via-[#A68949] to-[#8F7738] text-white p-4 flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 flex items-center justify-center">
              <Image src="/aureum-logo.png" alt="NAVIUS" width={32} height={32} className="drop-shadow-lg" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg" style={{ fontFamily: 'Trajan Pro, serif' }}>NAVIUS</h3>
              <p className="text-xs text-white/90">Transaction Assistant</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-xs text-white/80">Online</span>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-50/50 to-white">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 mt-1">
                    <Image src="/aureum-logo.png" alt="AI" width={20} height={20} className="drop-shadow-md" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-[#B89A5A] to-[#A68949] text-white' 
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0 text-sm leading-relaxed" {...props} />,
                          ul: ({node, ...props}) => <ul className="mb-2 space-y-1 text-sm" {...props} />,
                          ol: ({node, ...props}) => <ol className="mb-2 space-y-1 text-sm" {...props} />,
                          li: ({node, ...props}) => <li className="ml-4 text-sm" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                    <span className="text-gray-700 font-semibold text-xs">
                      {user?.user_metadata?.first_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
              </div>
            ))}

            {chatSending && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 flex items-center justify-center mt-1">
                  <Image src="/aureum-logo.png" alt="AI" width={20} height={20} className="drop-shadow-md" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl px-3.5 py-2.5 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-[#B89A5A] rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-[#B89A5A] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-[#B89A5A] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button 
                onClick={() => setChatInput("What tasks are due soon?")}
                className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-[#B89A5A] transition-all whitespace-nowrap text-gray-700"
              >
                Due soon?
              </button>
              <button 
                onClick={() => setChatInput("What should I do next?")}
                className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-[#B89A5A] transition-all whitespace-nowrap text-gray-700"
              >
                Next steps
              </button>
              <button 
                onClick={() => setChatInput("Summarize this transaction")}
                className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-[#B89A5A] transition-all whitespace-nowrap text-gray-700"
              >
                Summary
              </button>
            </div>
          </div>

          {/* Chat Input */}
          <form onSubmit={handleChatSend} className="p-4 border-t border-gray-100 bg-white flex-shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about this transaction..."
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#B89A5A]/30 focus:border-[#B89A5A] outline-none text-sm bg-gray-50 transition-all"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatSending}
                className="px-4 py-2.5 bg-gradient-to-br from-[#B89A5A] to-[#A68949] text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">Delete Transaction</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete this transaction?
              </p>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-sm font-medium text-gray-900">{transaction?.property_address}</p>
                <p className="text-sm text-gray-600">{transaction?.clients?.name}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTransaction}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}