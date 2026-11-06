/**
 * The only Claude model Vetree uses, for every AI call (CLAUDE.md rule 0). Change it here; scripts
 * that can't import TypeScript (scripts/*.mjs, .github/workflows/scripts/*.js) repeat the same ID.
 */
// Sonnet 5.5 since 2026-11-06 (Roi, ai-001: switch without re-measuring). History: 5.5 ran 2026-09-30 → 10-01 and was
// reverted to 4.6 for ~1.46x the tokens on identical production prompts (mostly its tokenizer).
// Switching back is this one line plus the scripts that repeat the ID.
export const CLAUDE_MODEL: string = 'claude-sonnet-5-5'

/**
 * Sonnet 5.x may think before answering unless told otherwise, and thinking counts against
 * max_tokens; no Vetree call uses tools, so 'between_tools' means no upfront thinking. Sonnet 5.5
 * also writes longer answers than 4.6: budgets were raised 2–3x on 2026-10-01 after syntheses were
 * cut off at 1,500 tokens. Sonnet 4.6 REJECTS this parameter (400), so it is only sent to 5.x models.
 * (Typed loosely: the installed SDK's types predate this parameter.)
 */
export const NO_UPFRONT_THINKING = (CLAUDE_MODEL.startsWith('claude-sonnet-5')
  ? { thinking: { type: 'between_tools' } }
  : {}) as unknown as Record<string, never>

/**
 * The reply's text — only 'text' blocks, never content[0] (a reply may start with a thinking block).
 * Throws if the reply was cut off at max_tokens, so a truncated answer is never parsed or saved.
 */
export function responseText(res: { content: ReadonlyArray<{ type: string; text?: string }>; stop_reason?: string | null }): string {
  if (res.stop_reason === 'max_tokens') throw new Error('Claude reply was cut off at max_tokens')
  return res.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('')
}
