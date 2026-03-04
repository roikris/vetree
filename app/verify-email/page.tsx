'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function VerifyEmailPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleResendEmail = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user?.email) {
        setMessage({ type: 'error', text: 'No email address found' })
        setLoading(false)
        return
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      })

      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setMessage({ type: 'success', text: 'Confirmation email sent! Please check your inbox.' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to resend email. Please try again.' })
    }

    setLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F] flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#3D7A5F]/10 dark:bg-[#4E9A78]/10 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-[#3D7A5F] dark:text-[#4E9A78]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {/* Header */}
        <h1 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] text-center mb-2">
          Verify Your Email
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-center mb-8">
          Please check your email and click the confirmation link to continue using Vetree.
        </p>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleResendEmail}
            disabled={loading}
            className="w-full bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] rounded-lg px-4 py-3 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Resend Confirmation Email'}
          </button>

          <button
            onClick={handleSignOut}
            disabled={loading}
            className="w-full bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 text-[#1A1A1A] dark:text-[#E8E8E8] hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg px-4 py-3 font-medium transition-colors disabled:opacity-50"
          >
            Sign Out
          </button>
        </div>

        {/* Help Text */}
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mt-8">
          Didn't receive an email? Check your spam folder or click "Resend Confirmation Email" above.
        </p>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-sm text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
