// December trial prompts (growth-005). Only LinkedIn and WhatsApp's 'short' variant get new prompts; Facebook IL /
// Intl and WhatsApp 'current' use generate-post's existing prompts unchanged. Pure strings, tested offline
// (tests/unit/trial.test.ts). Why (Growth Review 2026-11-22): LinkedIn breakouts stopped mid-August and the last 29
// posts got 0 comments; posts had become templated summaries ("A dog comes in…") that leave nothing to discuss.
// WhatsApp brings most signups; its readers arrive for practical tools.

import { TAKE_MARKER, type LinkedinVariant } from './trial'

export type TrialArticle = { title: string; clinical_bottom_line: string | null; labels?: string[] | null }

/** The repetition guard: Roi's recent openings on this platform, which the model must not echo. */
export function avoidOpenings(hooks: string[]): string {
  const list = hooks.map(h => h.trim()).filter(Boolean).slice(0, 10)
  if (!list.length) return ''
  return `\n\nRECENT OPENINGS ON THIS PLATFORM (do NOT reuse their opening style, structure or first words — e.g. if they open with a patient vignette, open differently):\n${list.map(h => `- ${h.slice(0, 140)}`).join('\n')}`
}

const OPENING_STYLES = `Pick ONE opening style that differs from the recent openings listed below:
- a surprising number from the study
- a common practice the finding questions
- a direct question to colleagues
- a one-line clinical dilemma (not a "a dog comes in…" vignette)
- a plain statement of what changes in the consult room`

export function linkedinTrialPrompt(a: TrialArticle, opts: { variant: LinkedinVariant; articleUrl: string; recentHooks: string[] }): string {
  const linkRule = opts.variant === 'in_post'
    ? `End with the article line exactly as:\n🔗 ${opts.articleUrl}\nThat is the ONLY link in the post (no save link, no other URL).`
    : 'The post must contain NO link, URL or domain name at all — the link goes in the first comment, which the app writes. Do not mention "link in comments".'
  return `PLATFORM: LinkedIn (December trial format)

Write an English LinkedIn post for small-animal veterinarians in first-opinion practice about this study.

Article: ${a.title}
Clinical Bottom Line: ${a.clinical_bottom_line ?? ''}
Labels: ${a.labels?.join(', ') || 'N/A'}

FORMAT (CRITICAL):
- 800–1,500 characters in total.
- ${OPENING_STYLES}
- Give ONE specific finding with its number. Do NOT summarise the whole study — leave the method and the rest for the article.
- Then one line, on its own, exactly in this form, with your suggestion for the author's own clinical view inside it:
  ${TAKE_MARKER} — edit: <one or two sentences the author might say from their own practice>]
- End the body with ONE specific question to colleagues about their own practice (not "What do you think?" / "Thoughts?").
- Short and long paragraphs alternate; no bullet points; no hashtags; at most one emoji.
- BANNED: "game changer", "groundbreaking", "revolutionary", "exciting", "thrilled", "delighted to share", "proud to announce", "unlock".
- Write like a colleague, not a marketer.
- ${linkRule}

Return ONLY the post text.${avoidOpenings(opts.recentHooks)}`
}

/** The first comment for LinkedIn's 'first_comment' variant (written by the app, not the model). */
export const linkedinFirstComment = (title: string, articleUrl: string) => `📄 ${title}\n🔗 ${articleUrl}`

export function whatsappShortPrompt(a: TrialArticle, opts: { articleUrl: string; recentHooks: string[] }): string {
  return `PLATFORM: WhatsApp (Hebrew veterinary community — December trial, short format)

Write a Hebrew WhatsApp post for Israeli small-animal vets about this study.

Article: ${a.title}
Clinical Bottom Line: ${a.clinical_bottom_line ?? ''}
Labels: ${a.labels?.join(', ') || 'N/A'}

FORMAT (CRITICAL):
- 60–100 words, natural clinical Hebrew (not translated), warm, like a colleague in a group chat.
- Frame it as what changes on your next shift: open with the practical point, then the one number that backs it.
- No hashtags, no bullet points.
- End with the article line exactly as:
📄 ${a.title}
🔗 ${opts.articleUrl}
That is the ONLY link (no save link, no other URL).

Return ONLY the post text.${avoidOpenings(opts.recentHooks)}`
}
