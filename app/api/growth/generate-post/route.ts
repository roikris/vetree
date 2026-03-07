import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { platform, language, skip_reason } = body

    if (!platform || !language) {
      return NextResponse.json(
        { error: 'Missing required fields: platform, language' },
        { status: 400 }
      )
    }

    // Fetch agent preferences
    const { data: preferences } = await supabase
      .from('growth_agent_preferences')
      .select('*')
      .limit(1)
      .single()

    if (!preferences) {
      return NextResponse.json(
        { error: 'Agent preferences not initialized' },
        { status: 500 }
      )
    }

    // Fetch already-shown article IDs
    const { data: shownArticles } = await supabase
      .from('growth_agent_memory')
      .select('article_id')
      .eq('platform', platform)
      .eq('language', language)

    const shownArticleIds = shownArticles?.map(a => a.article_id) || []

    // Query for a relevant article
    let query = supabase
      .from('articles')
      .select('*')
      .not('clinical_bottom_line', 'is', null)
      .not('summary', 'is', null)
      .neq('clinical_bottom_line', '')
      .neq('summary', '')
      .gt('clinical_bottom_line', '')

    // Exclude already-shown articles
    if (shownArticleIds.length > 0) {
      query = query.not('id', 'in', `(${shownArticleIds.join(',')})`)
    }

    // Filter by preferred specialties if available
    if (preferences.preferred_specialties && preferences.preferred_specialties.length > 0) {
      // PostgreSQL array overlap operator
      query = query.overlaps('labels', preferences.preferred_specialties)
    }

    // Exclude avoided specialties
    if (preferences.avoided_specialties && preferences.avoided_specialties.length > 0) {
      query = query.not('labels', 'ov', preferences.avoided_specialties)
    }

    // Exclude large animal articles
    query = query.not('labels', 'ov', ['equine', 'livestock', 'food animal', 'poultry', 'Equine', 'Livestock'])

    // Order by publication date and limit
    query = query.order('publication_date', { ascending: false }).limit(10)

    const { data: articles, error: articlesError } = await query

    if (articlesError || !articles || articles.length === 0) {
      return NextResponse.json(
        { error: 'No suitable articles found', details: articlesError?.message },
        { status: 404 }
      )
    }

    // Pick a random article from the top 10
    const article = articles[Math.floor(Math.random() * articles.length)]

    // Determine character limits based on platform
    const charLimits: Record<string, number> = {
      twitter: 280,
      facebook_il: 300,
      facebook_intl: 500,
      instagram: 500,
      reddit: 500,
      telegram: 500,
      whatsapp: 300,
      linkedin: 500,
      kol: 600
    }

    const maxChars = charLimits[platform] || 500

    // Build prompt for Claude
    const systemPrompt = `You are a veterinary content writer creating social media posts for Vetree, an evidence-based veterinary research platform.
You write for veterinary professionals (DVMs) in clinical practice.
Your posts are specific, clinically relevant, and add genuine value.
Never be generic. Always reference the specific finding from the article.
For Hebrew posts: write naturally, not translated-sounding. Use clinical Hebrew terminology.
For English posts: conversational but professional tone.`

    const userPrompt = `Write a social media post for ${platform} in ${language}.

Article details:
Title: ${article.title}
Clinical Bottom Line: ${article.clinical_bottom_line}
Summary: ${article.summary.substring(0, 500)}
Journal: ${article.source_journal || 'N/A'}
Labels: ${article.labels?.join(', ') || 'N/A'}

Agent preferences:
- Preferred hook styles: ${preferences.preferred_hook_styles?.join(', ') || 'not set yet'}
- Avoided hook styles: ${preferences.avoided_hook_styles?.join(', ') || 'none'}
- Last skip reason: ${skip_reason || 'none'}

Post format:
[Hook line - one sentence, specific to this article's finding, never generic]

[2-3 sentences of genuine clinical insight based on the article - what does this mean for daily practice?]

📄 ${article.title.slice(0, 80)}${article.title.length > 80 ? '...' : ''}

🔗 vetree.app/article/${article.id}

🌿 vetree.app

Rules:
- Hook must reference something specific from the article
- Clinical insight must be actionable for first-opinion small animal practice
- Never use phrases like "חיפשתם מחקר" or "stay updated" - too generic
- ${language === 'he' ? 'Hebrew posts: max 300 chars total' : `Max ${maxChars} chars total`}
- Return ONLY the post text, nothing else
- No explanations, just the post content`

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt
    })

    const postContent = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract hook line (first line)
    const hookLine = postContent.split('\n')[0].trim()

    return NextResponse.json({
      post_content: postContent.trim(),
      article_id: article.id,
      article_title: article.title,
      article_labels: article.labels || [],
      hook_line: hookLine,
      article_url: `vetree.app/article/${article.id}`,
      source_journal: article.source_journal
    })

  } catch (error) {
    console.error('Error generating post:', error)
    return NextResponse.json(
      { error: 'Failed to generate post', details: String(error) },
      { status: 500 }
    )
  }
}
