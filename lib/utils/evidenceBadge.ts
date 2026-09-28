export type EvidenceLevel = 'gold' | 'silver' | 'bronze' | 'unknown'

export function getEvidenceLevel(strengthOfEvidence?: string | null, labels?: string[] | null): EvidenceLevel {
  // Combine strength of evidence field and labels for analysis
  const text = [
    strengthOfEvidence || '',
    ...(labels || [])
  ].join(' ').toLowerCase()

  // A non-randomised design is NEVER gold, whatever else the text says ("non-randomized
  // placebo-controlled trial"); "non-randomized" also contains "randomi", so it is removed
  // before any other check.
  const isNonRandomised = /non[- ]?randomi[sz]ed/.test(text)
  const t = isNonRandomised ? text.replace(/non[- ]?randomi[sz]ed/g, '') : text

  // Gold: Highest quality evidence (both spellings: randomized / randomised)
  if (
    !isNonRandomised && (
      /randomi[sz]ed/.test(t) ||
      /\brct\b/.test(t) ||
      t.includes('systematic review') ||
      t.includes('meta-analysis') ||
      t.includes('double-blind') ||
      t.includes('placebo-controlled')
    )
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

/**
 * The badge TEXT is the study design itself, normalised from strength_of_evidence (which the
 * enrichment model writes as free text — ~35 variants in production). Before 2026-09-28 the
 * text was the tier's generic label, so every "Observational" study (37% of articles, many
 * prospective) was shown as "Case series / Retrospective", and "Expert Opinion" as "Study".
 * The tier (colour) is unchanged: getEvidenceLevel.
 */
export function studyDesignLabel(strengthOfEvidence?: string | null): string | null {
  const raw = (strengthOfEvidence || '').trim()
  const s = raw.toLowerCase()
  if (!s || s === 'none' || s === 'corrigendum') return null
  // Negations first — "non-randomized" contains "randomi"
  if (/non[- ]?randomi[sz]ed/.test(s)) return s.includes('trial') ? 'Non-randomised controlled trial' : 'Non-randomised study'
  if (s.includes('meta-analysis') || s.includes('meta analysis')) return 'Systematic review / meta-analysis'
  if (s.includes('systematic review')) return 'Systematic review'
  // Only explicit randomisation or "RCT" ("Gold Standard/RCT" matches via RCT; a bare "gold standard" may be a diagnostic reference)
  if (s.includes('randomi') || /\brct\b/.test(s)) return 'Randomised controlled trial'
  if (s.includes('case-control') || s.includes('case control')) return 'Case-control study'
  if (s.includes('cohort')) {
    if (s.includes('prospective')) return 'Prospective cohort study'
    if (s.includes('retrospective')) return 'Retrospective cohort study'
    return 'Cohort study'
  }
  if (s.includes('case series')) return 'Case series'
  if (s.includes('case report')) return 'Case report'
  if (s.includes('narrative review')) return 'Narrative review'
  if (s.includes('expert opinion')) return 'Expert opinion'
  if (s.includes('qualitative')) return 'Qualitative study'
  if (s.includes('observational')) return s.includes('prospective') ? 'Prospective observational study' : 'Observational study'
  if (s.includes('cadaver')) return 'Cadaveric study'
  if (s.includes('pilot') || s.includes('feasibility') || s.includes('proof of concept')) return 'Pilot study'
  if (s.includes('experimental') || s.includes('interventional')) return 'Experimental study'
  // Anything else: the model's own wording, sentence-cased
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

const TIER_NOTE = 'Colour = evidence tier typical of this study design (not an appraisal of this paper).'

/** Badge for an article: tier colour + accurate study-design text. */
export function getEvidenceBadge(strengthOfEvidence?: string | null, labels?: string[] | null) {
  const level = getEvidenceLevel(strengthOfEvidence, labels)
  const tier = getEvidenceBadgeProps(level)
  const design = studyDesignLabel(strengthOfEvidence)
  const tierName = level === 'gold' ? 'Gold tier' : level === 'silver' ? 'Silver tier' : level === 'bronze' ? 'Bronze tier' : 'Not tiered'
  return {
    level,
    // No recorded design: say so, rather than a tier's generic wording that may not fit
    label: design ?? 'Study design not recorded',
    hue: tier.hue,
    dot: tier.dot,
    tooltip: `${design ?? 'Study design not recorded'} · ${tierName}. ${TIER_NOTE}`,
  }
}
