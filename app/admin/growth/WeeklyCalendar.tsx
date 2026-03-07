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

type WeeklyCalendarProps = {
  onRefresh: () => void
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

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDates() {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    return date.toISOString().split('T')[0]
  })
}

export function WeeklyCalendar({ onRefresh }: WeeklyCalendarProps) {
  const [weekTasks, setWeekTasks] = useState<Record<string, GrowthTask>>({})
  const [selectedTask, setSelectedTask] = useState<GrowthTask | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const weekDates = getWeekDates()
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadWeekTasks()
  }, [])

  const loadWeekTasks = async () => {
    setIsLoading(true)
    try {
      const { tasks } = await getGrowthTasks({
        startDate: weekDates[0],
        endDate: weekDates[6]
      })

      const tasksByDate: Record<string, GrowthTask> = {}
      tasks.forEach(task => {
        tasksByDate[task.scheduled_date] = task
      })

      setWeekTasks(tasksByDate)
    } catch (error) {
      console.error('Error loading week tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
        This Week's Schedule
      </h2>

      <div className="grid grid-cols-7 gap-3">
        {weekDates.map((date, index) => {
          const task = weekTasks[date]
          const isToday = date === today
          const dayName = DAYS[index]
          const dayNumber = new Date(date).getDate()

          return (
            <div
              key={date}
              className={`rounded-lg p-3 border-2 transition-all cursor-pointer ${
                isToday
                  ? 'border-[#3D7A5F] dark:border-[#4E9A78] bg-[#3D7A5F]/5 dark:bg-[#4E9A78]/5'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
              onClick={() => task && setSelectedTask(task)}
            >
              {/* Day Header */}
              <div className="text-center mb-2">
                <div className={`text-xs font-medium ${
                  isToday
                    ? 'text-[#3D7A5F] dark:text-[#4E9A78]'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}>
                  {dayName}
                </div>
                <div className={`text-lg font-semibold ${
                  isToday
                    ? 'text-[#3D7A5F] dark:text-[#4E9A78]'
                    : 'text-zinc-900 dark:text-zinc-100'
                }`}>
                  {dayNumber}
                </div>
              </div>

              {/* Task Info */}
              {task ? (
                <div className="space-y-1">
                  <div className="text-2xl text-center">
                    {PLATFORM_ICONS[task.platform] || '📱'}
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 text-center truncate">
                    {task.group_name}
                  </div>
                  <div className="text-center">
                    <span className="text-xs">
                      {task.language === 'he' ? '🇮🇱' : '🇺🇸'}
                    </span>
                  </div>
                  {task.status === 'done' && (
                    <div className="text-center text-lg">✅</div>
                  )}
                  {task.status === 'skipped' && (
                    <div className="text-center text-lg">⏭</div>
                  )}
                </div>
              ) : (
                <div className="text-center text-zinc-300 dark:text-zinc-600 text-xs">
                  No task
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected Task Modal */}
      {selectedTask && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="bg-white dark:bg-[#1A1A1A] rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
                Day {selectedTask.day_number} - {selectedTask.group_name}
              </h3>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{PLATFORM_ICONS[selectedTask.platform]}</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {selectedTask.platform.replace('_', ' ')}
                </span>
                <span className="text-xl ml-2">
                  {selectedTask.language === 'he' ? '🇮🇱' : '🇺🇸'}
                </span>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4">
                <pre className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans">
                  {selectedTask.content}
                </pre>
              </div>

              <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                selectedTask.status === 'done'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : selectedTask.status === 'skipped'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400'
              }`}>
                {selectedTask.status}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
