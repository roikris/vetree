import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSavedArticles } from '@/app/actions/saved-articles'
import { getUserStats } from '@/app/actions/profile'
import { ProfileClient } from './ProfileClient'
import { ProfileHeader } from './ProfileHeader'
import Link from 'next/link'
import { Article } from '@/lib/supabase'
import { BottomNav } from '@/components/ui/BottomNav'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login')
  }

  // Get user stats
  const { stats } = await getUserStats()

  // Get last 3 saved articles
  const { articles } = await getSavedArticles()
  const recentArticles = articles.slice(0, 3)

  // Get user initials for avatar
  const email = user.email || ''
  const initials = email
    .split('@')[0]
    .split(/[._-]/)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Get avatar URL from user metadata
  const avatarUrl = user.user_metadata?.avatar_url || null

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-[#0F0F0F]">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-20 md:pb-8">
        {/* Header - Client Component for Avatar Upload */}
        <ProfileHeader
          userId={user.id}
          email={email}
          initials={initials}
          avatarUrl={avatarUrl}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Total Saved */}
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="text-3xl font-bold text-[#3D7A5F] dark:text-[#4E9A78] mb-1">
              {stats?.totalSaved || 0}
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Articles Saved
            </div>
          </div>

          {/* Most Saved Specialty */}
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-1 truncate">
              {stats?.mostSavedLabel || 'N/A'}
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Top Specialty
            </div>
          </div>

          {/* Member Since */}
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="text-3xl font-bold text-[#3D7A5F] dark:text-[#4E9A78] mb-1">
              {stats?.daysSinceCreation || 0}
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Days as Member
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
            Account Information
          </h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Email</div>
              <div className="text-base text-[#1A1A1A] dark:text-[#E8E8E8]">{email}</div>
            </div>
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Member Since</div>
              <div className="text-base text-[#1A1A1A] dark:text-[#E8E8E8]">{stats?.memberSince}</div>
            </div>
          </div>
        </div>

        {/* Recent Saved Articles */}
        {recentArticles.length > 0 && (
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
                Recent Saved Articles
              </h2>
              <Link
                href="/library"
                className="text-sm text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] font-medium transition-colors"
              >
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {recentArticles.map((article: Article) => (
                <Link
                  key={article.id}
                  href={`/article/${article.id}`}
                  className="block p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <h3 className="font-medium text-[#1A1A1A] dark:text-[#E8E8E8] mb-1 line-clamp-1">
                    {article.title}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                    {article.clinical_bottom_line}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Account Actions - Client Component */}
        <ProfileClient />
        </div>
      </div>
      <BottomNav />
    </>
  )
}
