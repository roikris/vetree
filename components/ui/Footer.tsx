'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ReportModal } from './ReportModal'

export function Footer() {
  const [showReportModal, setShowReportModal] = useState(false)

  return (
    <>
      <footer className="mt-auto py-6 px-8 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
          <button
            onClick={() => setShowReportModal(true)}
            className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-[#3D7A5F] dark:hover:text-[#4E9A78] transition-colors"
          >
            Report a Bug
          </button>
          <span className="hidden sm:inline text-zinc-300 dark:text-zinc-700">•</span>
          <Link
            href="/privacy"
            className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-[#3D7A5F] dark:hover:text-[#4E9A78] transition-colors"
          >
            Privacy Policy
          </Link>
          <span className="hidden sm:inline text-zinc-300 dark:text-zinc-700">•</span>
          <Link
            href="/terms"
            className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-[#3D7A5F] dark:hover:text-[#4E9A78] transition-colors"
          >
            Terms of Service
          </Link>
        </div>
        <div className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-4">
          © {new Date().getFullYear()} Vetree. All rights reserved.
        </div>
      </footer>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        type="bug"
      />
    </>
  )
}
