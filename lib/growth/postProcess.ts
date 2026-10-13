// The model's reply → the post generate-post returns (app/api/growth/generate-post/route.ts), for a new post and a
// rewrite alike. Kept free of Next.js and the Anthropic SDK so it can be tested offline
// (tests/unit/postProcess.test.ts). The twitter shortening (a second model call) stays in the route.
import { makeLinkFree } from './linkFree'

export type ProcessedPost = { ok: true; post: string } | { ok: false; reason: 'large_animal' }

/** facebook_il carries no web link (social-001 / 002); every other platform keeps its links. */
export const isLinkFreePlatform = (platform: string) => platform === 'facebook_il'

export function processModelPost(platform: string, reply: string): ProcessedPost {
  // The model refused the article as large-animal — an error, never post content
  if (reply.includes('SKIP_LARGE_ANIMAL')) return { ok: false, reason: 'large_animal' }
  // Facebook IL: link-free whatever the model wrote — a stray link would spend one of the Page's two monthly links
  return { ok: true, post: isLinkFreePlatform(platform) ? makeLinkFree(reply) : reply }
}

/** The hook line stored with the post for LinkedIn slug matching: its first line. */
export const hookLineOf = (post: string) => post.split('\n')[0].trim()
