'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function CalendarPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState('month') // 'month', 'week', 'day'
  const [events, setEvents] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  
  // Google Calendar sync state
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [syncStatus, setSyncStatus] = useState('idle') // 'idle', 'syncing', 'success', 'error'
  
  // Form state
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'meeting',
    start_time: '',
    end_time: '',
    location: '',
    client_id: null
  })
  
  // Data
  const [clients, setClients] = useState([])
  const [transactions, setTransactions] = useState([])
  const [timelineItems, setTimelineItems] = useState([])
  const [calendarEvents, setCalendarEvents] = useState([])

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      fetchCalendarData(user.id)
    }
  }, [currentDate, user])

  // Check Google Calendar connection status on load
  useEffect(() => {
    if (user) {
      checkGoogleConnection(user.id)
    }
  }, [user])

  async function checkGoogleConnection(userId) {
    try {
      const { data } = await supabase
        .from('google_calendar_tokens')
        .select('*')
        .eq('user_id', userId)
        .single()
      
      if (data && data.access_token) {
        setGoogleCalendarConnected(true)
        console.log('Google Calendar connected')
      } else {
        setGoogleCalendarConnected(false)
        console.log('Google Calendar not connected')
      }
    } catch (error) {
      console.error('Error checking Google connection:', error)
      setGoogleCalendarConnected(false)
    }
  }

  // Handle OAuth callback (check URL params on load)
  useEffect(() => {
    if (user) {
      const urlParams = new URLSearchParams(window.location.search)
      const syncSuccess = urlParams.get('sync')
      
      if (syncSuccess === 'success') {
        // OAuth was successful, setup webhook
        setupGoogleWebhook(user.id)
        // Clean URL
        window.history.replaceState({}, '', '/calendar')
      }
    }
  }, [user])

  async function setupGoogleWebhook(userId) {
    try {
      const response = await fetch('/api/calendar/setup-watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      
      if (response.ok) {
        console.log('Webhook setup successful')
        setGoogleCalendarConnected(true)
        setSyncStatus('success')
      } else {
        console.error('Webhook setup failed')
      }
    } catch (error) {
      console.error('Error setting up webhook:', error)
    }
  }

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/'
    } else {
      setUser(user)
      await fetchCalendarData(user.id)
      setLoading(false)
    }
  }

  async function fetchCalendarData(userId) {
    // Fetch clients
    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)

    // Fetch transactions
    const { data: transactionsData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)

    // Fetch timeline items
    const { data: timelineData } = await supabase
      .from('timeline_items')
      .select(`
        *,
        transactions!inner (
          user_id,
          client_id,
          property_address
        )
      `)
      .eq('transactions.user_id', userId)

    // Fetch calendar events
    const { data: eventsData } = await supabase
      .from('calendar_events')
      .select('*, clients(name)')
      .eq('user_id', userId)

    setClients(clientsData || [])
    setTransactions(transactionsData || [])
    setTimelineItems(timelineData || [])
    setCalendarEvents(eventsData || [])

    // Combine all into events array
    combineEvents(transactionsData || [], timelineData || [], eventsData || [], clientsData || [])
  }

  function combineEvents(trans, timeline, calEvents, clients) {
    const allEvents = []

    // Add transaction deadlines (contract, closing)
    trans.forEach(t => {
      const client = clients.find(c => c.id === t.client_id)
      
      if (t.contract_date) {
        allEvents.push({
          id: `contract-${t.id}`,
          title: `Contract: ${t.property_address}`,
          date: t.contract_date,
          type: 'contract',
          color: 'blue',
          client: client?.name,
          transaction: t
        })
      }
      
      if (t.closing_date) {
        allEvents.push({
          id: `closing-${t.id}`,
          title: `Closing: ${t.property_address}`,
          date: t.closing_date,
          type: 'closing',
          color: 'green',
          client: client?.name,
          transaction: t
        })
      }
    })

    // Add timeline items
    timeline.forEach(item => {
      if (item.due_date) {
        allEvents.push({
          id: `timeline-${item.id}`,
          title: item.title,
          date: item.due_date,
          type: 'deadline',
          color: item.completed ? 'gray' : 'orange',
          completed: item.completed,
          property: item.transactions?.property_address,
          timelineItem: item
        })
      }
    })

    // Add calendar events
    calEvents.forEach(event => {
      allEvents.push({
        id: `event-${event.id}`,
        title: event.title,
        date: event.start_time.split('T')[0],
        time: event.start_time,
        type: event.event_type || 'meeting',
        color: getEventColor(event.event_type),
        client: event.clients?.name,
        description: event.notes,
        location: event.location,
        calendarEvent: event
      })
    })

    setEvents(allEvents)
  }

  function getEventColor(type) {
    const colors = {
      showing: 'purple',
      meeting: 'blue',
      call: 'indigo',
      coffee: 'yellow',
      deadline: 'red'
    }
    return colors[type] || 'gray'
  }

  async function handleCreateEvent() {
    if (!eventForm.title || !eventForm.start_time) {
      alert('Please fill in event title and start time')
      return
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .insert([{
        user_id: user.id,
        title: eventForm.title,
        event_type: eventForm.event_type,
        start_time: eventForm.start_time,
        end_time: eventForm.end_time || eventForm.start_time,
        location: eventForm.location,
        notes: eventForm.description,
        client_id: eventForm.client_id
      }])
      .select()

    if (error) {
      console.error('Error creating event:', error)
      alert('Failed to create event')
    } else {
      setShowEventModal(false)
      setEventForm({
        title: '',
        description: '',
        event_type: 'meeting',
        start_time: '',
        end_time: '',
        location: '',
        client_id: null
      })
      await fetchCalendarData(user.id)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // Calendar helpers
  function getDaysInMonth(date) {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    return { daysInMonth, startingDayOfWeek, year, month }
  }

  function getEventsForDate(date) {
    const dateStr = date.toISOString().split('T')[0]
    return events.filter(e => e.date === dateStr)
  }

  function getEventsForMonth(year, month) {
    return events.filter(e => {
      const eventDate = new Date(e.date)
      return eventDate.getFullYear() === year && eventDate.getMonth() === month
    })
  }

  function getWeekDays(date) {
    const currentDate = new Date(date)
    const day = currentDate.getDay() // 0 (Sunday) to 6 (Saturday)
    const sunday = new Date(currentDate)
    sunday.setDate(currentDate.getDate() - day) // Go back to Sunday
    
    const weekDays = []
    for (let i = 0; i < 7; i++) {
      const weekDay = new Date(sunday)
      weekDay.setDate(sunday.getDate() + i)
      weekDays.push(weekDay)
    }
    
    return weekDays
  }

  function formatTime(datetime) {
    if (!datetime) return ''
    const date = new Date(datetime)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate)
  const monthEvents = getEventsForMonth(year, month)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#B89A5A]/20 border-t-[#B89A5A] rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading calendar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-40 ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}>
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
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'} bg-gray-50`}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#B89A5A] via-[#C4A965] to-[#D4B87C] bg-clip-text text-transparent" style={{ fontFamily: 'Trajan Pro, serif' }}>
                  Calendar
                </h1>
                <p className="text-sm text-gray-600 mt-2">Manage your transactions, deadlines, and events</p>
              </div>
              
              <div className="flex items-center gap-3">
                {/* View Selector */}
                <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 border border-gray-200">
                  <button
                    onClick={() => setView('month')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      view === 'month' ? 'bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white shadow-md' : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                    }`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setView('week')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      view === 'week' ? 'bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white shadow-md' : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setView('day')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      view === 'day' ? 'bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white shadow-md' : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                    }`}
                  >
                    Day
                  </button>
                </div>

                <button
                  onClick={() => setShowSyncModal(true)}
                  className={`px-5 py-2.5 rounded-xl font-medium border-2 transition-all hover:scale-105 flex items-center gap-2 shadow-sm ${
                    googleCalendarConnected 
                      ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:shadow-md' 
                      : 'bg-white text-gray-700 border-gray-200 hover:shadow-md hover:border-gray-300'
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V9h14v10zm0-12H5V5h14v2z"/>
                  </svg>
                  <span className="hidden md:inline">
                    {googleCalendarConnected ? 'Google Synced' : 'Sync Calendar'}
                  </span>
                </button>

                <button
                  onClick={() => setShowTransactionModal(true)}
                  className="px-5 py-2.5 bg-white text-gray-700 rounded-xl font-medium border-2 border-gray-200 hover:shadow-md transition-all hover:scale-105 hover:border-gray-300"
                >
                  <span className="hidden md:inline">View Transactions</span>
                  <span className="md:hidden">Transactions</span>
                </button>

                <button
                  onClick={() => setShowEventModal(true)}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white rounded-xl font-medium hover:shadow-lg transition-all hover:scale-105 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden md:inline">Add Event</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* Calendar Content */}
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
          
          {/* Month Navigation */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  if (view === 'month') {
                    setCurrentDate(new Date(year, month - 1, 1))
                  } else if (view === 'week') {
                    const newDate = new Date(currentDate)
                    newDate.setDate(currentDate.getDate() - 7)
                    setCurrentDate(newDate)
                  } else if (view === 'day') {
                    const newDate = new Date(currentDate)
                    newDate.setDate(currentDate.getDate() - 1)
                    setCurrentDate(newDate)
                  }
                }}
                className="p-3 hover:bg-gradient-to-r hover:from-[#B89A5A]/10 hover:to-[#9B8049]/10 rounded-xl transition-all hover:scale-110"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="text-center">
                <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#B89A5A] via-[#C4A965] to-[#D4B87C] bg-clip-text text-transparent" style={{ fontFamily: 'Trajan Pro, serif' }}>
                  {view === 'month' && currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  {view === 'week' && `Week of ${getWeekDays(currentDate)[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                  {view === 'day' && currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </h2>
                <p className="text-sm text-gray-600 mt-2 font-medium">
                  {view === 'month' && `${monthEvents.length} event${monthEvents.length !== 1 ? 's' : ''} this month`}
                  {view === 'week' && `${getWeekDays(currentDate).reduce((sum, d) => sum + getEventsForDate(d).length, 0)} events this week`}
                  {view === 'day' && `${getEventsForDate(currentDate).length} event${getEventsForDate(currentDate).length !== 1 ? 's' : ''} today`}
                </p>
              </div>

              <button
                onClick={() => {
                  if (view === 'month') {
                    setCurrentDate(new Date(year, month + 1, 1))
                  } else if (view === 'week') {
                    const newDate = new Date(currentDate)
                    newDate.setDate(currentDate.getDate() + 7)
                    setCurrentDate(newDate)
                  } else if (view === 'day') {
                    const newDate = new Date(currentDate)
                    newDate.setDate(currentDate.getDate() + 1)
                    setCurrentDate(newDate)
                  }
                }}
                className="p-3 hover:bg-gradient-to-r hover:from-[#B89A5A]/10 hover:to-[#9B8049]/10 rounded-xl transition-all hover:scale-110"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Calendar Views */}
          {view === 'month' && (
            <MonthView 
              year={year}
              month={month}
              daysInMonth={daysInMonth}
              startingDayOfWeek={startingDayOfWeek}
              getEventsForDate={getEventsForDate}
              setSelectedDate={setSelectedDate}
              setSelectedEvent={setSelectedEvent}
            />
          )}

          {view === 'week' && (
            <WeekView 
              currentDate={currentDate}
              getWeekDays={getWeekDays}
              getEventsForDate={getEventsForDate}
              formatTime={formatTime}
            />
          )}

          {view === 'day' && (
            <DayView 
              currentDate={currentDate}
              getEventsForDate={getEventsForDate}
              formatTime={formatTime}
            />
          )}

          {/* Legend */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-sm border border-gray-200 p-6 mt-6 hover:shadow-md transition-shadow">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#B89A5A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Event Types
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-100">
                <div className="w-3 h-3 bg-blue-500 rounded-full shadow-sm"></div>
                <span className="text-sm text-gray-700 font-medium">Contracts</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-100">
                <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm"></div>
                <span className="text-sm text-gray-700 font-medium">Closings</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-100">
                <div className="w-3 h-3 bg-orange-500 rounded-full shadow-sm"></div>
                <span className="text-sm text-gray-700 font-medium">Deadlines</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-100">
                <div className="w-3 h-3 bg-purple-500 rounded-full shadow-sm"></div>
                <span className="text-sm text-gray-700 font-medium">Showings</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-100">
                <div className="w-3 h-3 bg-yellow-500 rounded-full shadow-sm"></div>
                <span className="text-sm text-gray-600">Meetings</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Trajan Pro, serif' }}>Add Event</h3>
              <button
                onClick={() => setShowEventModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Event Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Event Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                  placeholder="e.g., Showing at 123 Main St"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-[#B89A5A] focus:ring-2 focus:ring-[#B89A5A]/20 outline-none transition-all"
                />
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event Type</label>
                <select
                  value={eventForm.event_type}
                  onChange={(e) => setEventForm({...eventForm, event_type: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-[#B89A5A] focus:ring-2 focus:ring-[#B89A5A]/20 outline-none transition-all"
                >
                  <option value="meeting">Meeting</option>
                  <option value="showing">Showing</option>
                  <option value="call">Call</option>
                  <option value="coffee">Coffee</option>
                  <option value="deadline">Deadline</option>
                </select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Start Date & Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={eventForm.start_time}
                    onChange={(e) => setEventForm({...eventForm, start_time: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-[#B89A5A] focus:ring-2 focus:ring-[#B89A5A]/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={eventForm.end_time}
                    onChange={(e) => setEventForm({...eventForm, end_time: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-[#B89A5A] focus:ring-2 focus:ring-[#B89A5A]/20 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                  placeholder="e.g., 123 Main St or Zoom"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-[#B89A5A] focus:ring-2 focus:ring-[#B89A5A]/20 outline-none transition-all"
                />
              </div>

              {/* Link to Client */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Link to Client (Optional)</label>
                <select
                  value={eventForm.client_id || ''}
                  onChange={(e) => setEventForm({...eventForm, client_id: e.target.value || null})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-[#B89A5A] focus:ring-2 focus:ring-[#B89A5A]/20 outline-none transition-all"
                >
                  <option value="">No client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                  rows={3}
                  placeholder="Add notes about this event..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-[#B89A5A] focus:ring-2 focus:ring-[#B89A5A]/20 outline-none transition-all resize-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEventModal(false)}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white rounded-xl font-semibold hover:shadow-xl transition-all hover:scale-105"
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Trajan Pro, serif' }}>Your Transactions</h3>
              <button
                onClick={() => setShowTransactionModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-gray-600">No transactions yet</p>
                <button
                  onClick={() => router.push('/transactions')}
                  className="mt-4 px-6 py-2 bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white rounded-lg font-medium hover:shadow-lg transition-all"
                >
                  Create Your First Transaction
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map(transaction => {
                  const client = clients.find(c => c.id === transaction.client_id)
                  return (
                    <div key={transaction.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#B89A5A] transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1">{transaction.property_address}</h4>
                          <p className="text-sm text-gray-600">Client: {client?.name || 'Unknown'}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>Contract: {new Date(transaction.contract_date).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>Closing: {new Date(transaction.closing_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          transaction.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {transaction.status}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              onClick={() => setShowTransactionModal(false)}
              className="w-full mt-6 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Month View Component
function MonthView({ year, month, daysInMonth, startingDayOfWeek, getEventsForDate, setSelectedDate, setSelectedEvent }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Day Headers */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7">
        {/* Empty cells before first day */}
        {[...Array(startingDayOfWeek)].map((_, i) => (
          <div key={`empty-${i}`} className="h-32 bg-gray-50 border-b border-r border-gray-200"></div>
        ))}

        {/* Days of month */}
        {[...Array(daysInMonth)].map((_, i) => {
          const day = i + 1
          const date = new Date(year, month, day)
          const dayEvents = getEventsForDate(date)
          const isToday = date.toDateString() === new Date().toDateString()

          return (
            <div
              key={day}
              className="h-32 border-b border-r border-gray-200 p-2 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => {
                setSelectedDate(date)
                setSelectedEvent(null)
              }}
            >
              <div className={`text-sm font-semibold mb-2 ${
                isToday ? 'w-7 h-7 flex items-center justify-center bg-[#B89A5A] text-white rounded-full' : 'text-gray-900'
              }`}>
                {day}
              </div>
              <div className="space-y-1 overflow-y-auto max-h-20">
                {dayEvents.slice(0, 3).map((event, idx) => (
                  <div
                    key={idx}
                    className={`text-xs px-2 py-1 rounded truncate ${
                      event.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                      event.color === 'green' ? 'bg-green-100 text-green-800' :
                      event.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                      event.color === 'purple' ? 'bg-purple-100 text-purple-800' :
                      event.color === 'red' ? 'bg-red-100 text-red-800' :
                      event.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                      event.color === 'indigo' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 px-2">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Week View Component
function WeekView({ currentDate, getWeekDays, getEventsForDate, formatTime }) {
  const weekDays = getWeekDays(new Date(currentDate))
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-7">
        {weekDays.map((date, idx) => {
          const dayEvents = getEventsForDate(date)
          const isToday = date.toDateString() === new Date().toDateString()
          
          return (
            <div key={idx} className="border-r border-gray-200 last:border-r-0">
              <div className={`p-4 border-b border-gray-200 text-center ${isToday ? 'bg-[#B89A5A]/10' : 'bg-gray-50'}`}>
                <div className="text-xs font-medium text-gray-600">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-2xl font-bold mt-1 ${isToday ? 'text-[#B89A5A]' : 'text-gray-900'}`}>
                  {date.getDate()}
                </div>
              </div>
              <div className="p-3 space-y-2 min-h-[400px]">
                {dayEvents.map((event, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg text-xs ${
                      event.color === 'blue' ? 'bg-blue-100 text-blue-900' :
                      event.color === 'green' ? 'bg-green-100 text-green-900' :
                      event.color === 'orange' ? 'bg-orange-100 text-orange-900' :
                      event.color === 'purple' ? 'bg-purple-100 text-purple-900' :
                      event.color === 'yellow' ? 'bg-yellow-100 text-yellow-900' :
                      'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="font-semibold truncate">{event.title}</div>
                    {event.time && (
                      <div className="text-xs opacity-75 mt-1">{formatTime(event.time)}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Day View Component
function DayView({ currentDate, getEventsForDate, formatTime }) {
  const dayEvents = getEventsForDate(currentDate).sort((a, b) => {
    if (!a.time) return 1
    if (!b.time) return -1
    return new Date(a.time) - new Date(b.time)
  })
  
  const isToday = currentDate.toDateString() === new Date().toDateString()
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className={`p-6 border-b border-gray-200 ${isToday ? 'bg-[#B89A5A]/10' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="text-sm font-medium text-gray-600">
            {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
          </div>
          <div className={`text-4xl font-bold mt-2 ${isToday ? 'text-[#B89A5A]' : 'text-gray-900'}`} style={{ fontFamily: 'Trajan Pro, serif' }}>
            {currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="text-sm text-gray-600 mt-2">
            {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''} scheduled
          </div>
        </div>
      </div>

      <div className="p-6">
        {dayEvents.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-600">No events scheduled for this day</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dayEvents.map((event, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border-2 ${
                  event.color === 'blue' ? 'border-blue-200 bg-blue-50' :
                  event.color === 'green' ? 'border-green-200 bg-green-50' :
                  event.color === 'orange' ? 'border-orange-200 bg-orange-50' :
                  event.color === 'purple' ? 'border-purple-200 bg-purple-50' :
                  event.color === 'yellow' ? 'border-yellow-200 bg-yellow-50' :
                  'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">{event.title}</h4>
                    {event.time && (
                      <p className="text-sm text-gray-600 mb-2">
                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatTime(event.time)}
                      </p>
                    )}
                    {event.client && (
                      <p className="text-sm text-gray-600 mb-2">
                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {event.client}
                      </p>
                    )}
                    {event.location && (
                      <p className="text-sm text-gray-600 mb-2">
                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {event.location}
                      </p>
                    )}
                    {event.description && (
                      <p className="text-sm text-gray-700 mt-2">{event.description}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                    event.type === 'contract' ? 'bg-blue-100 text-blue-800' :
                    event.type === 'closing' ? 'bg-green-100 text-green-800' :
                    event.type === 'deadline' ? 'bg-orange-100 text-orange-800' :
                    event.type === 'showing' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {event.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Google Calendar Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#B89A5A] to-[#9B8049] p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V9h14v10zm0-12H5V5h14v2z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Trajan Pro, serif' }}>
                      Google Calendar Sync
                    </h3>
                    <p className="text-white/80 text-sm">Connect your calendar</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {!googleCalendarConnected ? (
                <>
                  {/* Not Connected State */}
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V9h14v10zm0-12H5V5h14v2z"/>
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Sync with Google Calendar</h4>
                    <p className="text-sm text-gray-600 mb-6">
                      Connect your Google Calendar to automatically sync your Aureum events, transactions, and deadlines.
                    </p>
                  </div>

                  {/* Features List */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                      <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Two-way Sync</p>
                        <p className="text-xs text-gray-600">Events update in both calendars automatically</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Real-time Updates</p>
                        <p className="text-xs text-gray-600">Changes sync instantly across platforms</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                      <svg className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Smart Notifications</p>
                        <p className="text-xs text-gray-600">Get reminders on all your devices</p>
                      </div>
                    </div>
                  </div>

                  {/* Connect Button */}
                  <button
                    onClick={async () => {
                      setSyncStatus('syncing')
                      // Redirect to Google OAuth endpoint
                      window.location.href = '/api/auth/google'
                    }}
                    disabled={syncStatus === 'syncing'}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncStatus === 'syncing' ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Connect with Google
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-500 text-center mt-4">
                    By connecting, you authorize Aureum to access your Google Calendar
                  </p>
                </>
              ) : (
                <>
                  {/* Connected State */}
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Successfully Connected!</h4>
                    <p className="text-sm text-gray-600 mb-6">
                      Your Aureum calendar is now syncing with Google Calendar
                    </p>
                  </div>

                  {/* Sync Settings */}
                  <div className="space-y-4 mb-6">
                    <div className="p-4 border-2 border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12S18.617 0 12 0zm-1 17.414l-4.707-4.707 1.414-1.414L11 14.586l6.293-6.293 1.414 1.414L11 17.414z"/>
                          </svg>
                          <span className="text-sm font-medium text-gray-900">Sync Status</span>
                        </div>
                        <span className="text-xs text-green-600 font-medium">Active</span>
                      </div>
                      <p className="text-xs text-gray-600">Last synced: Just now</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h5 className="text-sm font-semibold text-gray-900 mb-3">What's Syncing</h5>
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span>Transaction contract & closing dates</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <span>Timeline deadlines</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <span>Custom calendar events</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Disconnect Button */}
                  <button
                    onClick={() => {
                      setGoogleCalendarConnected(false)
                      setSyncStatus('idle')
                      setShowSyncModal(false)
                    }}
                    className="w-full px-6 py-3 bg-red-50 text-red-600 rounded-xl font-semibold border-2 border-red-200 hover:bg-red-100 transition-all"
                  >
                    Disconnect Google Calendar
                  </button>
                </>
              )}
            </div>

            {/* Modal Footer */}
            {googleCalendarConnected && (
              <div className="bg-gray-50 p-6 rounded-b-2xl border-t border-gray-200">
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="w-full px-6 py-2.5 bg-white text-gray-700 rounded-xl font-medium border-2 border-gray-200 hover:bg-gray-50 transition-all"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}