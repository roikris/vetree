'use client'

import { useState, useEffect } from 'react'
import { getGrowthTasks, getGrowthStats, getTodaysTasks } from '@/app/actions/admin'
import { GrowthStats } from './GrowthStats'
import { WeeklyCalendar } from './WeeklyCalendar'
import { TodaysTasks } from './TodaysTasks'
import { UpcomingTasks } from './UpcomingTasks'
import { TaskHistory } from './TaskHistory'

type GrowthTask = {
  id: string
  day_number: number
  scheduled_date: string
  platform: string
  group_name: string
  language: string
  content: string
  article_id: string | null
  status: 'pending' | 'done' | 'skipped'
  notes: string | null
  created_at: string
  completed_at: string | null
}

type Stats = {
  currentDay: number
  totalDays: number
  completedThisWeek: number
  totalDone: number
  platformsThisWeek: string[]
}

type GrowthClientProps = {
  initialStats?: Stats
  initialTodaysTasks: GrowthTask[]
  statsError: string | null
  tasksError: string | null
}

export function GrowthClient({
  initialStats,
  initialTodaysTasks,
  statsError,
  tasksError
}: GrowthClientProps) {
  const [stats, setStats] = useState<Stats | undefined>(initialStats)
  const [todaysTasks, setTodaysTasks] = useState<GrowthTask[]>(initialTodaysTasks)
  const [activeTab, setActiveTab] = useState<'week' | 'history'>('week')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshData = async () => {
    setIsRefreshing(true)
    try {
      const [statsResult, tasksResult] = await Promise.all([
        getGrowthStats(),
        getTodaysTasks()
      ])

      if (statsResult.stats) {
        setStats(statsResult.stats)
      }
      if (tasksResult.tasks) {
        setTodaysTasks(tasksResult.tasks)
      }
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Stats Header */}
      <GrowthStats stats={stats} error={statsError} />

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('week')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'week'
              ? 'text-[#3D7A5F] dark:text-[#4E9A78] border-b-2 border-[#3D7A5F] dark:border-[#4E9A78]'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          This Week
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-[#3D7A5F] dark:text-[#4E9A78] border-b-2 border-[#3D7A5F] dark:border-[#4E9A78]'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          History
        </button>
        <div className="ml-auto flex items-center">
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-50 p-2"
            title="Refresh data"
          >
            <svg
              className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'week' ? (
        <>
          {/* Weekly Calendar */}
          <WeeklyCalendar onRefresh={refreshData} />

          {/* Today's Tasks */}
          <TodaysTasks tasks={todaysTasks} onTaskUpdate={refreshData} />

          {/* Upcoming Tasks */}
          <UpcomingTasks />
        </>
      ) : (
        <TaskHistory />
      )}
    </div>
  )
}
