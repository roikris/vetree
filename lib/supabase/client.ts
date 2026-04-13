import { createBrowserClient } from '@supabase/ssr'

// Module-level singleton — one Supabase client for the entire browser session.
// Prevents LockManager contention from multiple GoTrue auth instances.
const _supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function createClient() {
  return _supabase
}
