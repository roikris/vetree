'use client'

import { useState, useEffect } from 'react'
import { getGrowthTasks } from '@/app/actions/admin'

type GrowthTask = {
  id: string
  day_number: number
  scheduled_date: string
  platform: string
  group_name: string
  language: string
  content: string
  status: 'pending' | 'done' | 'skipped'
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

export function UpcomingTasks() {
  const [tasks, setTasks] = useState<GrowthTask[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadUpcomingTasks()
  }, [])

  const loadUpcomingTasks = async () => {
    setIsLoading(true)
    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)

      const { tasks } = await getGrowthTasks({
        startDate: tomorrow.toISOString().split('T')[0],
        endDate: nextWeek.toISOString().split('T')[0],
        status: 'pending'
      })

      setTasks(tasks)
    } catch (error) {
      console.error('Error loading upcoming tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          Upcoming Tasks (Next 7 Days)
        </h2>
        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
        Upcoming Tasks (Next 7 Days)
      </h2>

      {tasks.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
          No upcoming tasks
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const taskDate = new Date(task.scheduled_date)
            const formattedDate = taskDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })

            return (
              <div
                key={task.id}
                className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="text-2xl">{PLATFORM_ICONS[task.platform]}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#1A1A1A] dark:text-[#E8E8E8] truncate">
                    {task.group_name}
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    {task.platform.replace('_', ' ')} • {task.language === 'he' ? '🇮🇱' : '🇺🇸'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {formattedDate}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Day {task.day_number}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
