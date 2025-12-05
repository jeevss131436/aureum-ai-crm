"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [formData, setFormData] = useState({
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [message, setMessage] = useState('')
  
  // Mock subscription data - in production, fetch from database
  const [subscription, setSubscription] = useState({
    plan: { name: 'Solo Plan', type: 'monthly', price: 98 },
    status: 'active',
    nextBilling: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
  })

  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    license_number: ''
  })

  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/'
    } else {
      setUser(user)
      setProfileForm({
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || '',
        email: user.email || '',
        phone: user.user_metadata?.phone || '',
        company: user.user_metadata?.company || '',
        license_number: user.user_metadata?.license_number || ''
      })
      // Fetch subscription data here in production
      setLoading(false)
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
          phone: profileForm.phone,
          company: profileForm.company,
          license_number: profileForm.license_number
        }
      })

  const handleCancelSubscription = async () => {
    try {
      setSaving(true)
      setMessage({ type: '', text: '' })

      const { error } = await supabase.auth.updateUser({
        data: {
          subscription_status: 'cancelled',
          subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        }
      })

      if (error) throw error

      setMessage({ type: 'success', text: 'Subscription cancelled. Access continues until end date.' })
      setShowCancelModal(false)
      await fetchUserProfile()

    } catch (error) {
      console.error('Error cancelling subscription:', error)
      setMessage({ type: 'error', text: 'Failed to cancel subscription' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    try {
      setSaving(true)

      await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id)

      await supabase
        .from('clients')
        .delete()
        .eq('user_id', user.id)

      const { error } = await supabase.rpc('delete_user')

      if (error) throw error

      await supabase.auth.signOut()
      router.push('/')

      if (error) throw error
      setMessage('Profile updated successfully!')
    } catch (error) {
      setMessage('Error updating profile: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  function getTierBadge() {
    if (subscription.plan.type === 'lifetime') {
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
    if (subscription.plan.name === 'Team Plan') {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#B89A5A]/20 border-t-[#B89A5A] rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading profile...</p>
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
        {!sidebarOpen && (
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              sidebarOpen ? 'justify-start' : 'justify-center'
            } bg-[#B89A5A]/10 text-[#B89A5A] font-medium`}
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
              <h1 style={{ fontFamily: 'Trajan Pro, serif' }} className="text-2xl font-bold text-gray-900">Profile</h1>
              <div className="flex items-center gap-3">
                {getTierBadge()}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Profile Form */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Personal Information</h2>
                  
                  <form onSubmit={handleSaveProfile} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                        <input
                          type="text"
                          value={profileForm.first_name}
                          onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                        <input
                          type="text"
                          value={profileForm.last_name}
                          onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                          placeholder="Doe"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                      <input
                        type="email"
                        value={profileForm.email}
                        disabled
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company / Brokerage</label>
                      <input
                        type="text"
                        value={profileForm.company}
                        onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                        placeholder="ABC Realty"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">License Number</label>
                      <input
                        type="text"
                        value={profileForm.license_number}
                        onChange={(e) => setProfileForm({ ...profileForm, license_number: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#B89A5A] focus:border-[#B89A5A] outline-none transition-all"
                        placeholder="RE-123456"
                      />
                    </div>

                    {message && (
                      <div className={`p-4 rounded-xl text-sm font-medium ${
                        message.includes('Error') 
                          ? 'bg-red-50 text-red-700 border border-red-200' 
                          : 'bg-green-50 text-green-700 border border-green-200'
                      }`}>
                        {message}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full py-3.5 rounded-xl font-semibold bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {saving ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Saving...
                        </span>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                  </form>
                </div>
              </div>

          {/* Subscription Management */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <div className="w-8 h-8 bg-[#B89A5A]/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                Subscription & Billing
              </h3>

              {/* Current Plan Display */}
              <div className="p-6 bg-gradient-to-br from-[#B89A5A]/5 to-[#9B8049]/5 rounded-xl border-2 border-[#B89A5A]/20 mb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h4 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Trajan Pro, serif' }}>
                        {user?.user_metadata?.subscription_plan?.toUpperCase() || 'FREE'} Plan
                      </h4>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        user?.user_metadata?.subscription_status === 'active' ? 'bg-green-100 text-green-700' :
                        user?.user_metadata?.subscription_status === 'cancelled' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {user?.user_metadata?.subscription_status === 'active' ? '● Active' :
                         user?.user_metadata?.subscription_status === 'cancelled' ? '● Cancelled' :
                         '● Free'}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      {user?.user_metadata?.subscription_plan === 'pro' && (
                        <>
                          <p className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Unlimited clients & transactions
                          </p>
                          <p className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            AI-powered insights & briefings
                          </p>
                          <p className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Priority support
                          </p>
                        </>
                      )}
                      {!user?.user_metadata?.subscription_plan || user?.user_metadata?.subscription_plan === 'free' && (
                        <p className="text-gray-500">Upgrade to Pro for unlimited access and AI features</p>
                      )}
                    </div>

                    {user?.user_metadata?.subscription_status === 'cancelled' && user?.user_metadata?.subscription_end_date && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Your subscription ends on {new Date(user.user_metadata.subscription_end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {(!user?.user_metadata?.subscription_plan || user?.user_metadata?.subscription_plan === 'free') && (
                      <button
                        onClick={() => setMessage({ type: 'success', text: 'Upgrade feature coming soon!' })}
                        className="px-6 py-2.5 bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white rounded-xl font-medium hover:shadow-lg transition-all hover:scale-105"
                      >
                        Upgrade to Pro
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Cancel Subscription */}
              {user?.user_metadata?.subscription_plan && user?.user_metadata?.subscription_plan !== 'free' && user?.user_metadata?.subscription_status === 'active' && (
                <div className="p-5 bg-orange-50 rounded-xl border-2 border-orange-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-orange-900">Cancel Subscription</h4>
                        <p className="text-sm text-orange-700 mt-1">You'll retain access until the end of your billing period</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="px-5 py-2.5 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-all hover:shadow-lg"
                    >
                      Cancel Plan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account Management */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                Account Security
              </h3>
              
              {/* Change Password */}
              <div className="p-5 bg-blue-50 rounded-xl border-2 border-blue-100 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
              {/* Sidebar Cards */}
              <div className="space-y-6">
                {/* Subscription Card */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Subscription</h3>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#B89A5A]/10 to-[#B89A5A]/20 flex items-center justify-center">
                      {subscription.plan.type === 'lifetime' ? (
                        <svg className="w-6 h-6 text-[#B89A5A]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{subscription.plan.name}</p>
                      <p className="text-sm text-gray-500">
                        {subscription.plan.type === 'lifetime' 
                          ? 'Lifetime access' 
                          : `$${subscription.plan.price}/month`
                        }
                      </p>
                    </div>
                  </div>

                  {subscription.plan.type === 'monthly' && subscription.nextBilling && (
                    <div className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-500">Next billing:</span>{' '}
                      <span className="font-medium">
                        {new Date(subscription.nextBilling).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => router.push('/billing')}
                    className="w-full py-3 rounded-xl font-medium text-[#B89A5A] border-2 border-[#B89A5A] hover:bg-[#B89A5A]/5 transition-all"
                  >
                    Manage Billing
                  </button>
                </div>

                {/* Upgrade Card - Only show for Solo users */}
                {subscription.plan.name === 'Solo Plan' && subscription.plan.type !== 'lifetime' && (
                  <div className="bg-gradient-to-br from-[#B89A5A] to-[#9B8049] rounded-2xl shadow-lg p-6 text-white">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      <span className="font-semibold">Upgrade to Lifetime</span>
                    </div>
                    <p className="text-sm text-white/80 mb-4">
                      Lock in your access forever. No more monthly payments.
                    </p>
                    <button
                      onClick={() => router.push('/billing')}
                      className="w-full py-2.5 rounded-xl font-medium bg-white text-[#B89A5A] hover:bg-white/90 transition-all"
                    >
                      View Lifetime Plans
                    </button>
                  </div>
                )}

                {/* Quick Stats */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Account Stats</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Member since</span>
                      <span className="text-sm font-medium text-gray-900">
                        {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Account status</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Activex
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Cancel Subscription Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 scale-100 animate-[scale-in_0.2s_ease-out]">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center">
                <svg className="w-7 h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Cancel Subscription?</h3>
                <p className="text-sm text-gray-500">You can reactivate anytime</p>
              </div>
            </div>

            <p className="text-gray-700 mb-4">
              Your subscription will be cancelled, but you'll retain access to all Pro features until the end of your current billing period (30 days from now).
            </p>

            <ul className="text-sm text-gray-600 space-y-2 mb-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Keep access for the next 30 days
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                No further charges after period ends
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Reactivate anytime you want
              </li>
            </ul>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-all hover:shadow-xl disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Cancelling...
                  </span>
                ) : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 scale-100 animate-[scale-in_0.2s_ease-out]">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
                <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delete Account?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-4 font-medium">
              This will permanently delete:
            </p>
            
            <ul className="text-sm text-gray-600 space-y-2 mb-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Your profile information
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                All transactions and timelines
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                All clients and leads
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                All chat history and briefings
              </li>
            </ul>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all hover:shadow-xl disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Deleting...
                  </span>
                ) : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}