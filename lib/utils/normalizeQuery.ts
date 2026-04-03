/**
 * Normalizes veterinary search queries for caching and synonym matching.
 * Expands common acronyms, fixes misspellings, and removes stopwords.
 */
export function normalizeQuery(query: string): string {
  // Common veterinary misspellings → correct spelling
  const misspellings: Record<string, string> = {
    'astma': 'asthma',
    'pnumonia': 'pneumonia',
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
    // General / existing
    'teca': 'total ear canal ablation',
    'crcl': 'cranial cruciate ligament',
    'tplo': 'tibial plateau leveling osteotomy',
    'imha': 'immune mediated hemolytic anemia',
    'feline': 'cat',
    'canine': 'dog',
    'fip': 'feline infectious peritonitis',
    'dm': 'diabetes mellitus',
    'gi': 'gastrointestinal',
    'pyometra': 'pyometra',
    'foreign body': 'foreign body',
    'acl': 'anterior cruciate ligament',
    'ccl': 'cranial cruciate ligament',

    // Pharmacology
    'nsaid': 'non-steroidal anti-inflammatory',
    'nsaids': 'non-steroidal anti-inflammatory',
    'ppi': 'proton pump inhibitor',
    'ppis': 'proton pump inhibitor',
    'ace': 'angiotensin converting enzyme',
    'ab': 'antibiotic',
    'abx': 'antibiotic',

    // Parasiticides
    'fluralaner': 'fluralaner ectoparasiticide isoxazoline',
    'bravecto': 'fluralaner ectoparasiticide',
    'afoxolaner': 'nexgard ectoparasiticide isoxazoline',
    'sarolaner': 'simparica ectoparasiticide isoxazoline',

    // Clinical reasoning
    'ddx': 'differential diagnosis',
    'dd': 'differential diagnosis',
    'dx': 'diagnosis',
    'tx': 'treatment',
    'rx': 'treatment prescription',
    'hx': 'history',
    'px': 'prognosis',
    'sx': 'surgery surgical',
    'pe': 'physical examination',

    // Cardiology
    'cardio': 'cardiology cardiac heart',
    'chf': 'congestive heart failure',
    'dcm': 'dilated cardiomyopathy',
    'hcm': 'hypertrophic cardiomyopathy',
    'mvd': 'mitral valve disease',
    'avb': 'atrioventricular block',

    // Oncology
    'onco': 'oncology cancer tumor',
    'mct': 'mast cell tumor',
    'osc': 'osteosarcoma',
    'lsa': 'lymphoma lymphosarcoma',

    // Orthopedics
    'oa': 'osteoarthritis degenerative joint disease',
    'cclr': 'cranial cruciate ligament rupture',
    'fhne': 'femoral head neck excision',

    // Neurology
    'ivdd': 'intervertebral disc disease',
    'gme': 'granulomatous meningoencephalitis',
    'cva': 'cerebrovascular accident stroke',

    // Emergency / Internal medicine
    'gdv': 'gastric dilatation volvulus bloat',
    'gvd': 'gastric dilatation volvulus bloat',
    'hge': 'hemorrhagic gastroenteritis',
    'arf': 'acute renal failure kidney',
    'ckd': 'chronic kidney disease renal',
    'dka': 'diabetic ketoacidosis',

    // Species abbreviations
    'k9': 'canine dog',
    'fel': 'feline cat',
    'eq': 'equine horse',

    // Integrative / CAM — multi-word phrases first (processed before single-word keys)
    'integrative veterinary': 'holistic alternative complementary',
    'alternative medicine': 'integrative holistic complementary',
    'pain management': 'analgesia analgesic nsaid opioid',
    'integrative': 'holistic alternative complementary acupuncture',
    'holistic': 'integrative alternative complementary',
    'complementary': 'integrative holistic alternative',
    'analgesic': 'pain management nsaid analgesia',
    'anti-inflammatory': 'nsaid pain management inflammation',
    'oncology': 'cancer tumor neoplasia lymphoma',
    'quantum': '',
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
