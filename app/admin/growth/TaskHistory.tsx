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
  notes: string | null
  completed_at: string | null
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

export function TaskHistory() {
  const [tasks, setTasks] = useState<GrowthTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'done' | 'skipped'>('all')
  const [selectedTask, setSelectedTask] = useState<GrowthTask | null>(null)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setIsLoading(true)
    try {
      const { tasks: doneTasks } = await getGrowthTasks({ status: 'done' })
      const { tasks: skippedTasks } = await getGrowthTasks({ status: 'skipped' })

      const allTasks = [...doneTasks, ...skippedTasks].sort((a, b) => {
        const dateA = new Date(a.completed_at || a.scheduled_date).getTime()
        const dateB = new Date(b.completed_at || b.scheduled_date).getTime()
        return dateB - dateA
      })

      setTasks(allTasks)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true
    return task.status === filter
  })

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          Task History
        </h2>
        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-[#3D7A5F] dark:bg-[#4E9A78] text-white'
              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'
          }`}
        >
          All ({tasks.length})
        </button>
        <button
          onClick={() => setFilter('done')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'done'
              ? 'bg-green-600 dark:bg-green-700 text-white'
              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'
          }`}
        >
          ✅ Done ({tasks.filter(t => t.status === 'done').length})
        </button>
        <button
          onClick={() => setFilter('skipped')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'skipped'
              ? 'bg-amber-600 dark:bg-amber-700 text-white'
              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'
          }`}
        >
          ⏭ Skipped ({tasks.filter(t => t.status === 'skipped').length})
        </button>
      </div>

      {/* Task List */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
            No {filter !== 'all' ? filter : ''} tasks in history
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredTasks.map((task) => {
              const completedDate = task.completed_at
                ? new Date(task.completed_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                : 'N/A'

              return (
                <div
                  key={task.id}
                  className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">{PLATFORM_ICONS[task.platform]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-medium text-[#1A1A1A] dark:text-[#E8E8E8] truncate">
                          {task.group_name}
                        </div>
                        <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          task.status === 'done'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        }`}>
                          {task.status === 'done' ? '✅' : '⏭'}
                        </div>
                      </div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        Day {task.day_number} • {task.platform.replace('_', ' ')} • {task.language === 'he' ? '🇮🇱' : '🇺🇸'}
                      </div>
                      {task.notes && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 italic">
                          Note: {task.notes}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-sm text-zinc-500 dark:text-zinc-400">
                      {completedDate}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
                <div className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${
                  selectedTask.status === 'done'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }`}>
                  {selectedTask.status === 'done' ? '✅ Done' : '⏭ Skipped'}
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4">
                <pre className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans">
                  {selectedTask.content}
                </pre>
              </div>

              {selectedTask.notes && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
                    Note:
                  </div>
                  <div className="text-sm text-amber-700 dark:text-amber-400">
                    {selectedTask.notes}
                  </div>
                </div>
              )}

              {selectedTask.completed_at && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Completed: {new Date(selectedTask.completed_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
