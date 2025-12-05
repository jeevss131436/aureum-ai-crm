'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

// Briefing Carousel Component
function BriefingCarousel({ totalClients, hotLeads, activeDeals, clients, transactions, user, router }) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  
  // Generate slides based on data
  const generateSlides = () => {
    const slides = []
    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.user_metadata?.first_name || 'there'
    const timeOfDay = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'

    // Slide 1: Overview (Always first)
    slides.push({
      title: `Good ${timeOfDay}, ${firstName}!`,
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      content: hotLeads > 0 && activeDeals > 0 
        ? `You have ${hotLeads} hot lead${hotLeads !== 1 ? 's' : ''} requiring immediate attention and ${activeDeals} active deal${activeDeals !== 1 ? 's' : ''} in progress. Focus on converting your hot leads while maintaining momentum on existing transactions. Your pipeline shows strong potential for this week.`
        : hotLeads > 0 
        ? `You have ${hotLeads} hot lead${hotLeads !== 1 ? 's' : ''} waiting for your attention. These are your highest-priority prospects—reach out today to maintain momentum. Consider scheduling follow-ups to move them closer to conversion.`
        : activeDeals > 0 
        ? `You have ${activeDeals} active deal${activeDeals !== 1 ? 's' : ''} in your pipeline. Stay on top of deadlines and maintain regular communication with your clients. Consider reaching out to warm leads to build your pipeline for next month.`
        : totalClients > 0 
        ? `You have ${totalClients} client${totalClients !== 1 ? 's' : ''} in your database. Focus on nurturing these relationships and converting warm leads into hot prospects. Consider sending personalized follow-ups to gauge their current interest level.`
        : `Welcome to Aureum! Start by adding your first client or transaction to begin tracking your real estate business. Use the "New Transaction" button below to get started.`
    })

    // Slide 2: Upcoming Deadlines
    const upcomingDeadlines = []
    transactions.forEach(trans => {
      const transWithClient = {
        ...trans,
        client: clients.find(c => c.id === trans.client_id)
      }
      if (trans.closing_date) {
        const daysUntil = Math.ceil((new Date(trans.closing_date) - new Date()) / (1000 * 60 * 60 * 24))
        if (daysUntil >= 0 && daysUntil <= 14) {
          upcomingDeadlines.push({ ...transWithClient, daysUntil, type: 'closing' })
        }
      }
    })
    
    if (upcomingDeadlines.length > 0) {
      upcomingDeadlines.sort((a, b) => a.daysUntil - b.daysUntil)
      const urgent = upcomingDeadlines.slice(0, 3)
      const names = urgent.map(d => d.client?.name || 'Unknown').join(', ')
      const count = urgent.length
      
      slides.push({
        title: 'Urgent Deadlines',
        icon: (
          <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        content: count === 1
          ? `${urgent[0].client?.name || 'A transaction'} has a closing deadline in ${urgent[0].daysUntil} day${urgent[0].daysUntil !== 1 ? 's' : ''}. Consider reaching out to ensure everything is on track for a smooth closing.`
          : `${count} closings are coming up in the next 2 weeks. Consider reaching out to ${names} to ensure all signatures and documents are ready to move forward.`
      })
    }

    // Slide 3: Hot Leads Action
    const hotLeadsList = clients.filter(c => c.status === 'hot').slice(0, 3)
    if (hotLeadsList.length > 0) {
      const names = hotLeadsList.map(c => c.name).join(', ')
      slides.push({
        title: 'Hot Leads',
        icon: (
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          </svg>
        ),
        content: hotLeadsList.length === 1
          ? `${hotLeadsList[0].name} is a hot lead and highly engaged. I recommend following up today to keep momentum strong and move toward conversion.`
          : `You have ${hotLeadsList.length} hot leads: ${names}. These prospects are highly engaged—reach out today to maintain momentum and move them toward closing.`
      })
    }

    // Slide 4: Warm Leads Follow-up
    const warmLeads = clients.filter(c => c.status === 'warm').slice(0, 3)
    if (warmLeads.length > 0) {
      const leadExample = warmLeads[0]
      slides.push({
        title: 'Warm Lead Follow-up',
        icon: (
          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        ),
        content: warmLeads.length === 1
          ? `${leadExample.name} is a warm lead. Consider sending a personalized follow-up to gauge their current interest level and move them closer to a decision.`
          : `You have ${warmLeads.length} warm leads waiting for follow-up. ${leadExample.name} and others could benefit from a check-in message to keep them engaged.`
      })
    }

    // Slide 5: Active Transactions Progress
    const activeTransactions = transactions.filter(t => t.status === 'active')
    if (activeTransactions.length > 0) {
      const transExample = activeTransactions[0]
      const clientName = clients.find(c => c.id === transExample.client_id)?.name || 'Client'
      
      slides.push({
        title: 'Active Transactions',
        icon: (
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        content: activeTransactions.length === 1
          ? `You have 1 active transaction with ${clientName} at ${transExample.property_address}. Keep communication consistent and stay on top of any upcoming milestones.`
          : `You have ${activeTransactions.length} active transactions in progress. Keep communication strong with all clients and monitor upcoming deadlines closely to ensure smooth closings.`
      })
    }

    return slides.length > 1 ? slides : slides // Return at least overview
  }

  const slides = generateSlides()

  // Auto-advance slides
  useEffect(() => {
    if (!isAutoPlaying || slides.length <= 1) return
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000) // 5 seconds per slide

    return () => clearInterval(interval)
  }, [isAutoPlaying, slides.length])

  const goToSlide = (index) => {
    setCurrentSlide(index)
    setIsAutoPlaying(false)
  }

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
    setIsAutoPlaying(false)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
    setIsAutoPlaying(false)
  }

  

  function getRankingExplanation(client, leadScore) {
  const factors = []
  
  // Analyze what contributes to the ranking
  if (leadScore >= 70) {
    if (client.last_contact) {
      const daysSinceContact = Math.floor((new Date() - new Date(client.last_contact)) / (1000 * 60 * 60 * 24))
      if (daysSinceContact <= 3) {
        factors.push("Recent engagement (contacted within 3 days)")
      }
    }
    if (client.status === 'hot') {
      factors.push("Hot lead status indicates high intent")
    }
    if (client.property_preferences?.budget_max) {
      factors.push("Clear budget defined")
    }
  } else if (leadScore >= 40) {
    if (client.status === 'warm') {
      factors.push("Warm lead - needs nurturing")
    }
    const daysSinceContact = client.last_contact 
      ? Math.floor((new Date() - new Date(client.last_contact)) / (1000 * 60 * 60 * 24))
      : 999
    if (daysSinceContact > 7) {
      factors.push("No contact in over a week")
    }
  } else {
    factors.push("Cold lead - low recent activity")
    if (!client.last_contact) {
      factors.push("Never contacted")
    }
  }
  
  return factors.length > 0 ? factors : ["Score based on engagement patterns"]
}

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#B89A5A] via-[#C4A965] to-[#D4B87C] px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <Image src="/aureum-logo.png" alt="Navius" width={48} height={48} className="object-contain" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white" style={{ fontFamily: 'Trajan Pro, serif' }}>
                Daily Briefing
              </h3>
              <p className="text-white/90 text-sm flex items-center gap-2 mt-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl backdrop-blur-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-medium">AI Insights</span>
          </div>
        </div>
      </div>

      {/* Briefing Content */}
      <div className="p-8">
        <div className="space-y-6">
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-3 gap-4 pb-6 border-b border-gray-200">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">{totalClients}</p>
              <p className="text-xs text-gray-600 font-medium mt-1">Total Clients</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{hotLeads}</p>
              <p className="text-xs text-gray-600 font-medium mt-1">Hot Leads</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{activeDeals}</p>
              <p className="text-xs text-gray-600 font-medium mt-1">Active Deals</p>
            </div>
          </div>

          {/* Carousel Slides */}
          <div className="relative">
            {/* Slide Content */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100 min-h-[180px]">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  {slides[currentSlide].icon}
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-gray-900 mb-2">
                    {slides[currentSlide].title}
                  </h4>
                  <p className="text-base leading-relaxed text-gray-800">
                    {slides[currentSlide].content}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Arrows (only show if multiple slides) */}
            {slides.length > 1 && (
              <>
                <button
                  onClick={prevSlide}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 bg-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 bg-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Slide Indicators (only show if multiple slides) */}
          {slides.length > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`transition-all ${
                    index === currentSlide
                      ? 'w-8 h-2 bg-[#B89A5A]'
                      : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                  } rounded-full`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4">

            
            <button
              onClick={() => router.push('/chat')}
              className="flex-1 min-w-[200px] px-6 py-3 bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white rounded-xl font-semibold hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              <Image src="/aureum-logo.png" alt="Navius" width={20} height={20} className="object-contain" />
              Chat with Navius
            </button>

              

            <button
              onClick={() => router.push('/transactions')}
              className="flex-1 min-w-[200px] px-6 py-3 bg-white text-gray-900 rounded-xl font-semibold border-2 border-gray-200 hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Transaction
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
// Upgrade Promotion Banner Component
function UpgradeBanner({ subscription, router }) {
  const [dismissed, setDismissed] = useState(false)
  
  // Don't show if lifetime user or dismissed
  if (subscription?.plan?.type === 'lifetime' || dismissed) return null
  
  const isTeam = subscription?.plan?.name === 'Team Plan'
  
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-2xl p-6 mb-8 shadow-xl">
      {/* Animated background elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#B89A5A]/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#B89A5A]/10 rounded-full blur-2xl -ml-24 -mb-24"></div>
      
      {/* Dismiss button */}
      <button 
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      <div className="relative z-10 flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {/* Star icon */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#B89A5A] to-[#D4B96A] flex items-center justify-center shadow-lg">
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-white">
                {isTeam ? 'Lock In Lifetime Access' : 'Upgrade to Lifetime'}
              </h3>
              <span className="px-2 py-0.5 bg-[#B89A5A]/20 text-[#D4B96A] text-xs font-semibold rounded-full border border-[#B89A5A]/30">
                Limited Spots
              </span>
            </div>
            <p className="text-white/70 text-sm max-w-md">
              Pay once, own forever. No more monthly payments. Only <span className="text-[#D4B96A] font-semibold">8 spots left</span> at the early bird price of $3,500.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden lg:block">
            <p className="text-white/50 text-xs line-through">$5,000</p>
            <p className="text-2xl font-bold text-white">$3,500</p>
          </div>
          <button
            onClick={() => router.push('/profile')}
            className="px-6 py-3 bg-gradient-to-r from-[#B89A5A] to-[#D4B96A] text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <span>View Plans</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Savings callout */}
      <div className="relative z-10 mt-4 flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-white/80 text-xs">All future features included</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-white/80 text-xs">Priority support for life</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-white/80 text-xs">Save $2,324+ over 3 years</span>
        </div>
      </div>
    </div>
  )
}
export default function DashboardPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [clients, setClients] = useState([])
  const [transactions, setTransactions] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [showClientModal, setShowClientModal] = useState(false)
  const [leadTypeFilter, setLeadTypeFilter] = useState('all') // 'all', 'buyer', 'seller', 'past_client'
  const [showRankingTooltip, setShowRankingTooltip] = useState(null) // Track which client's tooltip is showing
  const router = useRouter()
  const [subscription, setSubscription] = useState({
  plan: { name: 'Solo Plan', type: 'monthly', price: 98 },
  status: 'active',
  nextBilling: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
})

  // Add animation styles
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes fade-in {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .animate-fade-in {
        animation: fade-in 1s ease-out;
      }
      
      /* Smooth scrolling without snap */
      .smooth-scroll {
        scroll-behavior: smooth;
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/'
    } else {
      setUser(user)
      await fetchDashboardData(user.id)
      setLoading(false)
    }
  }

  async function fetchDashboardData(userId) {
  try {
    // Fetch transactions with their linked clients
    const { data: transactionsData, error: transError } = await supabase
      .from('transactions')
      .select(`
        *,
        clients (
          id,
          name,
          email,
          phone,
          status,
          last_contact,
          created_at,
          property_preferences
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (transError) {
      console.error('Error fetching transactions:', transError)
    }

    console.log('Fetched transactions:', transactionsData)
    setTransactions(transactionsData || [])
    
    // Extract unique clients from transactions
    const clientsMap = new Map()
    
    transactionsData?.forEach(transaction => {
      if (transaction.clients) {
        const clientId = transaction.clients.id
        if (!clientsMap.has(clientId)) {
          clientsMap.set(clientId, {
            ...transaction.clients,
            lead_type: transaction.transaction_type, // buyer or seller
            transaction_id: transaction.id
          })
        }
      }
    })

    const clientsArray = Array.from(clientsMap.values())
    setClients(clientsArray)

  } catch (error) {
    console.error('Error in fetchDashboardData:', error)
  }
}

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // Calculate AI Lead Score (0-100)
  function calculateLeadScore(client) {
    let score = 50 // Base score

    // Activity factors
    const daysSinceLastContact = client.last_contact 
      ? Math.floor((new Date() - new Date(client.last_contact)) / (1000 * 60 * 60 * 24))
      : 999

    // Recent contact = higher score
    if (daysSinceLastContact < 7) score += 30
    else if (daysSinceLastContact < 14) score += 20
    else if (daysSinceLastContact < 30) score += 10
    else score -= 20

    // Status impact
    if (client.status === 'active') score += 20
    else if (client.status === 'lead') score += 10
    else if (client.status === 'cold') score -= 30

    // Phone and email presence
    if (client.phone) score += 5
    if (client.email) score += 5

    // Has active transactions
    const clientTransactions = transactions.filter(t => t.client_id === client.id)
    score += clientTransactions.length * 10

    // Normalize to 0-100
    return Math.max(0, Math.min(100, score))
  }

  function getLeadRanking(score) {
    if (score >= 75) return { label: 'Hot Lead', color: 'from-red-500 to-orange-500', textColor: 'text-red-600', bgColor: 'bg-red-50' }
    if (score >= 50) return { label: 'Warm Lead', color: 'from-yellow-500 to-orange-400', textColor: 'text-yellow-600', bgColor: 'bg-yellow-50' }
    return { label: 'Cold Lead', color: 'from-blue-500 to-cyan-500', textColor: 'text-blue-600', bgColor: 'bg-blue-50' }
  }

  function getTierBadge(subscription) {
  if (!subscription) return null;
  
  if (subscription.plan?.type === 'lifetime') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-[#B89A5A] to-[#D4B96A] text-white text-xs font-semibold rounded-full shadow-sm">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        Lifetime
      </span>
    )
  }
  if (subscription.plan?.name === 'Team Plan') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Team
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      Solo
    </span>
  )
}

  function getRankingExplanation(client, leadScore) {
  const factors = []
  
  if (leadScore >= 70) {
    if (client.last_contact) {
      const daysSinceContact = Math.floor((new Date() - new Date(client.last_contact)) / (1000 * 60 * 60 * 24))
      if (daysSinceContact <= 3) {
        factors.push("Recent engagement (contacted within 3 days)")
      }
    }
    if (client.status === 'hot') {
      factors.push("Hot lead status indicates high intent")
    }
    if (client.property_preferences?.budget_max) {
      factors.push("Clear budget defined")
    }
  } else if (leadScore >= 40) {
    if (client.status === 'warm') {
      factors.push("Warm lead - needs nurturing")
    }
    const daysSinceContact = client.last_contact 
      ? Math.floor((new Date() - new Date(client.last_contact)) / (1000 * 60 * 60 * 24))
      : 999
    if (daysSinceContact > 7) {
      factors.push("No contact in over a week")
    }
  } else {
    factors.push("Cold lead - low recent activity")
    if (!client.last_contact) {
      factors.push("Never contacted")
    }
  }
  
  return factors.length > 0 ? factors : ["Score based on engagement patterns"]
}

  const filteredClients = useMemo(() => {
  return clients.filter(client => {
    const matchesSearch = !searchQuery || 
      client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone?.includes(searchQuery)
    
    const matchesLeadType = leadTypeFilter === 'all' || 
      client.lead_type === leadTypeFilter
    
    return matchesSearch && matchesLeadType
  })
}, [clients, searchQuery, leadTypeFilter])

  // Calculate stats
  const activeDeals = transactions.filter(t => t.status === 'active').length
  const hotLeads = filteredClients.filter(c => calculateLeadScore(c) >= 75).length
  const totalClients = clients.length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#B89A5A]/20 border-t-[#B89A5A] rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
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

        {/* Account Tier Badge */}
        {sidebarOpen && (
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Account</span>
              {getTierBadge()}
            </div>
            {/* Small Upgrade Button - Only for non-lifetime users */}
            {subscription.plan.type !== 'lifetime' && (
              <button
                onClick={() => router.push('/billing')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#B89A5A]/10 to-[#D4B96A]/10 hover:from-[#B89A5A]/20 hover:to-[#D4B96A]/20 border border-[#B89A5A]/30 text-[#B89A5A] text-xs font-medium rounded-lg transition-all group"
              >
                <svg className="w-3 h-3 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span>Upgrade to Lifetime</span>
              </button>
            )}
          </div>
        )}
        {!sidebarOpen && subscription && (
          <div className="py-3 border-b border-gray-200 flex flex-col items-center gap-2">
            {getTierBadge()}
            {/* Small star icon upgrade hint when collapsed */}
            {subscription.plan.type !== 'lifetime' && (
              <button
                onClick={() => router.push('/billing')}
                className="w-8 h-8 flex items-center justify-center bg-gradient-to-r from-[#B89A5A]/10 to-[#D4B96A]/10 hover:from-[#B89A5A]/20 hover:to-[#D4B96A]/20 border border-[#B89A5A]/30 text-[#B89A5A] rounded-lg transition-all"
                title="Upgrade to Lifetime"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Navigation Links - No Billing link */}
        <nav className="p-4 space-y-2">
          <button
            onClick={() => router.push('/dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              sidebarOpen ? 'justify-start' : 'justify-center'
            } bg-[#B89A5A]/10 text-[#B89A5A] font-medium`}
          >
            <Image src="/house-line.svg" alt="Dashboard" width={28} height={28} className="object-contain" />
            {sidebarOpen && <span>Dashboard</span>}
          </button>

          <button
            onClick={() => router.push('/transactions')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              sidebarOpen ? 'justify-start' : 'justify-center'
            } text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
          >
            <Image src="/clipboard-text.svg" alt="Transactions" width={28} height={28} className="object-contain" />
            {sidebarOpen && <span>Transactions</span>}
          </button>

          <button
            onClick={() => router.push('/calendar')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              sidebarOpen ? 'justify-start' : 'justify-center'
            } text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
          >
            <Image src="/calendar-dots.svg" alt="Calendar" width={28} height={28} className="object-contain" />
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
            <Image src="/user-circle.svg" alt="Profile" width={28} height={28} className="object-contain" />
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
              <h1 style={{ fontFamily: 'Trajan Pro, serif' }} className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <div className="flex items-center gap-4">
                {/* Subscription Badge */}
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#B89A5A]/10 to-[#9B8049]/10 rounded-xl border border-[#B89A5A]/20">
                  <div className={`w-2 h-2 rounded-full ${
                    user?.user_metadata?.subscription_status === 'active' ? 'bg-green-500' :
                    user?.user_metadata?.subscription_status === 'cancelled' ? 'bg-yellow-500' :
                    'bg-gray-400'
                  }`}></div>
                  <span className="text-sm font-semibold text-gray-700">
                    {user?.user_metadata?.subscription_plan?.toUpperCase() || 'FREE'} Plan
                  </span>
                  {user?.user_metadata?.subscription_status === 'cancelled' && (
                    <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                      Cancelled
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  Welcome, <span className="font-semibold text-gray-900">{user?.user_metadata?.full_name || user?.email}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="smooth-scroll h-[calc(100vh-4rem)] overflow-y-auto">
          
          {/* Welcome Section - Full Screen */}
          <section className="min-h-[calc(100vh-4rem)] flex items-center justify-center relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-20 left-10 w-72 h-72 bg-[#B89A5A]/10 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#9B8049]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-[#B89A5A]/5 to-[#9B8049]/5 rounded-full blur-3xl"></div>
            </div>

            {/* Welcome Content */}
            <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
              <div className="mb-8 animate-fade-in">
                <div className="inline-flex items-center justify-center mb-6">
                  <Image src="/aureum-logo.png" alt="Aureum" width={120} height={120} className="object-contain drop-shadow-2xl" />
                </div>
                
                <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-[#B89A5A] via-[#9B8049] to-[#8B7039] bg-clip-text text-transparent" style={{ fontFamily: 'Trajan Pro, serif' }}>
                  Welcome Back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''}
                </h1>
                
                <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
                  Your AI-powered real estate command center. Track deals, manage clients, and close more sales with intelligent insights.
                </p>

                {/* Quick Actions */}
                <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
                  <button
                    onClick={() => router.push('/chat')}
                    className="px-8 py-4 bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white rounded-2xl font-semibold hover:shadow-2xl transition-all hover:scale-105 flex items-center gap-3"
                  >
                    <Image src="/aureum-logo.png" alt="Navius" width={24} height={24} className="object-contain" />
                    Chat with Navius
                  </button>
                  <button
                    onClick={() => router.push('/transactions')}
                    className="px-8 py-4 bg-white text-gray-900 rounded-2xl font-semibold border-2 border-gray-200 hover:shadow-2xl transition-all hover:scale-105 flex items-center gap-3"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Transaction
                  </button>
                </div>

                {/* Scroll indicator */}
                <div className="animate-bounce">
                  <svg className="w-6 h-6 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>
            </div>
          </section>

          {/* Briefing Section */}
          <section className="py-16 px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
              {/* Upgrade Banner - Only shows for non-lifetime users */}
              <UpgradeBanner subscription={subscription} router={router} />
              
              {/* Daily Briefing */}
              <BriefingCarousel
                totalClients={totalClients}
                hotLeads={hotLeads}
                activeDeals={activeDeals}
                clients={clients}
                transactions={transactions}
                user={user}
                router={router}
              />
            </div>
          </section>
          {/* CRM Section - Full Screen */}
          <section className="min-h-[calc(100vh-4rem)] p-6 lg:p-8 py-12">
            <div className="max-w-7xl mx-auto h-full flex flex-col">
              
            {/* Client Management Section */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-[600px]">
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Trajan Pro, serif' }}>Client Management</h2>
                    <p className="text-sm text-gray-600">AI-powered lead insights and rankings</p>
                  </div>
                  <button
                    onClick={() => router.push('/transactions')}
                    className="px-4 py-2 bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white rounded-lg hover:shadow-lg transition-all hover:scale-105"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      New Client
                    </div>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#B89A5A]/30 focus:border-[#B89A5A] outline-none transition-all"
                  />
                </div>

                {/* Smart Filtering Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Filter by:</span>
                  <div className="relative">
                    <select
                      value={leadTypeFilter}
                      onChange={(e) => setLeadTypeFilter(e.target.value)}
                      className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 focus:ring-2 focus:ring-[#B89A5A]/30 focus:border-[#B89A5A] outline-none transition-all cursor-pointer"
                    >
                      <option value="all">All Clients</option>
                      <option value="buyer">Buyers</option>
                      <option value="seller">Sellers</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {leadTypeFilter !== 'all' && (
                    <span className="text-xs text-gray-500">
                      {filteredClients.length} result{filteredClients.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* CRM Table */}
              <div className="overflow-x-auto flex-1">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Lead Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Last Contact
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        AI Lead Ranking
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredClients.length > 0 ? (
                      filteredClients.map((client) => {
                        const leadScore = calculateLeadScore(client)
                        const ranking = getLeadRanking(leadScore)
                        const explanationFactors = getRankingExplanation(client, leadScore)
                        
                        return (
                          <tr 
                            key={client.id} 
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedClient(client)
                              setShowClientModal(true)
                            }}
                          >
                            {/* Client Name */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#B89A5A] to-[#9B8049] flex items-center justify-center text-white font-semibold">
                                  {client.name?.charAt(0)?.toUpperCase() || 'C'}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{client.name || 'Unknown'}</p>
                                  <p className="text-sm text-gray-500">{client.email || 'No email'}</p>
                                </div>
                              </div>
                            </td>

                            {/* Contact Info */}
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                {client.phone && (
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    {client.phone}
                                  </div>
                                )}
                                {client.email && (
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    {client.email}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Lead Type (CHANGED FROM STATUS) */}
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                                client.lead_type === 'buyer' ? 'bg-blue-100 text-blue-700' :
                                client.lead_type === 'seller' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {client.lead_type === 'buyer' && (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                  </svg>
                                )}
                                {client.lead_type === 'seller' && (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                  </svg>
                                )}
                                {client.lead_type ? client.lead_type.replace('_', ' ') : 'etc.'}
                              </span>
                            </td>

                            {/* Last Contact */}
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {client.last_contact 
                                ? new Date(client.last_contact).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                : 'Never'
                              }
                            </td>

                            {/* AI Lead Ranking with Tooltip */}
                            <td className="px-6 py-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <span className={`text-xs font-semibold ${ranking.textColor}`}>
                                    {ranking.label}
                                  </span>
                                  <span className="text-xs font-bold text-gray-700">
                                    {leadScore}%
                                  </span>
                                </div>
                                
                                {/* Progress Bar */}
                                <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`absolute top-0 left-0 h-full bg-gradient-to-r ${ranking.color} rounded-full transition-all duration-500`}
                                    style={{ width: `${leadScore}%` }}
                                  />
                                </div>

                                {/* AI Badge with Question Mark */}
                                <div className="flex items-center justify-between">
                                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${ranking.bgColor}`}>
                                    <svg className={`w-3 h-3 ${ranking.textColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <span className={`text-xs font-medium ${ranking.textColor}`}>
                                      AI Ranked
                                    </span>
                                  </div>
                                  
                                  {/* Question Mark with Tooltip */}
                                  <div className="relative">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setShowRankingTooltip(showRankingTooltip === client.id ? null : client.id)
                                      }}
                                      className="w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </button>
                                    
                                    {/* Tooltip */}
                                    {showRankingTooltip === client.id && (
                                      <div className="absolute right-0 bottom-full mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl z-50">
                                        <div className="flex items-start gap-2 mb-2">
                                          <svg className="w-4 h-4 text-[#B89A5A] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                          </svg>
                                          <div>
                                            <p className="font-semibold mb-1">Why this ranking?</p>
                                            <ul className="space-y-1 text-gray-300">
                                              {explanationFactors.map((factor, idx) => (
                                                <li key={idx} className="flex items-start gap-1">
                                                  <span className="text-[#B89A5A] mt-0.5">•</span>
                                                  <span>{factor}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        </div>
                                        {/* Arrow */}
                                        <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <p className="text-gray-500 font-medium">
                              {searchQuery || leadTypeFilter !== 'all' 
                                ? 'No clients match your filters'
                                : 'No clients found'
                              }
                            </p>
                            {(searchQuery || leadTypeFilter !== 'all') && (
                              <button
                                onClick={() => {
                                  setSearchQuery('')
                                  setLeadTypeFilter('all')
                                }}
                                className="text-sm text-[#B89A5A] hover:text-[#A68949] font-medium"
                              >
                                Clear filters
                              </button>
                            )}
                            {!searchQuery && leadTypeFilter === 'all' && (
                              <>
                                <p className="text-sm text-gray-400">Create your first transaction to add a client</p>
                                <button
                                  onClick={() => router.push('/transactions')}
                                  className="mt-2 px-4 py-2 bg-[#B89A5A] text-white rounded-lg hover:bg-[#A68949] transition-colors"
                                >
                                  New Transaction
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          </section>
        </div>
      </main>

      {/* Client Preview Modal */}
      {showClientModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[#B89A5A] to-[#9B8049] p-6 rounded-t-2xl">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-2xl font-bold">
                    {selectedClient.name?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white" style={{ fontFamily: 'Trajan Pro, serif' }}>
                      {selectedClient.name || 'Unknown Client'}
                    </h3>
                    <p className="text-white/80 text-sm mt-1">Client Profile</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowClientModal(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Contact Information */}
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact Information</h4>
                <div className="space-y-3">
                  {selectedClient.email && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 font-medium">Email</p>
                        <p className="text-sm text-gray-900 truncate">{selectedClient.email}</p>
                      </div>
                    </div>
                  )}
                  
                  {selectedClient.phone && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 font-medium">Phone</p>
                        <p className="text-sm text-gray-900">{selectedClient.phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status & Engagement */}
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Status & Activity</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 font-medium mb-2">Status</p>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      selectedClient.status === 'active' ? 'bg-green-100 text-green-700' :
                      selectedClient.status === 'hot' ? 'bg-red-100 text-red-700' :
                      selectedClient.status === 'warm' ? 'bg-yellow-100 text-yellow-700' :
                      selectedClient.status === 'lead' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedClient.status || 'Unknown'}
                    </span>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 font-medium mb-2">AI Lead Score</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            calculateLeadScore(selectedClient) >= 75 ? 'bg-green-500' :
                            calculateLeadScore(selectedClient) >= 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${calculateLeadScore(selectedClient)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {calculateLeadScore(selectedClient)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction Info */}
              {selectedClient.transaction_id && (() => {
                const clientTransaction = transactions.find(t => t.id === selectedClient.transaction_id)
                return clientTransaction ? (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Transaction Details</h4>
                    <div className="p-4 border-2 border-gray-200 rounded-lg bg-gradient-to-br from-gray-50 to-white">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 mb-1">
                            {clientTransaction.property_address}
                          </p>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            clientTransaction.transaction_type === 'buyer' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {clientTransaction.transaction_type || 'Unknown'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">Contract Date</p>
                          <p className="font-medium text-gray-900">
                            {clientTransaction.contract_date ? new Date(clientTransaction.contract_date).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Closing Date</p>
                          <p className="font-medium text-gray-900">
                            {clientTransaction.closing_date ? new Date(clientTransaction.closing_date).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null
              })()}

              {/* Notes if available */}
              {selectedClient.notes && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Notes</h4>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedClient.notes}</p>
                  </div>
                </div>
              )}

              {/* Created Date */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Client since {selectedClient.created_at ? new Date(selectedClient.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 p-6 rounded-b-2xl border-t border-gray-200 flex items-center justify-between gap-4">
              <button
                onClick={() => setShowClientModal(false)}
                className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
              >
                Close
              </button>
              
              {/* View Full Transaction Button - ALWAYS SHOW */}
              <button
                onClick={() => {
                  setShowClientModal(false)
                  // Find the transaction for this client
                  const clientTransaction = transactions.find(t => t.client_id === selectedClient.id)
                  if (clientTransaction) {
                    router.push(`/transactions/${clientTransaction.id}`)
                  } else if (selectedClient.transaction_id) {
                    router.push(`/transactions/${selectedClient.transaction_id}`)
                  } else {
                    // Fallback to transactions page
                    router.push('/transactions')
                  }
                }}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white rounded-xl font-semibold hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center gap-2"
              >
                <span>View Full Transaction</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}