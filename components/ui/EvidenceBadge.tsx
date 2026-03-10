'use client'

import { getEvidenceLevel, getEvidenceBadgeProps } from '@/lib/utils/evidenceBadge'

type EvidenceBadgeProps = {
  strengthOfEvidence?: string | null
  labels?: string[] | null
  size?: 'sm' | 'md'
}

export function EvidenceBadge({ strengthOfEvidence, labels, size = 'sm' }: EvidenceBadgeProps) {
  const level = getEvidenceLevel(strengthOfEvidence, labels)
  const { label, color, dotColor, tooltip } = getEvidenceBadgeProps(level)

  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-1 text-xs gap-1.5'
    : 'px-3 py-1.5 text-sm gap-2'

  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'

  return (
    <span
      className={`inline-flex items-center ${sizeClasses} font-medium rounded-full border ${color}`}
      title={tooltip}
    >
      <span className={`${dotSize} rounded-full ${dotColor}`} />
      {label}
    </span>
  )
}
