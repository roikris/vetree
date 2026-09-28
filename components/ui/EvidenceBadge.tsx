import { getEvidenceBadge } from '@/lib/utils/evidenceBadge'

type EvidenceBadgeProps = {
  strengthOfEvidence?: string | null
  labels?: string[] | null
  size?: 'sm' | 'md'
}

export function EvidenceBadge({ strengthOfEvidence, labels }: EvidenceBadgeProps) {
  const { label, hue, dot, tooltip } = getEvidenceBadge(strengthOfEvidence, labels)

  return (
    <span
      className="al-ev-chip"
      style={{ '--ev-h': hue, '--ev-dot': dot } as React.CSSProperties}
      title={tooltip}
    >
      <span className="al-ev-dot" />
      {label}
      {/* The tier explanation for screen readers (the title tooltip is mouse-only) */}
      <span className="sr-only"> — {tooltip}</span>
    </span>
  )
}
