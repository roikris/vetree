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
        <Link
          href="/library"
          className="flex items-center gap-1.5 text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
          </svg>
          <span className="hidden sm:inline">My Library</span>
        </Link>
        <Link
          href="/profile"
          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-[#3D7A5F] dark:hover:text-[#4E9A78] hidden md:inline transition-colors"
        >
          {user.email}
        </Link>
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
