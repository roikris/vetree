'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportModal } from '@/components/ui/ReportModal'
import { useRouter } from 'next/navigation'

type ReportButtonProps = {
  articleId: string
}

export function ReportButton({ articleId }: ReportButtonProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)

  const handleClick = () => {
    if (!user) {
      router.push('/login')
      return
    }
    setShowModal(true)
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg transition-colors"
        title="Report issue"
        aria-label="Report issue with this article"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>
        </svg>
      </button>

      <ReportModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        articleId={articleId}
        type="article_issue"
      />
    </>
  )
}
