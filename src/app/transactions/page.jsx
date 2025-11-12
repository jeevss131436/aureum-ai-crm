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
  const router = useRouter()

  const [transactionForm, setTransactionForm] = useState({
    client_id: '',
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
    // Fetch clients
    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .order('name')
    setClients(clientsData || [])

    // Fetch transactions with client info
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
    
    // Calculate days until closing
    const totalDays = Math.ceil((closing - contract) / (1000 * 60 * 60 * 24))
    
    const timeline = [
      {
        title: 'Contract Signed',
        description: 'Purchase agreement executed',
        days_offset: 0,
        item_order: 1
      },
      {
        title: 'Home Inspection',
        description: 'Schedule and complete home inspection',
        days_offset: 7,
        item_order: 2
      },
      {
        title: 'Inspection Response',
        description: 'Respond to inspection findings',
        days_offset: 10,
        item_order: 3
      },
      {
        title: 'Appraisal',
        description: 'Property appraisal completed',
        days_offset: 14,
        item_order: 4
      },
      {
        title: 'Loan Approval',
        description: 'Final loan approval from lender',
        days_offset: Math.floor(totalDays * 0.7),
        item_order: 5
      },
      {
        title: 'Final Walkthrough',
        description: 'Buyer final property walkthrough',
        days_offset: totalDays - 2,
        item_order: 6
      },
      {
        title: 'Closing Day',
        description: 'Sign documents and transfer ownership',
        days_offset: totalDays,
        item_order: 7
      }
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

    // Insert transaction
    const { data: newTransaction, error: transactionError } = await supabase
      .from('transactions')
      .insert([
        {
          ...transactionForm,
          user_id: user.id
        }
      ])
      .select()
      .single()

    if (transactionError) {
      alert('Error creating transaction: ' + transactionError.message)
      return
    }

    // Generate and insert timeline items
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

    // Refresh data
    fetchData(user.id)
    setShowModal(false)
    setTransactionForm({
      client_id: '',
      property_address: '',
      transaction_type: 'buyer',
      contract_date: '',
      closing_date: '',
      notes: ''
    })
  }

  function handleViewTransaction(transactionId) {
    router.push(`/transactions/${transactionId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F7F5EF]">
        <div className="text-[#B89A5A] text-lg font-medium animate-pulse">Loading...</div>
      </div>
    )
  }



  

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
                className="px-4 py-2 text-gray-600 hover:text-[#1e40af] transition"
              >
                Dashboard
              </button>
              <button className="px-4 py-2 text-[#B89A5A] font-semibold border-b-2 border-[#B89A5A]">
                Transactions
              </button>
              <button 
                onClick={() => router.push('/chat')}
                className="px-4 py-2 text-gray-600 hover:text-[#1e40af] transition flex items-center gap-2"
              >
                
                NAVIUS
              </button>
            </nav>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Transactions</h2>
            <p className="text-gray-600 mt-1">Manage your deals and track deadlines</p>
          </div>
          <button
              onClick={() => setShowModal(true)}
              disabled={clients.length === 0}
              className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                clients.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed border border-gray-400'
                  : 'bg-white text-[#B89A5A] border-2 border-[#B89A5A] hover:border-[#1e40af] hover:text-[#1e40af] transform hover:scale-105'
              }`}
            >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Transaction
          </button>
        </div>

        {clients.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border-2 border-[#B89A5A]/20">
            <div className="w-20 h-20 bg-[#F7F5EF] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">No clients yet</h3>
            <p className="text-gray-600 mb-6">You need to add clients before creating transactions</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-white text-[#B89A5A] px-6 py-3 rounded-lg font-semibold border-2 border-[#B89A5A] hover:border-[#1e40af] hover:text-[#1e40af]"
            >
              Go to Dashboard
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border-2 border-[#B89A5A]/20">
            <div className="w-20 h-20 bg-[#F7F5EF] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">No transactions yet</h3>
            <p className="text-gray-600 mb-6">Create your first transaction to start tracking deadlines</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-white text-[#B89A5A] px-6 py-3 rounded-lg font-semibold border-2 border-[#B89A5A] hover:border-[#1e40af] hover:text-[#1e40af]"
            >
              Create First Transaction
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-white rounded-xl p-6 border-2 border-[#B89A5A]/20 hover:border-[#B89A5A] hover:shadow-lg transition-all cursor-pointer"
                onClick={() => handleViewTransaction(transaction.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-800">{transaction.property_address}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        transaction.transaction_type === 'buyer'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {transaction.transaction_type.toUpperCase()}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        transaction.status === 'active'
                          ? 'bg-[#F7F5EF] text-[#B89A5A]'
                          : transaction.status === 'closed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {transaction.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3">
                      <strong>Client:</strong> {transaction.clients.name}
                    </p>
                    <div className="flex gap-6 text-sm text-gray-600">
                      <div>
                        <span className="font-semibold">Contract:</span> {new Date(transaction.contract_date).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="font-semibold">Closing:</span> {new Date(transaction.closing_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <svg className="w-6 h-6 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">New Transaction</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Client *
                </label>
                <select
                  required
                  value={transactionForm.client_id}
                  onChange={(e) => setTransactionForm({...transactionForm, client_id: e.target.value})}
                  className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] outline-none"
                >
                  <option value="">Select a client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Property Address *
                </label>
                <input
                  type="text"
                  required
                  value={transactionForm.property_address}
                  onChange={(e) => setTransactionForm({...transactionForm, property_address: e.target.value})}
                  className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] outline-none"
                  placeholder="123 Main St, City, State"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transaction Type *
                </label>
                <select
                  value={transactionForm.transaction_type}
                  onChange={(e) => setTransactionForm({...transactionForm, transaction_type: e.target.value})}
                  className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] outline-none"
                >
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Contract Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={transactionForm.contract_date}
                    onChange={(e) => setTransactionForm({...transactionForm, contract_date: e.target.value})}
                    className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Closing Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={transactionForm.closing_date}
                    onChange={(e) => setTransactionForm({...transactionForm, closing_date: e.target.value})}
                    className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={transactionForm.notes}
                  onChange={(e) => setTransactionForm({...transactionForm, notes: e.target.value})}
                  className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] outline-none resize-none"
                  rows="3"
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex gap-3 pt-4">
              <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 bg-white border-2 border-[#B89A5A] text-[#B89A5A] rounded-lg hover:border-[#1e40af] hover:text-[#1e40af] font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-white text-[#B89A5A] border-2 border-[#B89A5A] rounded-lg hover:border-[#1e40af] hover:text-[#1e40af] font-semibold transition-all"
                >
                  Create Transaction
                </button>
                <button 
                  onClick={() => router.push('/chat')}
                  className="px-4 py-2 text-gray-600 hover:text-white hover:bg-[#1e40af] transition"
                >
                  NAVIUS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}