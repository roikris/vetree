/**
 * The only Claude model Vetree uses, for every AI call (CLAUDE.md rule 0). Change it here; scripts
 * that can't import TypeScript (scripts/*.mjs, .github/workflows/scripts/*.js) repeat the same ID.
 */
export const CLAUDE_MODEL = 'claude-sonnet-5-5'

/**
 * Sonnet 5.5 may think before answering unless told otherwise, and thinking counts against
 * max_tokens. No Vetree call uses tools, so 'between_tools' means no upfront thinking. Sonnet 5.5
 * also writes longer answers than 4.6: budgets were raised 2–3x on 2026-10-01 after syntheses were
 * cut off at 1,500 tokens. (Typed loosely: the installed SDK's types predate this parameter.)
 */
export const NO_UPFRONT_THINKING = { thinking: { type: 'between_tools' } } as unknown as Record<string, never>

/**
 * The reply's text — only 'text' blocks, never content[0] (a reply may start with a thinking block).
 * Throws if the reply was cut off at max_tokens, so a truncated answer is never parsed or saved.
 */
export function responseText(res: { content: ReadonlyArray<{ type: string; text?: string }>; stop_reason?: string | null }): string {
  if (res.stop_reason === 'max_tokens') throw new Error('Claude reply was cut off at max_tokens')
  return res.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('')
}
