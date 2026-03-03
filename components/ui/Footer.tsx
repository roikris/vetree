'use client'

import { useState } from 'react'
import { ReportModal } from './ReportModal'

export function Footer() {
  const [showReportModal, setShowReportModal] = useState(false)

  return (
    <>
      <footer className="mt-auto py-6 px-8 border-t border-zinc-200 dark:border-zinc-800 text-center">
        <button
          onClick={() => setShowReportModal(true)}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-[#3D7A5F] dark:hover:text-[#4E9A78] transition-colors"
        >
          Report a Bug
        </button>
      </footer>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        type="bug"
      />
    </>
  )
}
