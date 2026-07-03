import { getEvidenceLevel, getEvidenceBadgeProps } from '@/lib/utils/evidenceBadge'

type EvidenceBadgeProps = {
  strengthOfEvidence?: string | null
  labels?: string[] | null
  size?: 'sm' | 'md'
}

export function EvidenceBadge({ strengthOfEvidence, labels }: EvidenceBadgeProps) {
  const level = getEvidenceLevel(strengthOfEvidence, labels)
  const { label, hue, dot, tooltip } = getEvidenceBadgeProps(level)

  return (
    <span
      className="al-ev-chip"
      style={{ '--ev-h': hue, '--ev-dot': dot } as React.CSSProperties}
      title={tooltip}
    >
      <span className="al-ev-dot" />
      {label}
    </span>
  )
}
