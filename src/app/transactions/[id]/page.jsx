"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'

export default function TransactionDetailPage() {
  const params = useParams()
  const transactionId = params.id
  const [transaction, setTransaction] = useState(null)
  const [timelineItems, setTimelineItems] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (transactionId) {
      fetchTransaction()
    }
  }, [transactionId])

  async function fetchTransaction() {
    // Fetch transaction with client info
    const { data: transactionData, error: transactionError } = await supabase
      .from('transactions')
      .select(`
        *,
        clients (
          id,
          name,
          email,
          phone
        )
      `)
      .eq('id', transactionId)  // Changed from params.id
      .single()

    if (transactionError) {
      console.error('Error fetching transaction:', transactionError)
      router.push('/transactions')
      return
    }

    setTransaction(transactionData)

    // Fetch timeline items
    const { data: timelineData, error: timelineError } = await supabase
      .from('timeline_items')
      .select('*')
      .eq('transaction_id', transactionId)  // Changed from params.id
      .order('item_order')

    if (!timelineError) {
      setTimelineItems(timelineData || [])
    }

    setLoading(false)
  }

  async function toggleComplete(itemId, currentStatus) {
    const { error } = await supabase
      .from('timeline_items')
      .update({
        completed: !currentStatus,
        completed_at: !currentStatus ? new Date().toISOString() : null
      })
      .eq('id', itemId)

    if (!error) {
      // Update local state
      setTimelineItems(timelineItems.map(item =>
        item.id === itemId
          ? { ...item, completed: !currentStatus, completed_at: !currentStatus ? new Date().toISOString() : null }
          : item
      ))
    }
  }

  function getDaysUntil(dateString) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDate = new Date(dateString)
    targetDate.setHours(0, 0, 0, 0)
    const diffTime = targetDate - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  function getStatusColor(daysUntil, completed) {
    if (completed) return 'bg-green-100 text-green-700 border-green-200'
    if (daysUntil < 0) return 'bg-red-100 text-red-700 border-red-200'
    if (daysUntil <= 2) return 'bg-orange-100 text-orange-700 border-orange-200'
    if (daysUntil <= 7) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    return 'bg-[#F7F5EF] text-[#B89A5A] border-[#B89A5A]/30'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F7F5EF]">
        <div className="text-[#B89A5A] text-lg font-medium animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!transaction) {
    return null
  }

  const completedCount = timelineItems.filter(item => item.completed).length
  const totalCount = timelineItems.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="min-h-screen bg-[#F7F5EF]">
      {/* Header */}
      <header className="bg-white shadow-sm border-b-2 border-[#B89A5A]/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                        <Image 
                          src="/aureum-logo.png" 
                          alt="Aureum Logo" 
                          width={48} 
                          height={48}
                          className="object-contain"
                        />
                        
                      </div>
              <button 
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-3"
              >
              </button>
              <nav className="hidden md:flex gap-4">
                <button 
                  onClick={() => router.push('/dashboard')}
                  className="px-4 py-2 text-gray-600 hover:text-[#B89A5A] transition"
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => router.push('/transactions')}
                  className="px-4 py-2 text-[#B89A5A] font-semibold border-b-2 border-[#B89A5A]"
                >
                  Transactions
                </button>
                <button 
                  onClick={() => router.push('/chat')}
                  className="px-4 py-2 text-gray-600 hover:text-[#B89A5A] transition flex items-center gap-2"
                >
                  NAVIUS
                </button>
              </nav>
            </div>
            <button
              onClick={() => router.push('/transactions')}
              className="flex items-center gap-2 text-gray-600 hover:text-[#B89A5A] transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Transactions
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Property Header */}
        <div className="bg-gradient-to-r from-[#B89A5A] to-[#9B8049] rounded-2xl shadow-xl p-8 mb-8 text-white">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-3xl font-bold">{transaction.property_address}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  transaction.transaction_type === 'buyer'
                    ? 'bg-blue-500 text-white'
                    : 'bg-green-500 text-white'
                }`}>
                  {transaction.transaction_type.toUpperCase()}
                </span>
              </div>
              <div className="space-y-2 text-white/90">
                <p className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <strong>Client:</strong> {transaction.clients.name}
                </p>
                <p className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <strong>Contract Date:</strong> {new Date(transaction.contract_date).toLocaleDateString()}
                </p>
                <p className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <strong>Closing Date:</strong> {new Date(transaction.closing_date).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold mb-2">{progressPercent}%</div>
              <div className="text-sm">Complete</div>
              <div className="text-xs mt-1 opacity-75">{completedCount} of {totalCount} milestones</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-xl p-6 mb-8 shadow-md border-2 border-[#B89A5A]/20">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-800">Overall Progress</h3>
            <span className="text-sm text-gray-600">{completedCount}/{totalCount} completed</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#B89A5A] to-[#9B8049] h-4 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl shadow-md border-2 border-[#B89A5A]/20 p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Transaction Timeline</h2>
          
          <div className="space-y-4">
            {timelineItems.map((item, index) => {
              const daysUntil = getDaysUntil(item.due_date)
              const statusColor = getStatusColor(daysUntil, item.completed)

              return (
                <div
                  key={item.id}
                  className={`border-2 rounded-xl p-5 transition-all ${
                    item.completed
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-[#B89A5A]/20 hover:border-[#B89A5A] hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleComplete(item.id, item.completed)}
                      className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                        item.completed
                          ? 'bg-green-500 border-green-500'
                          : 'border-[#B89A5A] hover:border-[#9B8049] hover:bg-[#F7F5EF]'
                      }`}
                    >
                      {item.completed && (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className={`text-lg font-semibold ${item.completed ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                            {item.title}
                          </h3>
                          <p className={`text-sm ${item.completed ? 'text-gray-400' : 'text-gray-600'}`}>
                            {item.description}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
                          {item.completed
                            ? '✓ Complete'
                            : daysUntil < 0
                            ? `${Math.abs(daysUntil)} days overdue`
                            : daysUntil === 0
                            ? 'Due today'
                            : daysUntil === 1
                            ? 'Due tomorrow'
                            : `${daysUntil} days left`
                          }
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Due: {new Date(item.due_date).toLocaleDateString()}
                        </span>
                        {item.completed && item.completed_at && (
                          <span className="flex items-center gap-1 text-green-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Completed: {new Date(item.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Client Contact Card */}
        <div className="bg-white rounded-xl shadow-md border-2 border-[#B89A5A]/20 p-6 mt-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Client Contact</h3>
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-gray-700">
              <svg className="w-5 h-5 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <strong>Name:</strong> {transaction.clients.name}
            </p>
            {transaction.clients.email && (
              <p className="flex items-center gap-2 text-gray-700">
                <svg className="w-5 h-5 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href={`mailto:${transaction.clients.email}`} className="text-[#B89A5A] hover:underline">
                  {transaction.clients.email}
                </a>
              </p>
            )}
            {transaction.clients.phone && (
              <p className="flex items-center gap-2 text-gray-700">
                <svg className="w-5 h-5 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href={`tel:${transaction.clients.phone}`} className="text-[#B89A5A] hover:underline">
                  {transaction.clients.phone}
                </a>
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}