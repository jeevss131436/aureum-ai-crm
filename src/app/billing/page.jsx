"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function BillingPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
  // View states: 'plans', 'checkout', 'confirmation', 'billing', 'update-payment'
  const [currentView, setCurrentView] = useState('plans')
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [selectedPlanType, setSelectedPlanType] = useState('solo') // 'solo' or 'team'
  const [teamSeats, setTeamSeats] = useState(3)
  const [isProcessing, setIsProcessing] = useState(false)
  const [billingType, setBillingType] = useState('monthly') // 'monthly' or 'lifetime'
  
  // Mock subscription data
  const [subscription, setSubscription] = useState(null)
  
  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    nameOnCard: '',
    cardNumber: '',
    expiration: '',
    cvv: '',
    zip: ''
  })

  function getTierBadge() {
    if (subscription?.plan?.type === 'lifetime') {
      return (
        <button
          onClick={() => router.push('/profile')}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-[#B89A5A] to-[#D4B96A] text-white text-xs font-semibold rounded-full shadow-sm hover:shadow-md hover:scale-105 transition-all cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          Lifetime
        </button>
      )
    }
    if (subscription?.plan?.name === 'Team Plan') {
      return (
        <button
          onClick={() => router.push('/profile')}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full hover:bg-blue-200 hover:scale-105 transition-all cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Team
        </button>
      )
    }
    if (subscription?.plan?.name === 'Solo Plan') {
      return (
        <button
          onClick={() => router.push('/profile')}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full hover:bg-gray-200 hover:scale-105 transition-all cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Solo
        </button>
      )
    }
    return null
  }

  // Mock billing history
  const [billingHistory] = useState([
    { id: '1', date: 'December 2, 2025', amount: 98.00, status: 'Paid', invoiceId: 'INV-2025-001' },
    { id: '2', date: 'November 2, 2025', amount: 98.00, status: 'Paid', invoiceId: 'INV-2025-002' },
    { id: '3', date: 'October 2, 2025', amount: 98.00, status: 'Paid', invoiceId: 'INV-2025-003' },
  ])

  // Lifetime spots remaining (first 20 at $3,500, next 30 at $5,000)
  const [lifetimeSpots] = useState({ tier1: 8, tier2: 30 }) // 8 remaining at tier 1

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/'
    } else {
      setUser(user)
      // Check if user has existing subscription
      // For demo, we'll show the plans view
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  function formatCardNumber(value) {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = (matches && matches[0]) || ''
    const parts = []
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }
    return parts.length ? parts.join(' ') : value
  }

  function formatExpiration(value) {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    if (v.length >= 2) {
      return v.slice(0, 2) + '/' + v.slice(2, 4)
    }
    return v
  }

  function handleSelectPlan(plan) {
    setSelectedPlan(plan)
    setCurrentView('checkout')
  }

  function handlePaymentSubmit(e) {
    e.preventDefault()
    setIsProcessing(true)
    
    // Simulate Stripe payment processing
    setTimeout(() => {
      setIsProcessing(false)
      setSubscription({
        plan: selectedPlan,
        status: 'active',
        startDate: new Date().toISOString(),
        nextBilling: selectedPlan.type === 'lifetime' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      setCurrentView('confirmation')
    }, 2000)
  }

  function calculatePrice() {
    if (billingType === 'lifetime') {
      return lifetimeSpots.tier1 > 0 ? 3500 : 5000
    }
    if (selectedPlanType === 'solo') {
      return 98
    }
    // Team plan: $249 base + $35 per additional seat beyond 3
    const extraSeats = Math.max(0, teamSeats - 3)
    return 249 + (extraSeats * 35)
  }

  // Plans configuration
  const soloFeatures = [
    'Full CRM Access',
    'Navius AI Assistant',
    'Daily Briefing',
    'Client Brief View',
    'Follow-Up Engine',
    'SMS Sending (Pay-as-you-go)',
    'Smart Lead Ranking',
    'Ghost Logger (Auto Activity Tracking)',
    'Pipeline Tracking',
    'Standard Support'
  ]

  const teamFeatures = [
    'Everything in Solo Plan',
    '3 seats included',
    'Shared Team Dashboard',
    'Team Pipeline',
    'Shared Calendar',
    'Team Member Assignment',
    'Team Permissions',
    'Shared SMS Number (optional)',
    'Higher Priority Support',
    'Additional seats: $35/month each'
  ]

  const lifetimeFeatures = [
    'Full CRM Access Forever',
    'Navius AI Assistant',
    'All Future Features Included',
    'Price Locked Forever',
    'No Recurring Billing',
    'Highest Priority Support for Life',
    'Early Access to New Features',
    'One-Time Payment'
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#B89A5A]/20 border-t-[#B89A5A] rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading billing...</p>
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
        {sidebarOpen && subscription && (
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Account</span>
              {getTierBadge()}
            </div>
          </div>
        )}
        {!sidebarOpen && subscription && (
          <div className="py-3 border-b border-gray-200 flex justify-center">
            {getTierBadge()}
          </div>
        )}

        {/* Navigation Links */}
        <nav className="p-4 space-y-2">
          <button
            onClick={() => router.push('/dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              sidebarOpen ? 'justify-start' : 'justify-center'
            } text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
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
              <div className="flex items-center gap-4">
                {currentView !== 'plans' && currentView !== 'billing' && (
                  <button
                    onClick={() => setCurrentView(subscription ? 'billing' : 'plans')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <h1 style={{ fontFamily: 'Trajan Pro, serif' }} className="text-2xl font-bold text-gray-900">
                  {currentView === 'plans' && 'Choose Your Plan'}
                  {currentView === 'checkout' && 'Complete Payment'}
                  {currentView === 'confirmation' && 'Payment Successful'}
                  {currentView === 'billing' && 'Billing & Payments'}
                  {currentView === 'update-payment' && 'Update Payment Method'}
                </h1>
              </div>
              
              <div className="flex items-center gap-3">
                {subscription && getTierBadge()}
                {subscription && currentView === 'billing' && (
                  <span className="px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                    {subscription.plan.type === 'lifetime' ? 'Lifetime Member' : 'Active Subscription'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 lg:p-8">
          
          {/* PLAN SELECTION VIEW */}
          {currentView === 'plans' && (
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <p className="text-gray-600 text-lg">Invest in your real estate success with Aureum</p>
              </div>

              {/* Billing Toggle */}
              <div className="flex justify-center mb-10">
                <div className="inline-flex bg-gray-100 rounded-xl p-1.5">
                  <button
                    onClick={() => setBillingType('monthly')}
                    className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
                      billingType === 'monthly'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingType('lifetime')}
                    className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                      billingType === 'lifetime'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <svg className="w-4 h-4 text-[#B89A5A]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    Lifetime
                  </button>
                </div>
              </div>

              {billingType === 'monthly' ? (
                /* Monthly Plans */
                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                  {/* Solo Plan */}
                  <div 
                    className={`bg-white rounded-2xl p-8 border-2 transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 ${
                      selectedPlanType === 'solo' ? 'border-[#B89A5A] shadow-lg' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedPlanType('solo')}
                  >
                    <div className="mb-6">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Solo Plan</h3>
                      <p className="text-gray-600 text-sm">Perfect for individual agents</p>
                    </div>
                    
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-5xl font-bold text-gray-900">$98</span>
                      <span className="text-gray-500">/month</span>
                    </div>

                    <ul className="space-y-3 mb-8">
                      {soloFeatures.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-[#B89A5A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-3 h-3 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-sm text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleSelectPlan({ name: 'Solo Plan', price: 98, type: 'monthly', billing: 'monthly' })}
                      className={`w-full py-4 rounded-xl font-semibold transition-all ${
                        selectedPlanType === 'solo'
                          ? 'bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white shadow-lg hover:shadow-xl'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Select Solo Plan
                    </button>
                  </div>

                  {/* Team Plan */}
                  <div 
                    className={`bg-white rounded-2xl p-8 border-2 transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 relative overflow-hidden ${
                      selectedPlanType === 'team' ? 'border-[#B89A5A] shadow-lg' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedPlanType('team')}
                  >
                    {/* Popular Badge */}
                    <div className="mb-4">
                      <span className="inline-flex px-4 py-1.5 bg-gradient-to-r from-[#B89A5A] to-[#D4B96A] text-white text-xs font-semibold rounded-full shadow-lg">
                        Best for Teams
                      </span>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Team Plan</h3>
                      <p className="text-gray-600 text-sm">For brokerages and teams</p>
                    </div>
                    
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-5xl font-bold text-gray-900">$249</span>
                      <span className="text-gray-500">/month</span>
                    </div>
                    <p className="text-sm text-[#B89A5A] mb-6">Includes 3 seats</p>

                    {/* Seat Selector */}
                    {selectedPlanType === 'team' && (
                      <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Team Size</label>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); setTeamSeats(Math.max(3, teamSeats - 1)) }}
                            className="w-10 h-10 rounded-lg bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <span className="text-2xl font-bold text-gray-900 w-12 text-center">{teamSeats}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setTeamSeats(teamSeats + 1) }}
                            className="w-10 h-10 rounded-lg bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                        {teamSeats > 3 && (
                          <p className="text-xs text-gray-500 mt-2">
                            +${(teamSeats - 3) * 35}/mo for {teamSeats - 3} additional seat{teamSeats > 4 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    )}

                    <ul className="space-y-3 mb-8">
                      {teamFeatures.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-[#B89A5A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-3 h-3 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-sm text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleSelectPlan({ 
                        name: 'Team Plan', 
                        price: 249 + Math.max(0, teamSeats - 3) * 35, 
                        type: 'monthly', 
                        billing: 'monthly',
                        seats: teamSeats 
                      })}
                      className={`w-full py-4 rounded-xl font-semibold transition-all ${
                        selectedPlanType === 'team'
                          ? 'bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white shadow-lg hover:shadow-xl'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Select Team Plan • ${249 + Math.max(0, teamSeats - 3) * 35}/mo
                    </button>
                  </div>
                </div>
              ) : (
                /* Lifetime Plan */
                <div className="max-w-xl mx-auto">
                  <div className="bg-white rounded-2xl p-10 border-2 border-[#B89A5A] shadow-xl relative overflow-hidden">
                    {/* Gradient Accent */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#B89A5A] via-[#D4B96A] to-[#B89A5A]"></div>
                    
                    {/* Limited Badge */}
                    <div className="mb-4 mt-2">
                      <span className="inline-flex px-4 py-1.5 bg-gradient-to-r from-[#B89A5A] to-[#D4B96A] text-white text-xs font-semibold rounded-full shadow-lg items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        Limited Availability
                      </span>
                    </div>

                    <div className="text-center mb-8">
                      <h3 className="text-3xl font-bold text-gray-900 mb-2">Lifetime Access</h3>
                      <p className="text-gray-600">Pay once, own forever. No recurring fees.</p>
                    </div>

                    {/* Pricing Tiers */}
                    <div className="bg-gradient-to-br from-[#B89A5A]/5 to-[#B89A5A]/10 rounded-xl p-6 mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className="text-sm text-gray-600">Current Price</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-gray-900">
                              ${lifetimeSpots.tier1 > 0 ? '3,500' : '5,000'}
                            </span>
                            <span className="text-gray-500">one-time</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-[#B89A5A] font-medium">
                            {lifetimeSpots.tier1 > 0 
                              ? `${lifetimeSpots.tier1} spots left at $3,500`
                              : `${lifetimeSpots.tier2} spots left at $5,000`
                            }
                          </span>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>First 20 • $3,500</span>
                          <span>Next 30 • $5,000</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-[#B89A5A] to-[#D4B96A] transition-all"
                            style={{ width: `${((20 - lifetimeSpots.tier1) / 50) * 100}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 text-center">
                          After 50 total users, lifetime access closes permanently
                        </p>
                      </div>
                    </div>

                    <ul className="space-y-3 mb-8">
                      {lifetimeFeatures.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-r from-[#B89A5A] to-[#D4B96A] flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-sm text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleSelectPlan({ 
                        name: 'Lifetime Access', 
                        price: lifetimeSpots.tier1 > 0 ? 3500 : 5000, 
                        type: 'lifetime', 
                        billing: 'one-time' 
                      })}
                      className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      Get Lifetime Access • ${lifetimeSpots.tier1 > 0 ? '3,500' : '5,000'}
                    </button>

                    <p className="text-center text-xs text-gray-500 mt-4">
                      Save ${lifetimeSpots.tier1 > 0 ? '2,324' : '824'} compared to {lifetimeSpots.tier1 > 0 ? '3' : '4.3'} years of monthly billing
                    </p>
                  </div>
                </div>
              )}

              {/* Trust Badges */}
              <div className="flex items-center justify-center gap-8 mt-12">
                <div className="flex items-center gap-2 text-gray-500">
                  <svg className="w-5 h-5 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-sm">256-bit SSL</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <svg className="w-5 h-5 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-sm">Secure Payment</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <span className="text-sm">Powered by</span>
                  <span className="text-[#635BFF] font-semibold">Stripe</span>
                </div>
              </div>
            </div>
          )}

          {/* CHECKOUT VIEW */}
          {currentView === 'checkout' && selectedPlan && (
            <div className="max-w-5xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-10">
                {/* Order Summary */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>
                  <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-6 pb-6 border-b border-gray-100">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">{selectedPlan.name}</h3>
                        <p className="text-sm text-[#B89A5A]">
                          {selectedPlan.type === 'monthly' ? 'Billed monthly' : 'One-time payment'}
                        </p>
                        {selectedPlan.seats && (
                          <p className="text-sm text-gray-500 mt-1">{selectedPlan.seats} team seats</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          ${selectedPlan.price.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {selectedPlan.type === 'monthly' ? 'per month' : 'lifetime'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6 pb-6 border-b border-gray-100">
                      {(selectedPlan.name === 'Solo Plan' ? soloFeatures.slice(0, 5) : 
                        selectedPlan.name === 'Team Plan' ? teamFeatures.slice(0, 5) : 
                        lifetimeFeatures.slice(0, 5)).map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <svg className="w-4 h-4 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm text-gray-700">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="text-gray-900">${selectedPlan.price.toLocaleString()}.00</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tax</span>
                        <span className="text-gray-900">$0.00</span>
                      </div>
                      <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                        <span className="font-semibold text-gray-900">Total</span>
                        <span className="text-2xl font-bold text-gray-900">
                          ${selectedPlan.price.toLocaleString()}.00
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Form */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Payment Details</h2>
                  <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
                    <form onSubmit={handlePaymentSubmit}>
                      <div className="mb-5">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name on Card</label>
                        <input
                          type="text"
                          value={paymentForm.nameOnCard}
                          onChange={(e) => setPaymentForm({ ...paymentForm, nameOnCard: e.target.value })}
                          placeholder="John Doe"
                          required
                          disabled={isProcessing}
                          className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all disabled:bg-gray-50"
                        />
                      </div>

                      <div className="mb-5">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={paymentForm.cardNumber}
                            onChange={(e) => setPaymentForm({ ...paymentForm, cardNumber: formatCardNumber(e.target.value) })}
                            placeholder="1234 5678 9012 3456"
                            maxLength={19}
                            required
                            disabled={isProcessing}
                            className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all disabled:bg-gray-50 pr-12"
                          />
                          <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Expiration</label>
                          <input
                            type="text"
                            value={paymentForm.expiration}
                            onChange={(e) => setPaymentForm({ ...paymentForm, expiration: formatExpiration(e.target.value) })}
                            placeholder="MM/YY"
                            maxLength={5}
                            required
                            disabled={isProcessing}
                            className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all disabled:bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
                          <input
                            type="text"
                            value={paymentForm.cvv}
                            onChange={(e) => setPaymentForm({ ...paymentForm, cvv: e.target.value.replace(/\D/g, '') })}
                            placeholder="123"
                            maxLength={4}
                            required
                            disabled={isProcessing}
                            className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all disabled:bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
                          <input
                            type="text"
                            value={paymentForm.zip}
                            onChange={(e) => setPaymentForm({ ...paymentForm, zip: e.target.value.replace(/\D/g, '') })}
                            placeholder="12345"
                            maxLength={5}
                            required
                            disabled={isProcessing}
                            className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all disabled:bg-gray-50"
                          />
                        </div>
                      </div>

                      {/* Security Badge */}
                      <div className="mb-6 p-4 bg-gray-50 rounded-xl flex items-center justify-center gap-6">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span className="text-xs text-gray-600">256-bit SSL</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <span className="text-xs text-gray-600">Secure Payment</span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isProcessing}
                        className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        {isProcessing ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Processing...
                          </span>
                        ) : (
                          `Pay Now $${selectedPlan.price.toLocaleString()}.00`
                        )}
                      </button>

                      <p className="text-center text-xs text-gray-500 mt-4">
                        Powered by <span className="text-[#635BFF] font-semibold">Stripe</span>
                      </p>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CONFIRMATION VIEW */}
          {currentView === 'confirmation' && subscription && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-200 text-center">
                {/* Success Icon */}
                <div className="mb-8">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#B89A5A]/10 to-[#B89A5A]/20 flex items-center justify-center">
                    <svg className="w-10 h-10 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  {subscription.plan.type === 'lifetime' ? 'Welcome to Aureum Lifetime!' : 'Your subscription is active!'}
                </h2>
                <p className="text-gray-600 mb-10">
                  {subscription.plan.type === 'lifetime' 
                    ? 'You now have lifetime access to all Aureum features. Thank you for your support!'
                    : 'Welcome to Aureum Pro. Your payment was processed successfully.'
                  }
                </p>

                {/* Receipt Summary */}
                <div className="bg-gray-50 rounded-xl p-6 mb-10 text-left">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Receipt Summary</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Plan</span>
                      <span className="text-sm font-medium text-gray-900">{subscription.plan.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Amount Charged</span>
                      <span className="text-lg font-bold text-[#B89A5A]">${subscription.plan.price.toLocaleString()}.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Billing Type</span>
                      <span className="text-sm font-medium text-gray-900">
                        {subscription.plan.type === 'lifetime' ? 'Lifetime Access' : 'Monthly Subscription'}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Activation Date</span>
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(subscription.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      {subscription.plan.type === 'monthly' && subscription.nextBilling && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Next Billing Date</span>
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(subscription.nextBilling).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                      {subscription.plan.type === 'lifetime' && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Access Duration</span>
                          <span className="text-sm font-bold text-[#B89A5A]">Lifetime</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Go to Dashboard
                </button>

                <p className="text-xs text-gray-500 mt-6">
                  A confirmation email has been sent to your registered email address.
                </p>
              </div>
            </div>
          )}

          {/* BILLING MANAGEMENT VIEW */}
          {currentView === 'billing' && subscription && (
            <div className="max-w-4xl mx-auto">
              {/* Current Plan Card */}
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 mb-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#B89A5A]/10 to-[#B89A5A]/20 flex items-center justify-center">
                      <svg className="w-7 h-7 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">Current Plan: {subscription.plan.name}</h3>
                      {subscription.plan.type === 'monthly' ? (
                        <>
                          <p className="text-sm text-gray-600">Visa ending in 4242</p>
                          <p className="text-xs text-gray-500">Next billing: {new Date(subscription.nextBilling).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </>
                      ) : (
                        <p className="text-sm text-[#B89A5A] font-medium">Lifetime access - No recurring charges</p>
                      )}
                    </div>
                  </div>
                  {subscription.plan.type === 'monthly' && (
                    <button
                      onClick={() => setCurrentView('update-payment')}
                      className="px-6 py-2.5 rounded-xl font-medium text-white bg-gradient-to-r from-gray-800 to-gray-900 hover:shadow-lg transition-all"
                    >
                      Update Payment
                    </button>
                  )}
                </div>
              </div>

              {/* Billing History */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Billing History</h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Date</th>
                        <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Amount</th>
                        <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                        <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Invoice</th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingHistory.map((item) => (
                        <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-900">{item.date}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-gray-900">${item.amount.toFixed(2)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              item.status === 'Paid' 
                                ? 'bg-green-100 text-green-700'
                                : item.status === 'Failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-500">{item.invoiceId}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="inline-flex items-center gap-1.5 text-sm text-[#B89A5A] hover:text-[#9B8049] font-medium transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {billingHistory.length === 0 && (
                  <div className="p-12 text-center">
                    <p className="text-gray-500">No billing history available</p>
                  </div>
                )}
              </div>

              {/* Cancel Subscription */}
              {subscription.plan.type === 'monthly' && (
                <div className="mt-8 p-6 bg-red-50 rounded-xl border border-red-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-red-900 mb-1">Cancel Subscription</h4>
                      <p className="text-sm text-red-700">Your access will continue until the end of the current billing period.</p>
                    </div>
                    <button className="px-5 py-2.5 rounded-xl font-medium text-red-600 border border-red-300 hover:bg-red-100 transition-colors">
                      Cancel Subscription
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* UPDATE PAYMENT METHOD VIEW */}
          {currentView === 'update-payment' && (
            <div className="max-w-4xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Current Payment Method */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Current Payment Method</h3>
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Visa •••• 4242</p>
                        <p className="text-sm text-gray-500">Expires 12/26</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        This card will be replaced once you save the new payment method.
                      </p>
                    </div>
                  </div>
                </div>

                {/* New Payment Method Form */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">New Payment Method</h3>
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                    <form onSubmit={(e) => { e.preventDefault(); setCurrentView('billing') }}>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name on Card</label>
                        <input
                          type="text"
                          placeholder="John Doe"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
                        <input
                          type="text"
                          placeholder="1234 5678 9012 3456"
                          maxLength={19}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Exp.</label>
                          <input
                            type="text"
                            placeholder="MM/YY"
                            maxLength={5}
                            className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
                          <input
                            type="text"
                            placeholder="123"
                            maxLength={4}
                            className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">ZIP</label>
                          <input
                            type="text"
                            placeholder="12345"
                            maxLength={5}
                            className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setCurrentView('billing')}
                          className="flex-1 py-3 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#B89A5A] to-[#9B8049] hover:shadow-lg transition-all"
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}