import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getConfig } from '@/lib/config'

// Connection pool for admin operations
let adminClientPool: ReturnType<typeof createSupabaseClient> | null = null
let pooledReadOnlyClient: ReturnType<typeof createSupabaseClient> | null = null

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Pooled admin client with service role key for admin operations
export function createAdminClient() {
  if (adminClientPool) return adminClientPool

  const config = getConfig()
  adminClientPool = createSupabaseClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
  
  return adminClientPool
}

// Pooled read-only client for optimized queries
export function createReadOnlyClient() {
  if (pooledReadOnlyClient) return pooledReadOnlyClient

  const config = getConfig()
  pooledReadOnlyClient = createSupabaseClient(
    config.supabase.url,
    config.supabase.anonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
  
  return pooledReadOnlyClient
}
