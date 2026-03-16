import { createBrowserClient } from '@supabase/ssr'
import { getConfig } from '@/lib/config'

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (supabaseClient) return supabaseClient
  
  const config = getConfig()
  
  supabaseClient = createBrowserClient(
    config.supabase.url,
    config.supabase.anonKey
  )
  
  return supabaseClient
}
