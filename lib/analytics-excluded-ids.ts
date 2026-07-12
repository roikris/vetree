// Shared list of user IDs to exclude from all analytics queries.
// Admin is always excluded. Set TEST_USER_ID env var to also exclude the smoke-test account.
export const EXCLUDED_USER_IDS: string[] = [
  '90cb8294-b593-4144-a9f5-23ca52dd5e35',
  process.env.TEST_USER_ID,
].filter((id): id is string => Boolean(id))

/**
 * Returns a Supabase .or() filter string that keeps NULL rows but excludes
 * all EXCLUDED_USER_IDS. Safe for both nullable and non-nullable user_id columns.
 * Usage: .or(excludedUsersOrFilter())
 */
export function excludedUsersOrFilter(): string {
  return ['user_id.is.null', ...EXCLUDED_USER_IDS.map(id => `user_id.neq.${id}`)].join(',')
}
