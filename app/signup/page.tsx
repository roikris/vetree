'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { FormInput } from '@/components/auth/FormInput'
import { createClient } from '@/lib/supabase/client'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignUp = async (e: React.FormEvent) => {
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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('This email is already registered. Please log in instead.')
        } else {
          setError(signUpError.message)
        }
        setLoading(false)
        return
      }

      // Success - show confirmation message
      setSuccess(true)
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="We've sent you a confirmation link"
      >
        <div className="space-y-6">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-green-800 dark:text-green-200 text-sm">
              Please check your email and click the confirmation link to activate your account.
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
      title="Create your account"
      subtitle="Join Vetree to save searches and get personalized recommendations"
    >
      <form onSubmit={handleSignUp} className="space-y-6">
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

        <FormInput
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 6 characters"
        />

        <FormInput
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Re-enter your password"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-3 font-medium transition-colors"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>

        <div className="text-center text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">
            Already have an account?{' '}
          </span>
          <Link
            href="/login"
            className="text-[#3D7A5F] dark:text-[#4E9A78] hover:underline font-medium"
          >
            Log in
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
