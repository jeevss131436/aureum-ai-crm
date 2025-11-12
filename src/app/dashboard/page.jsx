  "use client"
  import { useEffect, useState } from 'react'
  import { supabase } from '@/utils/supabaseClient'
  import { useRouter } from 'next/navigation'  
  import Image from 'next/image'

  function PhoneNumberModal({ user, onComplete }) {
    const [phone, setPhone] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
  
    const formatPhoneNumber = (value) => {
      // Remove all non-digits
      const phoneNumber = value.replace(/\D/g, '')
      
      // Format as (XXX) XXX-XXXX
      if (phoneNumber.length <= 3) {
        return phoneNumber
      } else if (phoneNumber.length <= 6) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`
      } else {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
      }
    }
  
    const handlePhoneChange = (e) => {
      const formatted = formatPhoneNumber(e.target.value)
      setPhone(formatted)
    }
  
    const validatePhone = (phoneStr) => {
      const digits = phoneStr.replace(/\D/g, '')
      return digits.length === 10
    }
  
    const handleSubmit = async (e) => {
      e.preventDefault()
      setError('')
      
      if (!validatePhone(phone)) {
        setError('Please enter a valid 10-digit phone number')
        return
      }
  
      setLoading(true)
  
      try {
        // Convert to E.164 format for Twilio
        const e164Phone = '+1' + phone.replace(/\D/g, '')
        
        // Update user metadata
        const { error: updateError } = await supabase.auth.updateUser({
          data: { phone: e164Phone }
        })
  
        if (updateError) throw updateError
  
        onComplete()
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
  
    const handleSkip = () => {
      onComplete()
    }
  
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border-2 border-[#B89A5A]/20">
          <div className="mb-6">
            <div className="w-16 h-16 bg-[#F7F5EF] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 text-center mb-2">
              Enable SMS Briefings
            </h3>
            <p className="text-gray-600 text-center text-sm">
              Receive daily updates about your deadlines and transactions via text message
            </p>
          </div>
  
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mobile Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(555) 123-4567"
                maxLength={14}
                className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] focus:border-transparent outline-none transition-all"
              />
              {error && (
                <p className="text-red-600 text-sm mt-1">{error}</p>
              )}
            </div>
  
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <strong>Standard messaging rates apply.</strong> You can disable SMS briefings anytime from your profile settings.
                </div>
              </div>
            </div>
  
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 px-6 py-3 border-2 border-[#B89A5A] text-[#B89A5A] rounded-lg hover:bg-[#1e40af] hover:text-white hover:border-[#1e40af] font-semibold transition-all duration-200"
              >
                Skip for Now
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-white text-[#B89A5A] border-2 border-[#B89A5A] rounded-lg hover:border-[#1e40af] hover:text-[#1e40af] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? 'Saving...' : 'Enable SMS'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  export default function DashboardPage() {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [clients, setClients] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editingClient, setEditingClient] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [transactions, setTransactions] = useState([])
    const [upcomingDeadlines, setUpcomingDeadlines] = useState([])
    const [activeFilter, setActiveFilter] = useState('all') // 'all', 'hot', 'active', 'stale'
    const router = useRouter()
    const [recentBriefings, setRecentBriefings] = useState([])
    const [recentSMSBriefings, setRecentSMSBriefings] = useState([])
    const [briefingType, setBriefingType] = useState('email')
    const [showPhoneModal, setShowPhoneModal] = useState(false)

    
    // Form state
    const [clientForm, setClientForm] = useState({
      name: '',
      email: '',
      phone: '',
      notes: '',
      status: 'warm'
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
        
        // Check if user needs to add phone number
        if (!user.user_metadata?.phone) {
          // Small delay so the dashboard loads first
          setTimeout(() => setShowPhoneModal(true), 500)
        }
      }
    } 

    async function fetchData(userId) {
    // Fetch clients
    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    setClients(clientsData || [])

    // Fetch transactions
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
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    
    setTransactions(transactionsData || [])

    // Fetch upcoming deadlines (next 7 days)
    const today = new Date()
    const nextWeek = new Date()
    nextWeek.setDate(today.getDate() + 7)

    const { data: deadlinesData } = await supabase
      .from('timeline_items')
      .select(`
        *,
        transactions!inner (
          id,
          property_address,
          user_id,
          clients (
            name
          )
        )
      `)
      .eq('transactions.user_id', userId)
      .eq('completed', false)
      .gte('due_date', today.toISOString().split('T')[0])
      .lte('due_date', nextWeek.toISOString().split('T')[0])
      .order('due_date')
      // Fetch recent briefings
      const { data: briefingsData } = await supabase
      .from('briefings')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(5)

      setRecentBriefings(briefingsData || [])
      const { data: smsBriefingsData } = await supabase
      .from('sms_briefings')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(5)

    setRecentSMSBriefings(smsBriefingsData || [])    
    setUpcomingDeadlines(deadlinesData || [])
      }

  

    function openAddModal() {
      setEditingClient(null)
      setClientForm({ name: '', email: '', phone: '', notes: '', status: 'warm' })
      setShowModal(true)
    }

    function openEditModal(client) {
      setEditingClient(client)
      setClientForm({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        notes: client.notes || '',
        status: client.status
      })
      setShowModal(true)
    }

    async function handleSubmit(e) {
      e.preventDefault()
      
      if (editingClient) {
        const { data, error } = await supabase
          .from('clients')
          .update({
            ...clientForm,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingClient.id)
          .select()
        
        if (error) {
          alert('Error updating client: ' + error.message)
        } else {
          setClients(clients.map(c => c.id === editingClient.id ? data[0] : c))
          setShowModal(false)
        }
      } else {
        const { data, error } = await supabase
          .from('clients')
          .insert([
            {
              ...clientForm,
              user_id: user.id
            }
          ])
          .select()
        
        if (error) {
          alert('Error adding client: ' + error.message)
        } else {
          setClients([data[0], ...clients])
          setShowModal(false)
        }
      }
    }

    async function handleDelete(clientId) {
      if (!confirm('Are you sure you want to delete this client?')) {
        return
      }

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId)
      
      if (error) {
        alert('Error deleting client: ' + error.message)
      } else {
        setClients(clients.filter(c => c.id !== clientId))
      }
    }

    async function handleLogout() {
      await supabase.auth.signOut()
      router.push('/login')
    }

    async function handleSendTestBriefing(type = 'email') {
      const button = event.target
      button.disabled = true
      const originalText = button.textContent
      button.textContent = 'Sending...'
      
      try {
        const endpoint = type === 'sms' ? '/api/send-sms-briefing' : '/api/send-briefing'
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        })
        
        const data = await response.json()
        
        if (data.success) {
          if (type === 'sms') {
            alert(`✅ Daily briefing sent to ${user.user_metadata?.phone || 'your phone'}!\n\nCheck your messages.`)
          } else {
            alert(`✅ Daily briefing sent to ${user.email}!\n\nCheck your inbox.`)
          }
          // Refresh briefing history
          fetchData(user.id)
        } else {
          alert('❌ Error: ' + data.error)
        }
      } catch (error) {
        alert('❌ Failed to send briefing: ' + error.message)
      } finally {
        button.disabled = false
        button.textContent = originalText
      }
    } 

    // Get clients with active transactions
    const clientsWithTransactions = new Set(
      transactions
        .map(t => t.clients?.id)
        .filter(id => id !== undefined)
    )
    
  // Filter clients based on active filter
  const getFilteredClients = () => {
    let filtered = clients.filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone?.includes(searchTerm)
    )

    switch (activeFilter) {
      case 'hot':
        // Clients with transactions that have deadlines in next 48 hours
        const twoDaysFromNow = new Date()
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)
        const hotClientIds = new Set(
          upcomingDeadlines
            .filter(d => new Date(d.due_date) <= twoDaysFromNow)
            .map(d => d.transactions.clients?.name)
        )
        const clientsInHotTransactions = transactions
          .filter(t => hotClientIds.size > 0)
          .map(t => t.client_id)
        return filtered.filter(c => clientsInHotTransactions.includes(c.id))
      
      case 'active':
        // Clients with active transactions
        return filtered.filter(c => clientsWithTransactions.has(c.id))
      
      case 'stale':
        // Clients without any transactions
        return filtered.filter(c => !clientsWithTransactions.has(c.id))
      
      default:
        return filtered
    }
  }


  const filteredClients = getFilteredClients()

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[#F7F5EF]">
          <div className="text-[#B89A5A] text-lg font-medium animate-pulse">Loading...</div>
        </div>
      )
    }



    async function scheduleSmsBrief(clientData, summary) {
      const { phone, id: user_id } = clientData; // Assuming clientData has phone and user_id
    
      // 1. Get the current authenticated user's ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("User not authenticated.");
        return;
      }
      
      // 2. Determine when to schedule the SMS (e.g., 5 minutes from now for a test)
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60000).toISOString();
    
      // 3. Insert the new brief into the Supabase queue
      const { data, error } = await supabase
        .from('sms_briefings')
        .insert([
          {
            user_id: user.id, // RLS check
            phone_number: phone,
            ai_summary: summary.ai_summary,
            today_count: summary.today_count,
            tomorrow_count: summary.tomorrow_count,
            overdue_count: summary.overdue_count,
            scheduled_at: fiveMinutesFromNow, // Set the time for the scheduler to pick it up
            status: 'pending',
          },
        ]);
    
      if (error) {
        console.error('Error inserting SMS briefing:', error);
      } else {
        console.log('SMS Brief successfully scheduled:', data);
        // Optionally update your 'recentSMSBriefings' state here
      }
    }

    return (
      <div className="min-h-screen bg-[#F7F5EF]">
        {/* Header */}
  <header className="bg-white shadow-sm border-b-2 border-[#B89A5A]/20 sticky top-0 z-40 backdrop-blur-sm bg-opacity-95">
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
          <nav className="hidden md:flex gap-4">
            <button className="px-4 py-2 text-[#B89A5A] font-semibold border-b-2 border-[#B89A5A]">
              Dashboard
            </button>
            <button 
              onClick={() => router.push('/transactions')}
              className="px-4 py-2 text-gray-600 hover:text-[#1e40af] transition"
            >
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
        <div className="flex items-center gap-4">
        <div 
  onClick={() => router.push('/profile')}
  className="hidden sm:flex items-center gap-3 px-5 py-2.5 bg-white border-2 border-gray-200 hover:border-[#B89A5A] cursor-pointer transition-all group"
  title="View Profile"
>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm text-gray-700 font-medium group-hover:text-[#B89A5A] transition-colors">
          {user?.user_metadata?.full_name || user?.email}
        </span>
        {user?.user_metadata?.phone ? (
          <svg className="w-4 h-4 text-[#B89A5A] group-hover:text-[#B89A5A]/70 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        ) : (
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-semibold">
            Add Phone
          </span>
        )}
        <svg className="w-4 h-4 text-gray-400 group-hover:text-[#B89A5A] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
          <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm font-medium text-[#B89A5A] hover:text-[#1e40af] bg-white border border-[#B89A5A] hover:border-[#1e40af] rounded-lg transition-all duration-200"
        >
          Sign Out
        </button>
        </div>
      </div>
    </div>
  </header>


        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Banner */}
            {/* Welcome Banner with Briefing Options */}
            <div className="relative overflow-hidden bg-gradient-to-r from-[#B89A5A] to-[#9B8049] shadow-xl mb-8 p-8 rounded-xl">
  <div className="relative z-10">
    <h2 className="text-3xl font-bold text-white mb-2">
      Welcome Back, {user?.user_metadata?.first_name || user?.user_metadata?.full_name?.split(' ')[0] || 'there'}! 👋
    </h2>
    <p className="text-white/90 mb-6">Stay on top of your deals with instant briefings</p>

    {/* Briefing Action Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Email Brief Card */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border-2 border-white/20 hover:border-white hover:bg-white/20 transition-all duration-300 group">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">Email Brief</h3>
              <p className="text-white/70 text-sm">Detailed summary to {user?.email?.substring(0, 20)}...</p>
            </div>
          </div>
        </div>
        <button
          onClick={(e) => handleSendTestBriefing('email')}
          className="w-full bg-white text-[#B89A5A] px-6 py-3 rounded-lg font-semibold hover:bg-[#1e40af] hover:text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Send Email Brief
        </button>
      </div>

      {/* SMS Brief Card */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border-2 border-white/20 hover:border-white hover:bg-white/20 transition-all duration-300 group">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">SMS Brief</h3>
              <p className="text-white/70 text-sm">
                {user?.user_metadata?.phone 
                  ? `Quick text to ${user.user_metadata.phone.substring(0, 8)}...`
                  : 'Add phone number to enable'
                }
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={(e) => handleSendTestBriefing('sms')}
          disabled={!user?.user_metadata?.phone}
          className={`w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
            user?.user_metadata?.phone
              ? 'bg-white text-[#B89A5A] hover:bg-[#1e40af] hover:text-white hover:shadow-xl transform hover:scale-105'
              : 'bg-white/30 text-white/50 cursor-not-allowed'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          {user?.user_metadata?.phone ? 'Send SMS Brief' : 'Add Phone Number'}
        </button>
        {!user?.user_metadata?.phone && (
          <button
          onClick={() => router.push('/profile')}
            className="w-full mt-2 text-white/80 hover:text-white text-sm underline transition-colors"
          >
            Click here to add phone
          </button>
        )}
      </div>
    </div>
  </div>
  
  {/* Decorative Elements */}
  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
  <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
</div>

        {/* Recent Briefings - Combined Email & SMS */}
        {(recentBriefings.length > 0 || recentSMSBriefings.length > 0) && (
          <div className="bg-white shadow-md border border-[#B89A5A]/20 p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📬 Recent Briefings</h3>
            
            {/* Briefing History Tabs */}
            <div className="flex gap-2 mb-4 border-b border-gray-200">
              <button
                onClick={() => setBriefingType('email')}
                className={`px-4 py-2 font-medium transition-all ${
                  briefingType === 'email'
                    ? 'text-[#B89A5A] border-b-2 border-[#B89A5A]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📧 Email ({recentBriefings.length})
              </button>
              <button
                onClick={() => setBriefingType('sms')}
                className={`px-4 py-2 font-medium transition-all ${
                  briefingType === 'sms'
                    ? 'text-[#B89A5A] border-b-2 border-[#B89A5A]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📱 SMS ({recentSMSBriefings.length})
              </button>
            </div>

            <div className="space-y-3">
              {briefingType === 'email' ? (
                recentBriefings.length > 0 ? (
                  recentBriefings.map((briefing) => (
                    <div key={briefing.id} className="p-4 bg-[#F7F5EF] rounded-lg border border-[#B89A5A]/10">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm font-semibold text-gray-700">
                            {new Date(briefing.sent_at).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            Today: {briefing.today_count}
                          </span>
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                            Tomorrow: {briefing.tomorrow_count}
                          </span>
                          {briefing.overdue_count > 0 && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                              Overdue: {briefing.overdue_count}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{briefing.ai_summary}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No email briefs sent yet</p>
                )
              ) : (
                recentSMSBriefings.length > 0 ? (
                  recentSMSBriefings.map((briefing) => (
                    <div key={briefing.id} className="p-4 bg-[#F7F5EF] rounded-lg border border-[#B89A5A]/10">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm font-semibold text-gray-700">
                            {new Date(briefing.sent_at).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </span>
                          <span className="text-xs text-gray-500">
                            to {briefing.phone_number}
                          </span>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            Today: {briefing.today_count}
                          </span>
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                            Tomorrow: {briefing.tomorrow_count}
                          </span>
                          {briefing.overdue_count > 0 && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                              Overdue: {briefing.overdue_count}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{briefing.ai_summary}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No SMS briefs sent yet</p>
                )
              )}
            </div>
          </div>
        )}


          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="group bg-white shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-[#B89A5A]/20">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-[#F7F5EF] rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <div className="w-12 h-12 bg-[#F7F5EF] rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Image 
                  src="/icons/scroll.svg" 
                  alt="Clients Icon" 
                  width={24} 
                  height={24}
                  className="object-contain"
                />
              </div>
                </div>
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">Active</span>
              </div>
              <p className="text-sm text-gray-500 font-medium mb-1">Total Clients</p>
              <p className="text-4xl font-bold text-[#B89A5A]">{clients.length}</p>
            </div>

            <div 
              onClick={() => router.push('/transactions')}
              className="group bg-white shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-[#B89A5A]/20 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-[#F7F5EF] rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">In Progress</span>
              </div>
              <p className="text-sm text-gray-500 font-medium mb-1">Active Transactions</p>
              <p className="text-4xl font-bold text-[#B89A5A]">{transactions.length}</p>
            </div>

            <div className="group bg-white shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-[#B89A5A]/20">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-[#F7F5EF] rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-[#B89A5A] bg-[#F7F5EF] px-2 py-1 rounded-full">Next 7 Days</span>
              </div>
              <p className="text-sm text-gray-500 font-medium mb-1">Upcoming Deadlines</p>
              <p className="text-4xl font-bold text-[#B89A5A]">{upcomingDeadlines.length}</p>
            </div>
          </div>

          {/* Recent Briefings */}
            {recentBriefings.length > 0 && (
              <div className="bg-white shadow-md border border-[#B89A5A]/20 p-6 mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">📧 Recent Briefings</h3>
                <div className="space-y-3">
                  {recentBriefings.map((briefing) => (
                    <div key={briefing.id} className="p-4 bg-[#F7F5EF] rounded-lg border border-[#B89A5A]/10">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-semibold text-gray-700">
                          {new Date(briefing.sent_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </span>
                        <div className="flex gap-2 text-xs">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            Today: {briefing.today_count}
                          </span>
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                            Tomorrow: {briefing.tomorrow_count}
                          </span>
                          {briefing.overdue_count > 0 && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                              Overdue: {briefing.overdue_count}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{briefing.ai_summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}



          {/* Upcoming Deadlines Section */}
            {upcomingDeadlines.length > 0 && (
              <div className="bg-white shadow-md border border-[#B89A5A]/20 p-6 mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Urgent: Upcoming Deadlines
                </h3>
                <div className="space-y-3">
                  {upcomingDeadlines.slice(0, 5).map((deadline) => {
                    const daysUntil = Math.ceil((new Date(deadline.due_date) - new Date()) / (1000 * 60 * 60 * 24))
                    return (
                      <div
                        key={deadline.id}
                        onClick={() => router.push(`/transactions/${deadline.transaction_id}`)}
                        className="flex items-center justify-between p-4 border border-[#B89A5A]/20 rounded-lg hover:border-[#B89A5A] hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{deadline.title}</h4>
                          <p className="text-sm text-gray-600">{deadline.transactions.property_address}</p>
                          <p className="text-xs text-gray-500 mt-1">Client: {deadline.transactions.clients?.name || 'Unknown'}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            daysUntil <= 1 ? 'bg-red-100 text-red-700' :
                            daysUntil <= 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {daysUntil === 0 ? 'Due Today' : daysUntil === 1 ? 'Due Tomorrow' : `${daysUntil} days`}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">{new Date(deadline.due_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          {/* Clients Section */}
          <div className="bg-white shadow-md border border-[#B89A5A]/20 overflow-hidden">
            <div className="bg-gradient-to-r from-[#F7F5EF] to-white px-6 py-5 border-b border-[#B89A5A]/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">Your Clients</h3>
                <p className="text-sm text-gray-500 mt-1">Manage and track all your client relationships</p>
              </div>
              <button 
                onClick={openAddModal}
                className="bg-white text-[#B89A5A] px-6 py-2.5 rounded-lg font-semibold border-2 border-[#B89A5A] hover:border-[#1e40af] hover:text-[#1e40af] transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Client
              </button>
            </div>

            {/* Smart List Filters */}
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeFilter === 'all'
                      ? 'bg-[#B89A5A] text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All Clients ({clients.length})
                </button>
                <button
                  onClick={() => setActiveFilter('hot')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeFilter === 'hot'
                      ? 'bg-red-500 text-white shadow-md'
                      : 'bg-red-50 text-red-600 hover:bg-red-100'
                  }`}
                >
                  🔥 Hot Deals
                </button>
                <button
                  onClick={() => setActiveFilter('active')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeFilter === 'active'
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  Active Transactions ({clientsWithTransactions.size})
                </button>
                <button
                  onClick={() => setActiveFilter('stale')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeFilter === 'stale'
                      ? 'bg-gray-500 text-white shadow-md'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Nurture Leads ({clients.length - clientsWithTransactions.size})
                </button>
              </div>

            <div className="p-6">
              {/* Search Bar */}
              {clients.length > 0 && (
                <div className="mb-6">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by name, email, or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-3 pl-11 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] focus:border-transparent outline-none transition-all"
                    />
                    <svg className="w-5 h-5 text-[#B89A5A] absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Client List */}
              {filteredClients.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-[#F7F5EF] rounded-full mb-6">
                    <svg className="w-10 h-10 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {searchTerm ? 'No clients found' : 'No clients yet'}
                  </h3>
                  <p className="text-gray-500 mb-6">
                    {searchTerm 
                      ? 'Try adjusting your search terms' 
                      : 'Start building your client base by adding your first client'}
                  </p>
                  {!searchTerm && (
                    <button 
                      onClick={openAddModal}
                      className="bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white px-8 py-3 rounded-lg font-semibold hover:bg-gradient-to-r hover:from-[#1e40af] hover:to-[#1e3a8a] hover:shadow-lg transform hover:scale-105 transition-all duration-200 inline-flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Your First Client
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredClients.map((client) => (
                    <div 
                      key={client.id} 
                      className="border border-[#B89A5A]/20 p-5 hover:border-[#B89A5A] hover:shadow-md transition-all duration-200 bg-white"
                    >
                      <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-3 mb-2">
                            <div className="w-10 h-10 bg-[#F7F5EF] rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                              <span className="text-[#B89A5A] font-semibold text-lg">
                                {client.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-lg text-gray-800">{client.name}</h4>
                              {clientsWithTransactions.has(client.id) && (
                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                  Active Deal
                                </span>
                              )}
                            </div>
                              {client.email && (
                                <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  {client.email}
                                </p>
                              )}
                              {client.phone && (
                                <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  {client.phone}
                                </p>
                              )}
                              {client.notes && (
                                <p className="text-sm text-gray-500 mt-3 p-3 bg-[#F7F5EF] rounded-lg border border-[#B89A5A]/10">
                                  {client.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            client.status === 'hot' ? 'bg-red-100 text-red-700 border border-red-200' :
                            client.status === 'warm' ? 'bg-[#F7F5EF] text-[#B89A5A] border border-[#B89A5A]/30' :
                            'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}>
                            {client.status.toUpperCase()}
                          </span>
                          <div className="flex gap-2">
                          <button
                                onClick={() => openEditModal(client)}
                                className="text-[#B89A5A] hover:text-[#1e40af] bg-white border border-[#B89A5A] hover:border-[#1e40af] px-3 py-1 rounded text-sm font-medium transition-all duration-200"
                              >
                                Edit
                              </button>
                              <button
                              onClick={() => handleDelete(client.id)}
                              className="text-red-600 hover:text-[#1e40af] bg-white border border-red-600 hover:border-[#1e40af] px-3 py-1 rounded text-sm font-medium transition-all duration-200"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Add/Edit Client Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border-2 border-[#B89A5A]/20">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800">
                  {editingClient ? 'Edit Client' : 'Add New Client'}
                </h3>
                <button 
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientForm.name}
                    onChange={(e) => setClientForm({...clientForm, name: e.target.value})}
                    className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] focus:border-transparent outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({...clientForm, email: e.target.value})}
                    className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] focus:border-transparent outline-none transition-all"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({...clientForm, phone: e.target.value})}
                    className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] focus:border-transparent outline-none transition-all"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={clientForm.status}
                    onChange={(e) => setClientForm({...clientForm, status: e.target.value})}
                    className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] focus:border-transparent outline-none transition-all bg-white"
                  >
                    <option value="hot">🔥 Hot</option>
                    <option value="warm">☀️ Warm</option>
                    <option value="cold">❄️ Cold</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={clientForm.notes}
                    onChange={(e) => setClientForm({...clientForm, notes: e.target.value})}
                    className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] focus:border-transparent outline-none transition-all resize-none"
                    placeholder="Additional notes about this client..."
                    rows="3"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-3 border-2 border-[#B89A5A] text-[#B89A5A] rounded-lg hover:bg-[#1e40af] hover:text-white hover:border-[#1e40af] font-semibold transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-white text-[#B89A5A] border-2 border-[#B89A5A] rounded-lg hover:border-[#1e40af] hover:text-[#1e40af] font-semibold transform hover:scale-105 transition-all duration-200"
                  >
                    {editingClient ? 'Update' : 'Add Client'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Phone Number Modal */}
        {showPhoneModal && (
          <PhoneNumberModal 
            user={user} 
            onComplete={() => {
              setShowPhoneModal(false)
              checkUser() // Refresh user data to update phone status
            }} 
          />
        )}

      </div>
    )
  }
