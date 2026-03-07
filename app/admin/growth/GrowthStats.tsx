'use client'

type Stats = {
  currentDay: number
  totalDays: number
  completedThisWeek: number
  totalDone: number
  platformsThisWeek: string[]
}

type GrowthStatsProps = {
  stats?: Stats
  error: string | null
}

const PLATFORM_COLORS: Record<string, string> = {
  facebook_il: '#1877F2',
  facebook_intl: '#1877F2',
  whatsapp: '#25D366',
  reddit: '#FF4500',
  linkedin: '#0A66C2',
  twitter: '#000000',
  instagram: '#E1306C',
  telegram: '#26A5E4',
  kol: '#3D7A5F'
}

const PLATFORM_ICONS: Record<string, string> = {
  facebook_il: '📘',
  facebook_intl: '📘',
  whatsapp: '💬',
  reddit: '🤖',
  linkedin: '💼',
  twitter: '🐦',
  instagram: '📸',
  telegram: '✈️',
  kol: '🌟'
}

export function GrowthStats({ stats, error }: GrowthStatsProps) {
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200 text-sm">
          Error loading growth stats: {error}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Campaign Progress */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Campaign Progress</span>
          <span className="text-2xl">🚀</span>
        </div>
        <div className="text-3xl font-bold text-[#3D7A5F] dark:text-[#4E9A78] mb-1">
          Day {stats?.currentDay || 1}/{stats?.totalDays || 90}
        </div>
        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 mt-2">
          <div
            className="bg-[#3D7A5F] dark:bg-[#4E9A78] h-2 rounded-full transition-all"
            style={{ width: `${((stats?.currentDay || 1) / (stats?.totalDays || 90)) * 100}%` }}
          />
        </div>
      </div>

      {/* This Week */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">This Week</span>
          <span className="text-2xl">📅</span>
        </div>
        <div className="text-3xl font-bold text-blue-600 dark:text-blue-500 mb-1">
          {stats?.completedThisWeek || 0}/7
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Tasks completed
        </p>
      </div>

      {/* Total Progress */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Total Done</span>
          <span className="text-2xl">✅</span>
        </div>
        <div className="text-3xl font-bold text-green-600 dark:text-green-500 mb-1">
          {stats?.totalDone || 0}/{stats?.totalDays || 90}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {Math.round(((stats?.totalDone || 0) / (stats?.totalDays || 90)) * 100)}% complete
        </p>
      </div>

      {/* Platforms This Week */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Platforms Covered</span>
          <span className="text-2xl">🌐</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {stats?.platformsThisWeek && stats.platformsThisWeek.length > 0 ? (
            stats.platformsThisWeek.map((platform) => (
              <span
                key={platform}
                className="text-2xl"
                title={platform}
              >
                {PLATFORM_ICONS[platform] || '📱'}
              </span>
            ))
          ) : (
            <span className="text-sm text-zinc-400">No platforms yet</span>
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
          {stats?.platformsThisWeek?.length || 0} platforms this week
        </p>
      </div>
    </div>
  )
}
