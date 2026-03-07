'use client'

import { useState } from 'react'
import { updateGrowthTask } from '@/app/actions/admin'

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
}

type TodaysTasksProps = {
  tasks: GrowthTask[]
  onTaskUpdate: () => void
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

export function TodaysTasks({ tasks, onTaskUpdate }: TodaysTasksProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [skipNote, setSkipNote] = useState<string>('')
  const [showSkipModal, setShowSkipModal] = useState<string | null>(null)

  const handleCopy = async (content: string, taskId: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(taskId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleMarkDone = async (taskId: string) => {
    setUpdatingId(taskId)
    try {
      const result = await updateGrowthTask({
        taskId,
        status: 'done'
      })

      if (result.success) {
        onTaskUpdate()
      } else {
        console.error('Failed to update task:', result.error)
      }
    } catch (error) {
      console.error('Error updating task:', error)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleSkip = async (taskId: string) => {
    setUpdatingId(taskId)
    try {
      const result = await updateGrowthTask({
        taskId,
        status: 'skipped',
        notes: skipNote || undefined
      })

      if (result.success) {
        onTaskUpdate()
        setShowSkipModal(null)
        setSkipNote('')
      } else {
        console.error('Failed to update task:', result.error)
      }
    } catch (error) {
      console.error('Error updating task:', error)
    } finally {
      setUpdatingId(null)
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-8">
        <div className="text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-1">
            No tasks for today
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Enjoy your day off or check upcoming tasks!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
        Today's Tasks
      </h2>

      {tasks.map((task) => (
        <div
          key={task.id}
          className={`bg-white dark:bg-[#1A1A1A] border-2 rounded-lg p-6 ${
            task.status === 'done'
              ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/10'
              : task.status === 'skipped'
              ? 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10'
              : 'border-[#3D7A5F] dark:border-[#4E9A78]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{PLATFORM_ICONS[task.platform]}</span>
              <div>
                <h3 className="font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
                  {task.group_name}
                </h3>
                <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <span>{task.platform.replace('_', ' ')}</span>
                  <span>•</span>
                  <span>{task.language === 'he' ? '🇮🇱 Hebrew' : '🇺🇸 English'}</span>
                  <span>•</span>
                  <span>Day {task.day_number}</span>
                </div>
              </div>
            </div>

            {task.status !== 'pending' && (
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                task.status === 'done'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              }`}>
                {task.status === 'done' ? '✅ Done' : '⏭ Skipped'}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="relative mb-4">
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 pr-12">
              <pre className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans">
                {task.content}
              </pre>
            </div>
            <button
              onClick={() => handleCopy(task.content, task.id)}
              className="absolute top-3 right-3 px-3 py-1.5 bg-[#3D7A5F] dark:bg-[#4E9A78] text-white rounded-lg hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] transition-colors text-xs font-medium"
            >
              {copiedId === task.id ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>

          {/* Actions */}
          {task.status === 'pending' && (
            <div className="flex gap-3">
              <button
                onClick={() => handleMarkDone(task.id)}
                disabled={updatingId === task.id}
                className="px-6 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingId === task.id ? 'Updating...' : '✅ Mark Done'}
              </button>
              <button
                onClick={() => setShowSkipModal(task.id)}
                disabled={updatingId === task.id}
                className="px-6 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⏭ Skip
              </button>
            </div>
          )}

          {/* Skip Note Display */}
          {task.status === 'skipped' && task.notes && (
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
                Skip Reason:
              </div>
              <div className="text-sm text-amber-700 dark:text-amber-400">
                {task.notes}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Skip Modal */}
      {showSkipModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSkipModal(null)}
        >
          <div
            className="bg-white dark:bg-[#1A1A1A] rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Skip Task
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Optional: Add a note explaining why you're skipping this task
            </p>
            <textarea
              value={skipNote}
              onChange={(e) => setSkipNote(e.target.value)}
              placeholder="e.g., Group not active, posted yesterday, etc."
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm mb-4 min-h-[80px]"
            />
            <div className="flex gap-3">
              <button
                onClick={() => handleSkip(showSkipModal)}
                disabled={updatingId === showSkipModal}
                className="px-6 py-2 bg-amber-600 dark:bg-amber-700 text-white rounded-lg hover:bg-amber-700 dark:hover:bg-amber-800 transition-colors font-medium disabled:opacity-50"
              >
                {updatingId === showSkipModal ? 'Skipping...' : 'Skip Task'}
              </button>
              <button
                onClick={() => {
                  setShowSkipModal(null)
                  setSkipNote('')
                }}
                className="px-6 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
