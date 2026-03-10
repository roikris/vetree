export type EvidenceLevel = 'gold' | 'silver' | 'bronze' | 'unknown'

export function getEvidenceLevel(strengthOfEvidence?: string | null, labels?: string[] | null): EvidenceLevel {
  // Combine strength of evidence field and labels for analysis
  const text = [
    strengthOfEvidence || '',
    ...(labels || [])
  ].join(' ').toLowerCase()

  // Gold: Highest quality evidence
  if (
    text.includes('randomized') ||
    text.includes('rct') ||
    text.includes('systematic review') ||
    text.includes('meta-analysis') ||
    text.includes('double-blind') ||
    text.includes('placebo-controlled')
  ) {
    return 'gold'
  }

  // Silver: Good quality observational studies
  if (
    text.includes('cohort') ||
    text.includes('case-control') ||
    text.includes('prospective') ||
    text.includes('longitudinal')
  ) {
    return 'silver'
  }

  // Bronze: Lower quality but still valuable
  if (
    text.includes('case report') ||
    text.includes('case series') ||
    text.includes('retrospective') ||
    text.includes('observational') ||
    text.includes('survey') ||
    text.includes('cross-sectional')
  ) {
    return 'bronze'
  }

  return 'unknown'
}

export function getEvidenceBadgeProps(level: EvidenceLevel) {
  const map = {
    gold: {
      label: 'RCT / Meta-Analysis',
      color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      dotColor: 'bg-emerald-500',
      tooltip: 'Highest level of evidence - randomized controlled trials or systematic reviews'
    },
    silver: {
      label: 'Cohort / Prospective',
      color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      dotColor: 'bg-blue-500',
      tooltip: 'Good quality evidence - cohort or case-control studies'
    },
    bronze: {
      label: 'Case Report / Retrospective',
      color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      dotColor: 'bg-amber-500',
      tooltip: 'Lower level evidence - case reports or retrospective studies'
    },
    unknown: {
      label: 'Study',
      color: 'bg-zinc-50 dark:bg-zinc-900/20 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800',
      dotColor: 'bg-zinc-400',
      tooltip: 'Study type not categorized'
    },
  }
  return map[level]
}
