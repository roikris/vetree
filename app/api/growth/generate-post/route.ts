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
    const platform = body.platform || 'general'
    const language = body.language || 'en'
    const articleId = body.article_id // Optional - reuse specific article

    // Retry logic for large animal detection
    const MAX_RETRIES = 3
    let retryCount = 0
    let postContent = ''
    let article: any = null
    let hookLine = ''

    // Define large animal labels to exclude
    const largeAnimalLabels = [
      'Equine', 'equine',
      'Large Animal', 'large animal',
      'Livestock', 'livestock',
      'Poultry', 'poultry',
      'Food Animal', 'food animal'
    ]

    // If article_id is provided, fetch that specific article and skip selection
    if (articleId) {
      const { data: specificArticle, error } = await supabase
        .from('articles')
        .select('id, title, clinical_bottom_line, summary, labels, source_journal, publication_date')
        .eq('id', articleId)
        .single()

      if (error || !specificArticle) {
        return NextResponse.json({
          error: 'Article not found',
          details: error?.message
        }, { status: 404 })
      }

      article = specificArticle
    }

    while (retryCount < MAX_RETRIES && !article) {
      // Get articles already used for this platform+language combo
      const { data: usedArticleIds } = await supabase
        .from('growth_agent_memory')
        .select('article_id')
        .eq('platform', platform)
        .eq('language', language)

      const usedIds = usedArticleIds?.map(row => row.article_id) || []

      // Query for enriched articles - fetch top 50 most recent by publication date
      const { data: articles, error } = await supabase
        .from('articles')
        .select('id, title, clinical_bottom_line, summary, labels, source_journal, publication_date')
        .eq('needs_enrichment', false)
        .not('clinical_bottom_line', 'is', null)
        .not('summary', 'is', null)
        .limit(50)
        .order('publication_date', { ascending: false })

      if (error || !articles || articles.length === 0) {
        return NextResponse.json({
          error: 'No articles found',
          details: error?.message
        }, { status: 500 })
      }

      // Filter out large animal articles and already-used articles
      const filteredArticles = articles.filter(article => {
        const labels = article.labels || []
        const isLargeAnimal = labels.some((label: string) =>
          largeAnimalLabels.includes(label)
        )
        const alreadyUsed = usedIds.includes(article.id)
        return !isLargeAnimal && !alreadyUsed
      })

      if (filteredArticles.length === 0) {
        return NextResponse.json({
          error: 'No small animal articles found',
          details: 'All recent articles are large animal focused or already used'
        }, { status: 500 })
      }

      // Weighted random selection - newer articles get higher probability
      const weighted = filteredArticles.map((article, index) => ({
        article,
        weight: Math.pow(0.95, index) // exponential decay: 1st=1.0, 2nd=0.95, 10th=0.60, 30th=0.21
      }))

      const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0)
      let random = Math.random() * totalWeight
      let selected = weighted[0].article

      for (const { article: weightedArticle, weight } of weighted) {
        random -= weight
        if (random <= 0) {
          selected = weightedArticle
          break
        }
      }

      article = selected

      // Success - break out of retry loop after selecting article
      break
    }

    // If no article found after retries (shouldn't happen if articleId was provided)
    if (!article) {
      return NextResponse.json({
        error: 'No suitable article found',
        details: 'Unable to find an article after retries'
      }, { status: 500 })
    }

    // Call Anthropic API to generate post for the selected article
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Build platform-specific prompt
    let promptContent: string
    if (platform === 'twitter') {
      promptContent = `Write a ${language} tweet for Twitter.

Article: ${article.title}
Clinical Bottom Line: ${article.clinical_bottom_line}
Labels: ${article.labels?.join(', ') || 'N/A'}

IMPORTANT: This post is for small animal first opinion practice only. If the article is about large animals, equine, livestock, or poultry - do not generate a post and return ONLY the text: SKIP_LARGE_ANIMAL

TWITTER RULES: Total post must be UNDER 280 characters including the link.
Count every character. Be ruthless with brevity.

Format:
[Hook - max 1 sentence]
[One clinical insight - max 1 sentence]
🔗 vetree.app/article/${article.id}

Return ONLY the tweet text. Count characters carefully - MUST be under 280 total.`
    } else if (platform === 'linkedin') {
      promptContent = `Write a ${language} LinkedIn post.

Article: ${article.title}
Clinical Bottom Line: ${article.clinical_bottom_line}
Labels: ${article.labels?.join(', ') || 'N/A'}

IMPORTANT: This post is for small animal first opinion practice only. If the article is about large animals, equine, livestock, or poultry - do not generate a post and return ONLY the text: SKIP_LARGE_ANIMAL

LINKEDIN RHYTHM FORMATTING (CRITICAL):
- Alternate between short lines (1 sentence) and longer paragraphs (2-3 sentences)
- Pattern: short → long → short → medium → short → short
- Never have 3+ paragraphs of the same length in a row
- End with a single punchy line before the link
- No bullet points, no emojis except one at the end
- Must feel human-written, not AI-generated
- Squint test: when you blur your eyes, the text blocks should vary in size like music rhythm

LinkedIn post structure:
[1 short punchy hook - one sentence that creates curiosity]

[1-2 sentences of context/story - why this matters]

[The specific clinical finding from the article - 2-3 sentences]

[Short punchy takeaway - one sentence]

[Article title shortened to ~60 chars]

🔗 vetree.app/article/${article.id}

🌿 vetree.app

Return ONLY the post text following this exact rhythm pattern.`
    } else {
      promptContent = `Write a ${language} social media post for ${platform}.

Article: ${article.title}
Clinical Bottom Line: ${article.clinical_bottom_line}
Labels: ${article.labels?.join(', ') || 'N/A'}

IMPORTANT: This post is for small animal first opinion practice only. If the article is about large animals, equine, livestock, or poultry - do not generate a post and return ONLY the text: SKIP_LARGE_ANIMAL

Format:
[Hook line]

[2-3 sentences insight]

📄 ${article.title.slice(0, 80)}
🔗 vetree.app/article/${article.id}
🌿 vetree.app

Return ONLY the post text.`
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: promptContent
      }],
      system: `You are a veterinary content writer. Write specific, clinically relevant posts for DVMs in small animal practice. ${language === 'he' ? 'Write in natural Hebrew.' : 'Write in English.'}`
    })

    postContent = message.content[0].type === 'text' ? message.content[0].text : ''

    // Twitter-specific length check
    if (platform === 'twitter' && postContent.length > 280 && !postContent.includes('SKIP_LARGE_ANIMAL')) {
      console.log(`[generate-post] Tweet too long (${postContent.length} chars), asking Claude to shorten...`)

      const shortenMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `This tweet is ${postContent.length} characters but must be under 280. Shorten it ruthlessly while keeping the clinical insight and link:

${postContent}

Return ONLY the shortened tweet (under 280 chars).`
        }]
      })

      const shortenedContent = shortenMessage.content[0].type === 'text' ? shortenMessage.content[0].text : postContent

      // If still too long, truncate intelligently
      if (shortenedContent.length <= 280) {
        postContent = shortenedContent
      } else {
        console.log(`[generate-post] Still too long after shortening, truncating...`)
        // Keep first part and ensure we keep the link
        const linkMatch = postContent.match(/🔗 vetree\.app\/article\/[\w-]+/)
        const link = linkMatch ? linkMatch[0] : `🔗 vetree.app/article/${article.id}`
        const maxTextLength = 280 - link.length - 3 // -3 for newlines
        const textPart = postContent.split('🔗')[0].trim()
        postContent = textPart.slice(0, maxTextLength).trim() + '\n' + link
      }
    }

    // Extract hook line from generated content
    hookLine = postContent.split('\n')[0].trim()

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
