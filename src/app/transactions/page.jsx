"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function TransactionsPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState([])
  const [clients, setClients] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const router = useRouter()

  const [transactionForm, setTransactionForm] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    client_status: 'lead',
    property_address: '',
    transaction_type: 'buyer',
    contract_date: '',
    closing_date: '',
    notes: ''
  })

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/'
    } else {
      setUser(user)
      setLoading(false)
      fetchData(user.id)
    }
  }

  async function fetchData(userId) {
    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .order('name')
    setClients(clientsData || [])

    const { data: transactionsData } = await supabase
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
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    setTransactions(transactionsData || [])
  }

  function generateTimeline(contractDate, closingDate, transactionType) {
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

  async function handleSubmit(e) {
    e.preventDefault()

    try {
      // First, create the client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert([
          {
            user_id: user.id,
            name: transactionForm.client_name,
            email: transactionForm.client_email || null,
            phone: transactionForm.client_phone || null,
            status: transactionForm.client_status
          }
        ])
        .select()
        .single()

      if (clientError) {
        alert('Error creating client: ' + clientError.message)
        return
      }

      // Then create the transaction with the new client_id
      const { data: newTransaction, error: transactionError } = await supabase
        .from('transactions')
        .insert([
          {
            user_id: user.id,
            client_id: clientData.id,
            property_address: transactionForm.property_address,
            transaction_type: transactionForm.transaction_type,
            contract_date: transactionForm.contract_date,
            closing_date: transactionForm.closing_date,
            status: 'active'
          }
        ])
        .select()
        .single()

      if (transactionError) {
        // If transaction creation fails, delete the client we just created
        await supabase.from('clients').delete().eq('id', clientData.id)
        alert('Error creating transaction: ' + transactionError.message)
        return
      }

      const timelineItems = generateTimeline(
        transactionForm.contract_date,
        transactionForm.closing_date,
        transactionForm.transaction_type
      )

      const { error: timelineError } = await supabase
        .from('timeline_items')
        .insert(
          timelineItems.map(item => ({
            transaction_id: newTransaction.id,
            title: item.title,
            description: item.description,
            due_date: item.due_date,
            item_order: item.item_order
          }))
        )

      if (timelineError) {
        alert('Error creating timeline: ' + timelineError.message)
        return
      }

      fetchData(user.id)
      setShowModal(false)
      setTransactionForm({
        client_name: '',
        client_email: '',
        client_phone: '',
        client_status: 'lead',
        property_address: '',
        transaction_type: 'buyer',
        contract_date: '',
        closing_date: '',
        notes: ''
      })
    } catch (error) {
      alert('An error occurred: ' + error.message)
    }
  }

  function handleViewTransaction(transactionId) {
    router.push(`/transactions/${transactionId}`)
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
          <p className="text-gray-600 font-medium">Loading your transactions...</p>
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
                      } bg-[#B89A5A]/10 text-[#B89A5A] font-medium`}
                    >
                      <Image src="/house-line.svg" alt="Aureum" width={28} height={28} className="object-contain" />
                      {sidebarOpen && <span>Dashboard</span>}
                    </button>
          
                    <button
                      onClick={() => router.push('/transactions')}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                        sidebarOpen ? 'justify-start' : 'justify-center'
                      } text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
                    >
                      <Image src="/clipboard-text.svg" alt="Navius" width={28} height={28} className="object-contain" />
                      {sidebarOpen && <span>Transactions</span>}
                    </button>
          
          
                    <button
                      onClick={() => router.push('/calendar')}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                        sidebarOpen ? 'justify-start' : 'justify-center'
                      } text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
                    >
                      <Image src="/calendar-dots.svg" alt="Aureum" width={28} height={28} className="object-contain" />
                      {sidebarOpen && <span>Calendar</span>}
                    </button>
          
                    <button
                      onClick={() => router.push('/chat')}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                        sidebarOpen ? 'justify-start' : 'justify-center'
                      } text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
                    >
                      <Image src="/aureum-logo.png" alt="Navius" width={28} height={28} className="object-contain" />
                      {sidebarOpen && <span>Navius</span>}
                    </button>
          
                    <button
                      onClick={() => router.push('/profile')}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                        sidebarOpen ? 'justify-start' : 'justify-center'
                      } text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
                    >
                      <Image src="/user-circle.svg" alt="Navius" width={28} height={28} className="object-contain" />
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

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-gray-200/50 shadow-sm">
          <div className="px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <h1 style={{ fontFamily: 'Trajan Pro, serif' }} className="text-2xl font-bold text-gray-900">Transactions</h1>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white rounded-lg font-medium hover:shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Transaction
              </button>
            </div>
          </div>
        </header>

        {/* Transactions List */}
        <div className="p-6 lg:p-8">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No transactions yet</h3>
              <p className="text-gray-600 text-center max-w-md mb-6">
                Get started by creating your first transaction. Track deals, manage timelines, and close more business.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white rounded-xl font-medium hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                Create Your First Transaction
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  onClick={() => handleViewTransaction(transaction.id)}
                  className="group bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-[#B89A5A]/30 transition-all cursor-pointer overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-6">
                      {/* Left: Property Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
                              {transaction.property_address}
                            </h3>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-sm text-gray-600 flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                {transaction.clients?.name}
                              </span>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                transaction.transaction_type === 'buyer' 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {transaction.transaction_type === 'buyer' ? 'Buyer' : 'Seller'}
                              </span>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                transaction.status === 'active' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {transaction.status === 'active' ? 'Active' : 'Closed'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Dates */}
                      <div className="flex items-center gap-6 lg:border-l lg:pl-6 lg:border-gray-200">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">Contract</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {new Date(transaction.contract_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-gray-300">→</div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">Closing</p>
                          <p className="text-sm font-semibold text-[#B89A5A]">
                            {new Date(transaction.closing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 group-hover:bg-[#B89A5A] transition-colors">
                          <svg className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">New Transaction</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Client Information Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-blue-900">Client Information</h3>
                </div>
              </div>

              {/* Client Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={transactionForm.client_name}
                  onChange={(e) => setTransactionForm({ ...transactionForm, client_name: e.target.value })}
                  required
                  placeholder="John Doe"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                />
              </div>

              {/* Client Email and Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={transactionForm.client_email}
                    onChange={(e) => setTransactionForm({ ...transactionForm, client_email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={transactionForm.client_phone}
                    onChange={(e) => setTransactionForm({ ...transactionForm, client_phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                  />
                </div>
              </div>

              {/* Client Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lead Status</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setTransactionForm({ ...transactionForm, client_status: 'hot' })}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      transactionForm.client_status === 'hot'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🔥 Hot
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionForm({ ...transactionForm, client_status: 'warm' })}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      transactionForm.client_status === 'warm'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    ☀️ Warm
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionForm({ ...transactionForm, client_status: 'lead' })}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      transactionForm.client_status === 'lead'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    ❄️ Cold
                  </button>
                </div>
              </div>

              {/* Transaction Information Section */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="text-sm font-semibold text-green-900">Transaction Details</h3>
                </div>
              </div>

              {/* Property Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={transactionForm.property_address}
                  onChange={(e) => setTransactionForm({ ...transactionForm, property_address: e.target.value })}
                  required
                  placeholder="123 Main St, City, State 12345"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                />
              </div>

              {/* Transaction Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTransactionForm({ ...transactionForm, transaction_type: 'buyer' })}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      transactionForm.transaction_type === 'buyer'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Buyer
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionForm({ ...transactionForm, transaction_type: 'seller' })}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      transactionForm.transaction_type === 'seller'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Seller
                  </button>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contract Date</label>
                  <input
                    type="date"
                    value={transactionForm.contract_date}
                    onChange={(e) => setTransactionForm({ ...transactionForm, contract_date: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Closing Date</label>
                  <input
                    type="date"
                    value={transactionForm.closing_date}
                    onChange={(e) => setTransactionForm({ ...transactionForm, closing_date: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={transactionForm.notes}
                  onChange={(e) => setTransactionForm({ ...transactionForm, notes: e.target.value })}
                  rows="3"
                  placeholder="Add any additional details..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all resize-none"
                />
              </div>  

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white rounded-xl font-medium hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
                >
                  Create Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}