'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendPasswordResetEmail } from '@/app/actions/profile'

export function ProfileClient() {
  const router = useRouter()
  const supabase = createClient()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleSignOut = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handlePasswordReset = async () => {
    setLoading(true)
    setMessage(null)

    const result = await sendPasswordResetEmail()

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Password reset email sent! Check your inbox.' })
    }

    setLoading(false)
  }

  const handleDeleteAccount = async () => {
    setLoading(true)
    setMessage(null)
    setShowDeleteModal(false)

    try {
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to delete account' })
        setLoading(false)
        return
      }

      // Show success message
      setMessage({ type: 'success', text: 'Account deleted successfully. Redirecting...' })

      // Wait 2 seconds then redirect to home
      setTimeout(() => {
        router.push('/')
        router.refresh()
      }, 2000)
    } catch (error) {
      console.error('Error deleting account:', error)
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' })
      setLoading(false)
    }
  }

  return (
    <>
      {/* Messages */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Account Actions */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          Account Actions
        </h2>
        <div className="space-y-3">
          <button
            onClick={handlePasswordReset}
            disabled={loading}
            className="w-full text-left px-4 py-3 bg-white dark:bg-[#0F0F0F] border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-[#1A1A1A] dark:text-[#E8E8E8]">Change Password</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">Send password reset email</div>
              </div>
              <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          <button
            onClick={handleSignOut}
            disabled={loading}
            className="w-full text-left px-4 py-3 bg-white dark:bg-[#0F0F0F] border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-[#1A1A1A] dark:text-[#E8E8E8]">Sign Out</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">Sign out of your account</div>
              </div>
              <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-900/10 border-2 border-red-200 dark:border-red-900/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-red-900 dark:text-red-200 mb-4">
          Danger Zone
        </h2>
        <p className="text-sm text-red-700 dark:text-red-300 mb-4">
          Once you delete your account, there is no going back. This will permanently delete your account and all your data, including saved articles, reports, and account information.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          disabled={loading}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Delete Account
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-red-900 dark:text-red-200 mb-2">
              Are you sure?
            </h3>
            <p className="text-zinc-700 dark:text-zinc-300 mb-6">
              This will <strong>permanently delete your account and all your data</strong>. All your saved articles, reports, and account information will be removed. This action <strong>cannot be undone</strong>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-white dark:bg-[#0F0F0F] border border-zinc-200 dark:border-zinc-800 text-[#1A1A1A] dark:text-[#E8E8E8] font-medium rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
