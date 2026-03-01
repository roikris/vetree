'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'

export function AuthButton() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  if (loading) {
    return <div className="w-24 h-10" /> // Placeholder to prevent layout shift
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-600 dark:text-zinc-400 hidden sm:inline">
          {user.email}
        </span>
        <button
          onClick={handleSignOut}
          className="bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#1A1A1A] dark:text-[#E8E8E8] hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <Link
      href="/login"
      className="bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] rounded-lg px-4 py-2 text-sm font-medium transition-colors"
    >
      Sign In
    </Link>
  )
}
