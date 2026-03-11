import { GrowthClient } from './GrowthClient'

export default async function AdminGrowthPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F] p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
          Growth OS
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          90-day content campaign powered by AI
        </p>
      </div>

      {/* Main Content */}
      <GrowthClient />
    </div>
  )
}
