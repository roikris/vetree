export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const adminId = '90cb8294-b593-4144-a9f5-23ca52dd5e35'

const SPECIALTY_KEYWORDS: Record<string, string[]> = {
  'Cardiology': ['cardiac','heart','cardio','mitral','arrhythmia','ecg','murmur'],
  'Oncology': ['tumor','cancer','oncology','lymphoma','sarcoma','mast cell','mass'],
  'Dermatology': ['dermatitis','skin','pruritus','allergy','atopy','itching','rash'],
  'Neurology': ['seizure','epilepsy','neuro','ivdd','disc','paralysis','vestibular'],
  'Internal Medicine': ['diabetes','kidney','ckd','liver','pancreatitis','hypertension','thyroid'],
  'Emergency': ['emergency','critical','shock','trauma','gdv','bloat','toxin'],
  'Orthopedics': ['fracture','cruciate','tplo','lameness','joint','bone','ligament'],
  'Ophthalmology': ['eye','glaucoma','cataract','cornea','uveitis','blindness'],
  'Soft Tissue Surgery': ['surgery','surgical','resection','mass removal','laparotomy'],
  'Anesthesia': ['anesthesia','sedation','analgesia','pain','opioid'],
}

const LARGE_ANIMAL = ['Equine','equine','Large Animal','large animal',
  'Livestock','livestock','Poultry','poultry','Food Animal','food animal']

const SKIP_LABELS = ['Small Animal','Large Animal','small animal','large animal']

export async function GET(request: NextRequest) {
  try {
    // Admin auth check
    const serverClient = await createClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: role } = await serverClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (role?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Use service role for analytics queries
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const since60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // SIGNAL 1: Which articles got social clicks (UTM-tracked)?
    const { data: socialViews } = await supabase
      .from('page_views')
      .select('path, utm_source')
      .not('utm_source', 'is', null)
      .gte('created_at', since60)
      .like('path', '/article/%')
      .or(`user_id.is.null,user_id.neq.${adminId}`)

    console.log('[recs] socialViews count:', socialViews?.length)

    const articleSocialCounts: Record<string, {
      total: number
      by_platform: Record<string, number>
    }> = {}

    socialViews?.forEach(v => {
      const id = v.path.replace('/article/', '')
      const platform = (v.utm_source || '').toLowerCase()
      if (!articleSocialCounts[id]) {
        articleSocialCounts[id] = { total: 0, by_platform: {} }
      }
      articleSocialCounts[id].total++
      articleSocialCounts[id].by_platform[platform] =
        (articleSocialCounts[id].by_platform[platform] || 0) + 1
    })

    // SIGNAL 2: Which specialties perform best on social?
    const topSocialArticleIds = Object.entries(articleSocialCounts)
      .sort(([,a], [,b]) => b.total - a.total)
      .slice(0, 50)
      .map(([id]) => id)

    let specialtyPerformance: Record<string, number> = {}

    if (topSocialArticleIds.length > 0) {
      const { data: articleLabels } = await supabase
        .from('articles')
        .select('id, labels')
        .in('id', topSocialArticleIds)

      articleLabels?.forEach(a => {
        const views = articleSocialCounts[a.id]?.total || 0
        ;(a.labels || [])
          .filter((l: string) => !SKIP_LABELS.includes(l))
          .forEach((label: string) => {
            specialtyPerformance[label] = (specialtyPerformance[label] || 0) + views
          })
      })
    }

    const topSpecialties = Object.entries(specialtyPerformance)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([label]) => label)

    console.log('[recs] topSpecialties:', topSpecialties)

    // SIGNAL 3: Search demand by specialty
    const { data: searches } = await supabase
      .from('search_logs')
      .select('query')
      .gte('created_at', since30)
      .or(`user_id.is.null,user_id.neq.${adminId}`)

    const searchDemand: Record<string, number> = {}
    searches?.forEach(s => {
      const q = s.query.toLowerCase()
      Object.entries(SPECIALTY_KEYWORDS).forEach(([specialty, keywords]) => {
        if (keywords.some(kw => q.includes(kw))) {
          searchDemand[specialty] = (searchDemand[specialty] || 0) + 1
        }
      })
    })

    // FIX 2: Only exclude approved posts from last 30 days (not all memory entries)
    const { data: recentlyPosted } = await supabase
      .from('growth_agent_memory')
      .select('article_id')
      .eq('outcome', 'approved')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .not('article_id', 'is', null)

    const postedIds = new Set(recentlyPosted?.map(p => p.article_id) || [])
    console.log('[recs] postedIds count:', postedIds.size)

    // FIX 1: Broader fallback when no social signal yet
    const labelsToQuery = topSpecialties.length > 0
      ? topSpecialties
      : ['Cardiology', 'Oncology', 'Internal Medicine', 'Emergency', 'Dermatology']

    const { data: candidates } = await supabase
      .from('articles')
      .select('id, title, labels, source_journal, publication_date, clinical_bottom_line, strength_of_evidence')
      .eq('needs_enrichment', false)
      .not('clinical_bottom_line', 'is', null)
      .or('quarantined.is.null,quarantined.eq.false')
      .overlaps('labels', labelsToQuery)
      .order('publication_date', { ascending: false })
      .limit(200)

    console.log('[recs] candidates before filter:', candidates?.length)

    // Large animal filter in JS (per CLAUDE.md)
    const afterLargeAnimal = (candidates || [])
      .filter(a => !a.labels?.some((l: string) => LARGE_ANIMAL.includes(l)))

    console.log('[recs] after LARGE_ANIMAL filter:', afterLargeAnimal.length)

    const filtered = afterLargeAnimal.filter(a => !postedIds.has(a.id))

    console.log('[recs] after postedIds filter:', filtered.length)

    // FIX 3: Safe Math.max when objects may be empty
    const maxSocial = Object.values(specialtyPerformance).length > 0
      ? Math.max(...Object.values(specialtyPerformance))
      : 1
    const maxDemand = Object.values(searchDemand).length > 0
      ? Math.max(...Object.values(searchDemand))
      : 1

    const scored = filtered.map(article => {
      const socialViewCount = articleSocialCounts[article.id]?.total || 0

      const articleSpecialties = (article.labels || []).filter((l: string) => !SKIP_LABELS.includes(l))
      const specialtyScore = articleSpecialties.reduce((sum: number, label: string) => {
        const socialScore = (specialtyPerformance[label] || 0) / maxSocial
        const demandScore = (searchDemand[label] || 0) / maxDemand
        return sum + (socialScore * 0.7) + (demandScore * 0.3)
      }, 0) / Math.max(articleSpecialties.length, 1)

      const daysSince = (Date.now() - new Date(article.publication_date).getTime())
        / (1000 * 60 * 60 * 24)
      const recencyScore = Math.max(0, 1 - (daysSince / 90))

      const provenScore = socialViewCount > 0 ? Math.min(socialViewCount / 10, 1) : 0

      const finalScore = (specialtyScore * 0.55) + (recencyScore * 0.30) + (provenScore * 0.15)

      return {
        ...article,
        score: finalScore,
        social_views: socialViewCount,
        by_platform: articleSocialCounts[article.id]?.by_platform || {},
        specialty_score: specialtyScore,
        recency_score: recencyScore,
      }
    })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    console.log('[recs] final scored count:', scored.length)

    return NextResponse.json({
      recommendations: scored,
      insights: {
        top_specialties: topSpecialties,
        search_demand: searchDemand,
        total_social_visits_analyzed: socialViews?.length || 0,
        articles_already_posted_60d: postedIds.size,
      }
    })

  } catch (error: any) {
    console.error('[growth/recommendations] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load recommendations', details: String(error) },
      { status: 500 }
    )
  }
}
