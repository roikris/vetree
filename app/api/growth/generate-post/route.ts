export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Parse request body
    const body = await request.json()

    // Query for enriched articles
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, clinical_bottom_line, summary, labels, source_journal')
      .eq('needs_enrichment', false)
      .not('clinical_bottom_line', 'is', null)
      .not('summary', 'is', null)
      .not('labels', 'cs', '{"equine"}')
      .not('labels', 'cs', '{"livestock"}')
      .limit(10)
      .order('created_at', { ascending: false })

    if (error || !articles || articles.length === 0) {
      return NextResponse.json({
        error: 'No articles found',
        details: error?.message
      }, { status: 500 })
    }

    // Pick a random article from top 10
    const article = articles[Math.floor(Math.random() * articles.length)]

    // Call Anthropic API
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const platform = body.platform || 'general'
    const language = body.language || 'en'

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Write a ${language} social media post for ${platform}.

Article: ${article.title}
Clinical Bottom Line: ${article.clinical_bottom_line}

Format:
[Hook line]

[2-3 sentences insight]

📄 ${article.title.slice(0, 80)}
🔗 vetree.app/article/${article.id}
🌿 vetree.app

Return ONLY the post text.`
      }],
      system: `You are a veterinary content writer. Write specific, clinically relevant posts for DVMs. ${language === 'he' ? 'Write in natural Hebrew.' : 'Write in English.'}`
    })

    const postContent = message.content[0].type === 'text' ? message.content[0].text : ''
    const hookLine = postContent.split('\n')[0].trim()

    return NextResponse.json({
      post_content: postContent,
      article_id: article.id,
      article_title: article.title,
      article_labels: article.labels || [],
      hook_line: hookLine,
      article_url: `vetree.app/article/${article.id}`,
      source_journal: article.source_journal || 'N/A'
    })

  } catch (error) {
    console.error('[generate-post] Error:', error)
    return NextResponse.json({
      error: 'Failed to generate post',
      details: String(error)
    }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 })
}
