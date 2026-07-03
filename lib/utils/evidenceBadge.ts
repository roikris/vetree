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
      label: 'RCT / Meta-analysis',
      hue: '#A9E07C',
      dot: '#8FD65E',
      tooltip: 'Highest level of evidence — randomized controlled trials or systematic reviews',
    },
    silver: {
      label: 'Cohort / Prospective',
      hue: '#8FBEEC',
      dot: '#6FA8E8',
      tooltip: 'Good quality evidence — cohort or case-control studies',
    },
    bronze: {
      label: 'Case series / Retrospective',
      hue: '#E8B060',
      dot: '#E0A040',
      tooltip: 'Lower level evidence — case reports or retrospective studies',
    },
    unknown: {
      label: 'Study',
      hue: '#B4AD9A',
      dot: '#9A9280',
      tooltip: 'Study type not categorized',
    },
  }
  return map[level]
}
