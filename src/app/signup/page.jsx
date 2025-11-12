"use client"
import { useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  async function handleSignup(e) {
    e.preventDefault()
    setMessage('')
    
    // Validation
    if (formData.password !== formData.confirmPassword) {
      setMessage('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      setMessage('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)

    const fullName = `${formData.firstName} ${formData.lastName}`.trim()
    
    const { data, error } = await supabase.auth.signUp({ 
      email: formData.email, 
      password: formData.password,
      options: {
        data: {
          full_name: fullName,
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone
        }
      }
    })

    setIsLoading(false)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage("Success! Check your email to confirm your account.")
      // Clear form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
      })
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
        <p className="text-gray-600 text-lg">Create your account</p>
      </div>

      {/* Signup Card */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-[#B89A5A]/20 p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Sign Up</h2>
        
        <form onSubmit={handleSignup} className="space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                First Name *
              </label>
              <input
                className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#1e40af] focus:border-[#1e40af] outline-none transition-all"
                placeholder="John"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Last Name *
              </label>
              <input
                className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#1e40af] focus:border-[#1e40af] outline-none transition-all"
                placeholder="Doe"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          
          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email *
            </label>
            <input
              className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#1e40af] focus:border-[#1e40af] outline-none transition-all"
              placeholder="john@example.com"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Phone Number *
            </label>
            <input
              className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#1e40af] focus:border-[#1e40af] outline-none transition-all"
              placeholder="(555) 123-4567"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password *
            </label>
            <input
              className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#1e40af] focus:border-[#1e40af] outline-none transition-all"
              type="password"
              placeholder="Minimum 6 characters"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Confirm Password *
            </label>
            <input
              className="w-full px-4 py-3 border border-[#B89A5A]/30 rounded-lg focus:ring-2 focus:ring-[#1e40af] focus:border-[#1e40af] outline-none transition-all"
              type="password"
              placeholder="Re-enter your password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>
          
          {/* Submit Button */}
          <div className="pt-2">
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-white text-[#B89A5A] border-2 border-[#B89A5A] px-6 py-3 rounded-lg font-semibold hover:border-[#1e40af] hover:text-[#1e40af] transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
          
          {/* Message Display */}
          {message && (
            <div className={`p-3 rounded-lg text-sm text-center ${
              message.includes('Success') || message.includes('Check your email') 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          {/* Login Link */}
          <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => window.location.href = '/login'}
                className="text-[#B89A5A] hover:text-[#1e40af] font-semibold transition"
              >
                Sign in
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