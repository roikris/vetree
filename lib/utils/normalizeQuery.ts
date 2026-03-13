/**
 * Normalizes veterinary search queries for caching and synonym matching.
 * Expands common acronyms, fixes misspellings, and removes stopwords.
 */
export function normalizeQuery(query: string): string {
  // Common veterinary misspellings → correct spelling
  const misspellings: Record<string, string> = {
    'astma': 'asthma',
    'diabetis': 'diabetes',
    'lyphoma': 'lymphoma',
    'lymphona': 'lymphoma',
    'pancreatits': 'pancreatitis',
    'stomatits': 'stomatitis',
    'pyelonephirtis': 'pyelonephritis',
    'hypothyroidsm': 'hypothyroidism',
    'hyperthyroidsm': 'hyperthyroidism',
    'leishmaniasis': 'leishmaniasis',
    'leishmania': 'leishmania',
    'pyometria': 'pyometra',
    'cushings': 'cushing',
    'addisons': 'addison',
    'parvo': 'parvovirus',
    'distemper': 'distemper',
    'leptospirosis': 'leptospirosis',
    'ehrlichia': 'ehrlichiosis',
    'anaplasmosis': 'anaplasmosis',
  }

  // Veterinary acronym → full term mappings
  const synonyms: Record<string, string> = {
    'teca': 'total ear canal ablation',
    'crcl': 'cranial cruciate ligament',
    'tplo': 'tibial plateau leveling osteotomy',
    'ivdd': 'intervertebral disc disease',
    'imha': 'immune mediated hemolytic anemia',
    'feline': 'cat',
    'canine': 'dog',
    'fip': 'feline infectious peritonitis',
    'hcm': 'hypertrophic cardiomyopathy',
    'ckd': 'chronic kidney disease',
    'dm': 'diabetes mellitus',
    'gi': 'gastrointestinal',
    'pyometra': 'pyometra',
    'foreign body': 'foreign body',
    'acl': 'anterior cruciate ligament',
    'ccl': 'cranial cruciate ligament',
  }

  let normalized = query.toLowerCase().trim()

  // Fix common misspellings FIRST (before synonym expansion)
  Object.entries(misspellings).forEach(([wrong, correct]) => {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi')
    normalized = normalized.replace(regex, correct)
  })

  // Replace acronyms with full terms (word boundaries to avoid partial matches)
  Object.entries(synonyms).forEach(([abbr, full]) => {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi')
    normalized = normalized.replace(regex, full)
  })

  // Remove common stopwords
  const stopwords = [
    'the', 'a', 'an', 'of', 'in', 'for', 'to', 'with', 'and', 'or',
    'is', 'are', 'was', 'were', 'at', 'by', 'on'
  ]

  normalized = normalized
    .split(' ')
    .filter(word => !stopwords.includes(word))
    .join(' ')
    .trim()

  return normalized
}

/**
 * Extracts likely labels from a query for label-based article search.
 * Returns common veterinary labels that might match the query.
 */
export function extractKeyLabels(query: string): string[] {
  const q = query.toLowerCase()
  const labels: string[] = []

  // Species detection
  if (q.includes('dog') || q.includes('canine')) labels.push('Canine')
  if (q.includes('cat') || q.includes('feline')) labels.push('Feline')

  // Common specialty areas
  if (q.includes('surgery') || q.includes('surgical')) labels.push('Surgery')
  if (q.includes('cardio') || q.includes('heart')) labels.push('Cardiology')
  if (q.includes('dermat') || q.includes('skin')) labels.push('Dermatology')
  if (q.includes('onco') || q.includes('cancer') || q.includes('tumor')) labels.push('Oncology')
  if (q.includes('nephro') || q.includes('kidney') || q.includes('renal')) labels.push('Nephrology')
  if (q.includes('gastro') || q.includes('gi ') || q.includes('intestin')) labels.push('Gastroenterology')
  if (q.includes('neuro') || q.includes('brain') || q.includes('seizure')) labels.push('Neurology')
  if (q.includes('ortho') || q.includes('bone') || q.includes('joint')) labels.push('Orthopedics')
  if (q.includes('anesthesia') || q.includes('anesthesi')) labels.push('Anesthesiology')
  if (q.includes('pain')) labels.push('Pain Management')
  if (q.includes('emergency') || q.includes('critical')) labels.push('Emergency Medicine')

  return labels
}
