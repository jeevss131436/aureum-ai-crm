'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function ProfilePage() {
  const router = useRouter()
  
  // State for user data
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
  })
  
  // Success/error messages
  const [message, setMessage] = useState({ type: '', text: '' })

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserProfile()
  }, [])

  const fetchUserProfile = async () => {
    try {
      setLoading(true)
      
      // Get current user from Supabase Auth
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      if (!authUser) {
        router.push('/login')
        return
      }
  
      setUser(authUser)
      setFormData({
        first_name: authUser.user_metadata?.first_name || '',
        last_name: authUser.user_metadata?.last_name || '',
        email: authUser.email || '',
        phone_number: authUser.user_metadata?.phone || '',
      })
      
    } catch (error) {
      console.error('Error fetching profile:', error)
      setMessage({ type: 'error', text: 'Failed to load profile' })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSaveChanges = async () => {
    try {
      setSaving(true)
      setMessage({ type: '', text: '' })
  
      // Update user metadata in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          full_name: `${formData.first_name} ${formData.last_name}`,
          phone: formData.phone_number,
        }
      })
  
      if (updateError) throw updateError
  
      // If email changed, update auth email
      if (formData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email
        })
        if (emailError) throw emailError
        setMessage({ 
          type: 'success', 
          text: 'Profile updated! Check your new email for verification.' 
        })
      } else {
        setMessage({ type: 'success', text: 'Profile updated successfully!' })
      }
  
      setIsEditing(false)
      await fetchUserProfile() // Refresh data
      
    } catch (error) {
      console.error('Error updating profile:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    try {
      setSaving(true)
      
      // Note: User deletion requires admin privileges
      // You may need to create an API route for this
      alert('Account deletion requires contacting support. Please email support@aureum.com')
      
      // Alternatively, just sign out:
      await supabase.auth.signOut()
      router.push('/login')
      
    } catch (error) {
      console.error('Error deleting account:', error)
      setMessage({ type: 'error', text: 'Failed to delete account.' })
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B89A5A]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-gray-800">Profile Settings</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        
        {/* Success/Error Messages */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 
            'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          
          {/* Profile Header with Avatar */}
          <div className="bg-gradient-to-r from-[#B89A5A] to-[#D4B87C] px-6 py-8">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-3xl font-bold text-[#B89A5A]">
                  {formData.first_name.charAt(0)}{formData.last_name.charAt(0)}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {formData.first_name} {formData.last_name}
                </h2>
                <p className="text-white/80 text-sm mt-1">{formData.email}</p>
              </div>
            </div>
          </div>

          {/* Profile Information */}
          <div className="p-6 space-y-6">
            
            {/* Personal Information Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Personal Information</h3>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-sm font-medium text-[#B89A5A] hover:bg-[#B89A5A]/10 rounded-lg transition-colors border border-[#B89A5A]"
                  >
                    Edit Profile
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2 border rounded-lg transition-colors ${
                      isEditing 
                        ? 'border-gray-300 focus:border-[#B89A5A] focus:ring-2 focus:ring-[#B89A5A]/20 bg-white' 
                        : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                    } outline-none`}
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2 border rounded-lg transition-colors ${
                      isEditing 
                        ? 'border-gray-300 focus:border-[#B89A5A] focus:ring-2 focus:ring-[#B89A5A]/20 bg-white' 
                        : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                    } outline-none`}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2 border rounded-lg transition-colors ${
                      isEditing 
                        ? 'border-gray-300 focus:border-[#B89A5A] focus:ring-2 focus:ring-[#B89A5A]/20 bg-white' 
                        : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                    } outline-none`}
                  />
                  {isEditing && (
                    <p className="text-xs text-gray-500 mt-1">
                      Changing your email will require verification
                    </p>
                  )}
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="+1 (555) 000-0000"
                    className={`w-full px-4 py-2 border rounded-lg transition-colors ${
                      isEditing 
                        ? 'border-gray-300 focus:border-[#B89A5A] focus:ring-2 focus:ring-[#B89A5A]/20 bg-white' 
                        : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                    } outline-none`}
                  />
                </div>
              </div>

              {/* Action Buttons (shown when editing) */}
              {isEditing && (
                <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleSaveChanges}
                    disabled={saving}
                    className="flex-1 bg-[#B89A5A] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#A68949] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      fetchUserProfile() // Reset to original data
                      setMessage({ type: '', text: '' })
                    }}
                    disabled={saving}
                    className="flex-1 bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account Management Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-6 overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Management</h3>
            
            <div className="space-y-4">
              {/* Change Password */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-800">Password</h4>
                    <p className="text-sm text-gray-600 mt-1">Update your password to keep your account secure</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
                          redirectTo: `${window.location.origin}/reset-password`,
                        })
                        if (error) throw error
                        setMessage({ type: 'success', text: 'Password reset email sent!' })
                      } catch (error) {
                        setMessage({ type: 'error', text: 'Failed to send reset email' })
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-[#B89A5A] hover:bg-[#B89A5A]/10 rounded-lg transition-colors border border-[#B89A5A]"
                  >
                    Change Password
                  </button>
                </div>
              </div>

              {/* Delete Account */}
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-red-800">Delete Account</h4>
                    <p className="text-sm text-red-600 mt-1">Permanently delete your account and all data</p>
                  </div>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-300"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Created Date */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Account created on {new Date(user?.created_at).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Delete Account</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete your account? This action cannot be undone and will permanently delete:
            </p>
            
            <ul className="text-sm text-gray-600 space-y-2 mb-6 ml-4 list-disc">
              <li>Your profile information</li>
              <li>All transactions and timeline data</li>
              <li>All clients and leads</li>
              <li>Chat history</li>
              <li>All briefings and notifications</li>
            </ul>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={saving}
                className="flex-1 bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={saving}
                className="flex-1 bg-red-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}