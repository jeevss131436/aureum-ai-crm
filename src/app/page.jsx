"use client"
import { useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [message, setMessage] = useState('')
  const [isSignup, setIsSignup] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
    else window.location.href = '/dashboard'
  }

  async function handleSignup(e) {
    e.preventDefault()
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    })
    if (error) setMessage(error.message)
    else setMessage("Check your email for confirmation.")
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F7F5EF]">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Image 
              src="/aureum-logo.png" 
              alt="Aureum Logo" 
              width={80} 
              height={80}
              className="object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold text-[#B89A5A] mb-2" style={{ fontFamily: 'Trajan Pro, serif' }}>
            AUREUM
          </h1>
          <p className="text-gray-600">Your AI-Powered Real Estate CRM</p>
        </div>

        {/* Login Card */}
        <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-[#B89A5A]/20">
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setIsSignup(false)}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                !isSignup 
                  ? 'bg-[#B89A5A] text-white' 
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsSignup(true)}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                isSignup 
                  ? 'bg-[#B89A5A] text-white' 
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-5">
            {isSignup && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                <input
                  className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] focus:border-transparent outline-none transition-all"
                  placeholder="John Doe"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input
                className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] focus:border-transparent outline-none transition-all"
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <input
                className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#B89A5A] focus:border-transparent outline-none transition-all"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#B89A5A] to-[#9B8049] text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200"
            >
              {isSignup ? 'Create Account' : 'Sign In'}
            </button>

            {message && (
              <div className="text-center p-3 rounded-lg bg-[#F7F5EF] border border-[#B89A5A]/30">
                <p className="text-sm text-[#B89A5A] font-medium">{message}</p>
              </div>
            )}
          </form>

          <p className="text-center text-gray-400 text-xs mt-6">
            © 2025 Aureum. Empowering real estate professionals.
          </p>
        </div>
      </div>
    </div>
  )
}