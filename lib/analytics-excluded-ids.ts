// Shared list of user IDs to exclude from all analytics queries.
// Admin is always excluded. Set TEST_USER_ID env var to also exclude the smoke-test account.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateUuid(id: string | undefined, envVar: string): string | null {
  if (!id) return null
  const trimmed = id.trim()
  if (!trimmed) return null
  if (!UUID_RE.test(trimmed)) {
    throw new Error(
      `[analytics] ${envVar}="${trimmed}" is not a valid UUID. ` +
      `Set it to a proper UUID or clear the env var to disable test-user exclusion.`
    )
  }
  return trimmed
}

export const EXCLUDED_USER_IDS: string[] = [
  '90cb8294-b593-4144-a9f5-23ca52dd5e35',
  validateUuid(process.env.TEST_USER_ID, 'TEST_USER_ID'),
].filter((id): id is string => id !== null)

/**
 * Returns a Supabase .or() filter string that keeps NULL rows but excludes
 * all EXCLUDED_USER_IDS. Safe for both nullable and non-nullable user_id columns.
 *
 * 1 ID:  user_id.is.null,user_id.neq.A
 * 2+ ID: user_id.is.null,and(user_id.neq.A,user_id.neq.B)
 *
 * The 2+-ID form uses a nested AND so that a row with user_id=A isn't included
 * just because it satisfies user_id.neq.B (flat OR would match everything).
 *
 * Usage: .or(excludedUsersOrFilter())
 */
export function excludedUsersOrFilter(): string {
  const neqParts = EXCLUDED_USER_IDS.map(id => `user_id.neq.${id}`)
  const exclusionPart =
    neqParts.length === 1 ? neqParts[0] : `and(${neqParts.join(',')})`
  return `user_id.is.null,${exclusionPart}`
}
