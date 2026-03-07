import { getGrowthStats, getTodaysTasks } from '@/app/actions/admin'
import { GrowthClient } from './GrowthClient'

export default async function AdminGrowthPage() {
  const { stats, error: statsError } = await getGrowthStats()
  const { tasks: todaysTasks, error: tasksError } = await getTodaysTasks()

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F] p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
          Growth OS
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          90-day growth campaign management
        </p>
      </div>

      {/* Main Content */}
      <GrowthClient
        initialStats={stats}
        initialTodaysTasks={todaysTasks || []}
        statsError={statsError}
        tasksError={tasksError}
      />
    </div>
  )
}
