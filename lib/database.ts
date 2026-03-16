import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getConfig } from './config'

// Connection pool for server-side operations
class SupabaseConnectionPool {
  private pool: Map<string, SupabaseClient> = new Map()
  private maxConnections = 10
  private connectionCount = 0

  getConnection(key: string, url: string, anonKey: string, options?: any): SupabaseClient {
    if (this.pool.has(key)) {
      return this.pool.get(key)!
    }

    if (this.connectionCount >= this.maxConnections) {
      // Return the first available connection if pool is full
      return this.pool.values().next().value
    }

    const client = createSupabaseClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      },
      ...options
    })

    this.pool.set(key, client)
    this.connectionCount++
    return client
  }

  clearPool() {
    this.pool.clear()
    this.connectionCount = 0
  }
}

const connectionPool = new SupabaseConnectionPool()

// Enhanced client creation with connection pooling
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
            // Ignore if called from Server Component
          }
        },
      },
    }
  )
}

// Pooled admin client
export function createAdminClient(): SupabaseClient {
  const config = getConfig()
  return connectionPool.getConnection(
    'admin',
    config.supabase.url,
    config.supabase.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Pooled read-only client for queries
export function createReadOnlyClient(): SupabaseClient {
  const config = getConfig()
  return connectionPool.getConnection(
    'readonly',
    config.supabase.url,
    config.supabase.anonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Query result cache
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class QueryCache {
  private cache: Map<string, CacheEntry<any>> = new Map()

  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }
}

export const queryCache = new QueryCache()

// Optimized batch operations
export class BatchOperations {
  private static instance: BatchOperations
  
  static getInstance(): BatchOperations {
    if (!BatchOperations.instance) {
      BatchOperations.instance = new BatchOperations()
    }
    return BatchOperations.instance
  }

  async batchGetArticles(ids: string[], client?: SupabaseClient): Promise<any[]> {
    const cacheKey = `articles:${ids.sort().join(',')}`
    const cached = queryCache.get<any[]>(cacheKey)
    if (cached) return cached

    const supabase = client || createReadOnlyClient()
    
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .in('id', ids)
      .eq('needs_enrichment', false)
      .not('summary', 'is', null)
      .not('clinical_bottom_line', 'is', null)
      .or('quarantined.is.null,quarantined.eq.false')

    if (error) throw error

    queryCache.set(cacheKey, data || [], 300)
    return data || []
  }

  async batchGetSavedArticles(userIds: string[], client?: SupabaseClient): Promise<any[]> {
    if (userIds.length === 0) return []
    
    const cacheKey = `saved_articles:${userIds.sort().join(',')}`
    const cached = queryCache.get<any[]>(cacheKey)
    if (cached) return cached

    const supabase = client || createReadOnlyClient()
    
    const { data, error } = await supabase
      .from('saved_articles')
      .select(`
        user_id,
        article_id,
        saved_at,
        articles!inner (
          id,
          title,
          summary,
          clinical_bottom_line,
          strength_of_evidence,
          labels,
          source_journal,
          article_url,
          doi,
          authors,
          pubmed_id,
          publication_date
        )
      `)
      .in('user_id', userIds)
      .eq('articles.needs_enrichment', false)
      .not('articles.summary', 'is', null)
      .not('articles.clinical_bottom_line', 'is', null)

    if (error) throw error

    queryCache.set(cacheKey, data || [], 180)
    return data || []
  }

  async batchGetFollowedTags(userIds: string[], client?: SupabaseClient): Promise<Map<string, string[]>> {
    if (userIds.length === 0) return new Map()
    
    const cacheKey = `followed_tags:${userIds.sort().join(',')}`
    const cached = queryCache.get<Map<string, string[]>>(cacheKey)
    if (cached) return cached

    const supabase = client || createReadOnlyClient()
    
    const { data, error } = await supabase
      .from('followed_tags')
      .select('user_id, tag')
      .in('user_id', userIds)

    if (error) throw error

    const tagsByUser = new Map<string, string[]>()
    data?.forEach((row: any) => {
      if (!tagsByUser.has(row.user_id)) {
        tagsByUser.set(row.user_id, [])
      }
      tagsByUser.get(row.user_id)!.push(row.tag)
    })

    queryCache.set(cacheKey, tagsByUser, 600)
    return tagsByUser
  }
}

// Database index recommendations
export const DATABASE_INDEXES = {
  // Core article queries
  articles: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_needs_enrichment ON articles (needs_enrichment) WHERE needs_enrichment = false;',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_publication_date ON articles (publication_date DESC);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_labels_gin ON articles USING gin (labels);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_quarantined ON articles (quarantined) WHERE quarantined IS NULL OR quarantined = false;',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_search_text ON articles USING gin (to_tsvector(\'english\', title || \' \' || COALESCE(summary, \'\') || \' \' || COALESCE(clinical_bottom_line, \'\')));',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_strength_evidence ON articles (strength_of_evidence);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_source_journal ON articles (source_journal);'
  ],
  
  // User-related queries
  saved_articles: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_articles_user_id ON saved_articles (user_id);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_articles_article_id ON saved_articles (article_id);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_articles_saved_at ON saved_articles (saved_at DESC);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_articles_composite ON saved_articles (user_id, saved_at DESC);'
  ],
  
  followed_tags: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_followed_tags_user_id ON followed_tags (user_id);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_followed_tags_tag ON followed_tags (tag);'
  ],
  
  user_roles: [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_role ON user_roles (role);'
  ]
}

// Query performance monitoring
export function logSlowQuery(queryName: string, duration: number, threshold: number = 1000) {
  if (duration > threshold) {
    console.warn(`[DB] Slow query detected: ${queryName} took ${duration}ms`)
  }
}

// Cleanup function for connection pool
export function cleanup() {
  connectionPool.clearPool()
  queryCache.clear()
}