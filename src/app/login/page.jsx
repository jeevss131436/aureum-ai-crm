"use client"
import { useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    
    setIsLoading(false)
    
    if (error) {
      setMessage(error.message)
    } else {
      setMessage("Logged in successfully!")
      // Redirect to dashboard immediately
      setTimeout(() => {
        router.push('/dashboard')
      }, 500)
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFFF0] flex flex-col items-center justify-center p-4">
      {/* Header with Logo */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Image 
            src="/aureum-logo-login.png" 
            alt="Aureum Logo" 
            width={48} 
            height={48}
            className="object-contain"
          />
          <h1 className="text-3xl font-bold text-[#B89A5A]" style={{ fontFamily: 'Trajan Pro, serif' }}>
            AUREUM
          </h1>
        </div>
        <p className="text-gray-600 text-lg">Welcome to your CRM dashboard</p>
      </div>

      {/* Login Card */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-[#B89A5A]/20 p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Sign In</h2>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <input
              className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#1e40af] focus:border-[#1e40af] outline-none transition-all"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <input
              className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#1e40af] focus:border-[#1e40af] outline-none transition-all"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="pt-2">
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-white text-[#B89A5A] border-2 border-[#B89A5A] px-6 py-3 rounded-lg font-semibold hover:border-[#1e40af] hover:text-[#1e40af] transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
          
          {message && (
            <div className={`p-3 rounded-lg text-sm text-center ${
              message.includes('successfully') || message.includes('Check your email') 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          {/* Signup Link */}
          <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => router.push('/signup')}
                className="text-[#B89A5A] hover:text-[#1e40af] font-semibold transition"
              >
                Create one
              </button>
            </p>
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>© 2024 Aureum CRM. All rights reserved.</p>
      </div>
    </div>
  )
}