/**
 * Known automated-crawler / link-preview-bot user-agent signatures.
 * Order matters — specific patterns are checked before the generic fallback,
 * so e.g. "AdsBot-Google" and "Googlebot" get their own label instead of
 * both collapsing into "other-bot".
 */
const BOT_PATTERNS: [RegExp, string][] = [
  [/meta-externalagent/i, 'meta-externalagent'],
  [/facebookexternalhit/i, 'facebookexternalhit'],
  [/AdsBot-Google/i, 'adsbot-google'],
  [/Googlebot/i, 'googlebot'],
  [/bingbot/i, 'bingbot'],
  [/GPTBot|ChatGPT-User|OAI-SearchBot/i, 'gptbot'],
  [/ClaudeBot|anthropic-ai/i, 'claudebot'],
  [/PerplexityBot|Perplexity-User/i, 'perplexitybot'],
  [/bot|crawler|spider/i, 'other-bot'],
]

/** Returns a canonical bot name for a known crawler UA, or null for a normal browser. */
export function detectBotName(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null
  for (const [pattern, name] of BOT_PATTERNS) {
    if (pattern.test(userAgent)) return name
  }
  return null
}
