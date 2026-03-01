'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { FormInput } from '@/components/auth/FormInput'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    // Check if we're in recovery mode (user clicked reset link in email)
    const type = searchParams.get('type')
    if (type === 'recovery') {
      setIsRecoveryMode(true)
    }
  }, [searchParams])

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) {
        setError(resetError.message)
        setLoading(false)
        return
      }

      setSuccess(true)
      setLoading(false)
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validate password match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      // Success - redirect to login
      router.push('/login')
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  // Recovery mode - set new password
  if (isRecoveryMode) {
    return (
      <AuthLayout
        title="Set new password"
        subtitle="Enter your new password below"
      >
        <form onSubmit={handleUpdatePassword} className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          <FormInput
            label="New Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="At least 6 characters"
          />

          <FormInput
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Re-enter your new password"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-3 font-medium transition-colors"
          >
            {loading ? 'Updating password...' : 'Update password'}
          </button>
        </form>
      </AuthLayout>
    )
  }

  // Request reset mode
  if (success) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="We've sent you a password reset link"
      >
        <div className="space-y-6">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-green-800 dark:text-green-200 text-sm">
              Please check your email and click the reset link to set a new password.
            </p>
          </div>
          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-[#3D7A5F] dark:text-[#4E9A78] hover:underline"
            >
              Return to login
            </Link>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email to receive a password reset link"
    >
      <form onSubmit={handleRequestReset} className="space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        <FormInput
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="your@email.com"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-3 font-medium transition-colors"
        >
          {loading ? 'Sending reset link...' : 'Send reset link'}
        </button>

        <div className="text-center text-sm">
          <Link
            href="/login"
            className="text-[#3D7A5F] dark:text-[#4E9A78] hover:underline"
          >
            Back to login
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <AuthLayout title="Loading..." subtitle="">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3D7A5F] dark:border-[#4E9A78]"></div>
        </div>
      </AuthLayout>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
