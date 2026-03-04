'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AvatarUpload } from '@/components/profile/AvatarUpload'

type ProfileHeaderProps = {
  userId: string
  email: string
  initials: string
  avatarUrl: string | null
}

export function ProfileHeader({ userId, email, initials, avatarUrl }: ProfileHeaderProps) {
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(avatarUrl)

  const handleAvatarUpdate = (url: string) => {
    setCurrentAvatarUrl(url)
    // Force a cache-busting reload by appending timestamp
    setCurrentAvatarUrl(`${url}?t=${Date.now()}`)
  }

  return (
    <header className="mb-8">
      <Link
        href="/"
        className="flex items-center gap-2 text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] transition-colors mb-6"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span className="text-sm font-medium">Back to Search</span>
      </Link>

      <div className="flex items-center gap-4">
        {/* User Avatar with Upload */}
        <AvatarUpload
          userId={userId}
          currentAvatarUrl={currentAvatarUrl}
          initials={initials}
          onAvatarUpdate={handleAvatarUpdate}
        />

        <div>
          <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
            Profile
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {email}
          </p>
        </div>
      </div>
    </header>
  )
}
