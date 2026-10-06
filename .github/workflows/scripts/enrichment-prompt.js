// The enrichment prompt and result validation — ONE copy, shared by the daily job
// (.github/workflows/scripts/enrich-articles.js, Claude) and the refusal fallback that Roi runs on
// his Mac (scripts/enrich-refused.mjs, Codex on his ChatGPT plan; CLAUDE.md rule 0 exception).
// Keeping both on this file guarantees the fallback gets exactly the prompt Claude gets.

const PROMPT_VERSION = 'v2-context-framing';

// Hidden because Claude refused it (stop_reason 'refusal'); waiting for the Codex fallback.
const AI_REFUSED = 'ai_refused';

const ALLOWED_LABELS = [
  'Cardiology', 'Oncology', 'Soft Tissue Surgery', 'Orthopedics', 'Dermatology',
  'Neurology', 'Internal Medicine', 'Small Animal', 'Large Animal', 'Equine',
  'Exotic', 'Emergency', 'Anesthesia', 'Radiology', 'Pathology', 'Pharmacology',
  'Nutrition', 'Behavior', 'Reproduction', 'Ophthalmology', 'Dentistry'
];

const SYSTEM = `You are a veterinary medicine expert supporting Vetree, an evidence-based clinical reference platform for licensed veterinary professionals. Your task is to summarize a single article that is already published and publicly indexed on PubMed — peer-reviewed veterinary and biomedical literature. You are not generating new research, protocols, or technical instructions; you are only extracting and restating what the published abstract already states, for clinical-reference use by practicing veterinarians.`;

function buildPrompt(article) {
  return `Analyze the following already-published, peer-reviewed article and extract the requested information for a clinical reference summary.

Title: ${article.title}
Authors: ${article.authors}
Journal: ${article.source_journal}
Abstract: ${article.abstract}

Return a JSON object with exactly these 5 fields:
1. summary: A comprehensive 150-250 word summary for veterinary professionals
2. clinical_bottom_line: One sentence (max 20 words) highlighting the key clinical takeaway
3. labels: Array of 3-5 strings ONLY from this list: Cardiology, Oncology, Soft Tissue Surgery, Orthopedics, Dermatology, Neurology, Internal Medicine, Small Animal, Large Animal, Equine, Exotic, Emergency, Anesthesia, Radiology, Pathology, Pharmacology, Nutrition, Behavior, Reproduction, Ophthalmology, Dentistry
4. strength_of_evidence: One of: Gold Standard/RCT, Systematic Review/Meta-Analysis, Cohort Study, Case-Control Study, Observational, Case Series, Case Report, Expert Opinion
5. authors: corrected authors string if duplicates detected, otherwise null

Return ONLY valid JSON, no markdown formatting.`;
}

function filterLabels(labels) {
  if (!Array.isArray(labels)) return [];
  return labels.filter(label => ALLOWED_LABELS.includes(label));
}

// Same rules for every model: BOTH summary and clinical_bottom_line, and at least one allowed label.
function validateEnrichment(enrichment) {
  const validLabels = filterLabels(enrichment && enrichment.labels);
  const text = v => typeof v === 'string' && v.trim().length > 0;  // a real, non-empty string — nothing else
  const hasSummary = !!enrichment && text(enrichment.summary);
  const hasClinicalBottomLine = !!enrichment && text(enrichment.clinical_bottom_line);
  const missing = [];
  if (!hasSummary) missing.push('summary');
  if (!hasClinicalBottomLine) missing.push('clinical_bottom_line');
  if (validLabels.length === 0) missing.push('labels');
  return { validLabels, isComplete: missing.length === 0, missing };
}

module.exports = { PROMPT_VERSION, AI_REFUSED, ALLOWED_LABELS, SYSTEM, buildPrompt, filterLabels, validateEnrichment };
