'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { FormInput } from '@/components/auth/FormInput'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.')
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please confirm your email before logging in.')
        } else {
          setError(signInError.message)
        }
        setLoading(false)
        return
      }

      // Success - redirect to home page
      router.push('/')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to access your saved searches and recommendations"
    >
      <form onSubmit={handleLogin} className="space-y-6">
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
          placeholder="Enter your password"
        />

        <div className="text-right">
          <Link
            href="/reset-password"
            className="text-sm text-[#3D7A5F] dark:text-[#4E9A78] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-3 font-medium transition-colors"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>

        <div className="text-center text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">
            Don&apos;t have an account?{' '}
          </span>
          <Link
            href="/signup"
            className="text-[#3D7A5F] dark:text-[#4E9A78] hover:underline font-medium"
          >
            Sign up
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
