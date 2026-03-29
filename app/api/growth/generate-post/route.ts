export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ratelimitModerate, getClientIP } from '@/lib/ratelimit'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 10 requests per minute per IP
    const ip = getClientIP(request)
    const { success } = await ratelimitModerate.limit(ip)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

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
    console.log('[generate-post] platform:', platform, 'forced article_id:', articleId || '(none)')

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
    let forcedArticleId = articleId
    if (forcedArticleId) {
      const { data: specificArticle, error } = await supabase
        .from('articles')
        .select('id, title, clinical_bottom_line, summary, labels, source_journal, publication_date')
        .eq('id', forcedArticleId)
        .single()

      if (error || !specificArticle) {
        console.log('[generate-post] Forced article not found:', forcedArticleId, error?.message)
        return NextResponse.json({
          error: 'Article not found',
          details: error?.message
        }, { status: 404 })
      }

      console.log('[generate-post] Forced article found:', specificArticle.id, specificArticle.title?.slice(0, 60))

      // Check if forced article is large animal
      const isLargeAnimal = specificArticle?.labels?.some((l: string) =>
        largeAnimalLabels.includes(l)
      )

      if (isLargeAnimal) {
        // Fall back to random selection - don't use this large animal article
        console.log('[generate-post] Forced article is large animal, falling back to random selection')
        forcedArticleId = null
        article = null
      } else {
        article = specificArticle
        console.log('[generate-post] Using forced article (small animal)')
      }
    }

    while (retryCount < MAX_RETRIES && !article) {
      // FIX 1 + 2: Only exclude APPROVED articles from last 14 days (not skipped ones)
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      const { data: recentMemory } = await supabase
        .from('growth_agent_memory')
        .select('article_id')
        .eq('outcome', 'approved')  // Only exclude published articles
        .gte('created_at', fourteenDaysAgo)

      const recentArticleIds = recentMemory?.map(row => row.article_id) || []

      // FIX 5: Also exclude articles already generated TODAY (session-level check)
      const today = new Date().toISOString().split('T')[0]
      const { data: todayMemory } = await supabase
        .from('growth_agent_memory')
        .select('article_id')
        .gte('created_at', today)

      const todayArticleIds = new Set(todayMemory?.map(m => m.article_id) || [])

      // FIX 4: On 3rd attempt, disable memory exclusion entirely (fallback)
      let allExcludedIds: string[] = []
      if (retryCount >= 2) {
        console.log('[generate-post] Attempt 3: Fallback - ignoring memory exclusion')
        allExcludedIds = [] // Last resort: no exclusions except large animals
      } else {
        allExcludedIds = Array.from(new Set([...recentArticleIds, ...todayArticleIds]))
      }

      // FIX 3: Query for enriched articles - fetch top 200 most recent by publication date
      // NOTE: GIN index exists on labels column (idx_articles_labels_gin) for efficient array operations.
      // Ideally we'd filter large animals server-side with .not('labels', 'ov', largeAnimalLabels),
      // but Supabase PostgREST doesn't reliably support .not() with overlap operators.
      // JS filtering works fine for small result sets. For raw SQL queries, the GIN index will be used automatically.
      const { data: articles, error } = await supabase
        .from('articles')
        .select('id, title, clinical_bottom_line, summary, labels, source_journal, publication_date')
        .eq('needs_enrichment', false)
        .not('clinical_bottom_line', 'is', null)
        .not('summary', 'is', null)
        .limit(200)  // Increased from 50 to 200
        .order('publication_date', { ascending: false })

      if (error || !articles || articles.length === 0) {
        return NextResponse.json({
          error: 'No articles found',
          details: error?.message
        }, { status: 500 })
      }

      // Debug logging
      console.log('[generate-post] Total articles fetched:', articles.length)
      console.log('[generate-post] Excluded from memory:', allExcludedIds.length)

      // Filter out large animal articles and already-used articles (JS filtering)
      const filteredArticles = articles.filter(article => {
        const labels = article.labels || []
        const isLargeAnimal = labels.some((label: string) =>
          largeAnimalLabels.includes(label)
        )
        const alreadyUsed = allExcludedIds.includes(article.id)
        return !isLargeAnimal && !alreadyUsed
      })

      console.log('[generate-post] After large animal filter:', filteredArticles.length)

      if (filteredArticles.length === 0) {
        retryCount++
        if (retryCount >= MAX_RETRIES) {
          return NextResponse.json({
            error: 'No small animal articles found',
            details: 'All recent articles are large animal focused or already used'
          }, { status: 500 })
        }
        continue // Retry with next attempt
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

    // Build article URL with UTM parameters for tracking
    const utmParams = {
      twitter: 'utm_source=twitter&utm_medium=social',
      linkedin: 'utm_source=linkedin&utm_medium=social',
      facebook: 'utm_source=facebook&utm_medium=social',
      facebook_il: 'utm_source=facebook&utm_medium=social&utm_campaign=il',
      facebook_intl: 'utm_source=facebook&utm_medium=social&utm_campaign=intl',
      whatsapp: 'utm_source=whatsapp&utm_medium=social',
      instagram: 'utm_source=instagram&utm_medium=social',
      telegram: 'utm_source=telegram&utm_medium=social',
      reddit: 'utm_source=reddit&utm_medium=social',
      tiktok: 'utm_source=tiktok&utm_medium=social',
      threads: 'utm_source=threads&utm_medium=social'
    }

    const articleUrl = `https://vetree.app/article/${article.id}?${utmParams[platform as keyof typeof utmParams] || 'utm_source=social&utm_medium=social'}`

    // Call Anthropic API to generate post for the selected article
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Platform-specific formatting rules
    const platformRules = {
      twitter: 'MAX 280 characters total including link. One hook sentence + one insight. Be ruthless with brevity.',
      linkedin: `Rhythm: short→long→short. 150-300 words. No bullet points. Human voice.

BANNED PHRASES — never use these or similar:
- "game changer" / "game-changing"
- "major upgrade"
- "revolutionary" / "revolutionize"
- "groundbreaking"
- "exciting new"
- "I'm thrilled"
- "delighted to share"
- "proud to announce"
- "unlock the potential"
- "take it to the next level"

Instead use: specific clinical language, numbers, direct observations, questions that make vets think. Write like a colleague sharing a finding over coffee, not a marketer.`,
      facebook: 'Conversational, 100-200 words. Can use emoji sparingly. Personal tone.',
      facebook_il: 'Same as Facebook but in Hebrew. Natural clinical Hebrew, not translated.',
      facebook_intl: 'International Facebook. Conversational, 100-200 words. Personal tone.',
      whatsapp: 'Very short, casual, direct. 50-80 words max. Hebrew preferred for IL group.',
      instagram: 'Visual-first caption. Hook + insight + hashtags at end. 100-150 words.',
      telegram: 'Medium length, informative. 100-150 words. Can be slightly more technical.',
      reddit: 'Informative, evidence-based. 150-250 words. Avoid marketing tone.',
      threads: `Conversational text post, 150-300 words. Threads is personality-driven and rewards replies over likes. Pick ONE of these formats per generation (rotate between them, never use the same format twice in a row):

FORMAT A — Hot Take:
A strong clinical opinion or evidence-based stance that invites discussion.
End with a direct question to the reader.
Example structure: "[Bold claim about clinical practice]. Here's why: [evidence]. Do you agree, or is your experience different?"

FORMAT B — Micro-Story:
A short 2-3 paragraph relatable clinical moment. Small win, surprising finding, or case that made you think differently. Personal and warm tone.

FORMAT C — Mini Thread (list):
Hook line + numbered list of 3-5 clinical insights from the article.
Make the first line strong enough to make people click "Show more."
Example: "3 things this study changed about how I [X]:"

FORMAT D — Direct Question:
Open with the clinical finding, then ask the community a specific question related to their practice. Invites replies.
Example: "New data on [X]. How are you handling this in your clinic?"

RULES FOR ALL FORMATS:
- Conversational, not polished — write like you're thinking out loud
- No hashtags (they underperform on Threads)
- No bullet points with dashes — use numbers or plain prose
- Reference the specific finding from the article
- Small animal first opinion focus`,
      tiktok: `Spoken voiceover script, 80-100 words MAX (not 150-200).
Must be completable in 30-45 seconds when spoken aloud.
Conversational and warm — written to be HEARD not read.
No hashtags, no bullet points, no URLs in the script body.

STRUCTURE (strict):
1. HOOK (seconds 1-3): One punchy sentence that creates urgency or curiosity.
   Must be a clinical decision, surprising finding, or practice-changing fact.
   Examples: "This changes how I grade sarcomas before surgery."
             "Most vets are missing this before anesthesia."
             "A 12-week diet change achieved diabetic remission in cats."

2. CORE (seconds 4-35): 2-3 sentences of clinical evidence. Specific numbers
   when available. What did the study find? What changes in practice?

3. TAKEAWAY (seconds 36-45): One sentence. What does the vet do differently
   tomorrow because of this?

HOOK VARIETY — rotate, never repeat the same style:
- Surprising statistic: "X% of cats with [condition]..."
- Practice-changing finding: "This study just changed my [X] protocol."
- Clinical scenario: "A 6-year-old Lab came in with [X]..."
- Misconception: "We've been wrong about [X]. Here's the data."
- Urgency: "If you're still doing [X], read this first."
- Bold statement: "The evidence on [X] is clearer than we thought."

BANNED OPENINGS:
- "Did you know"
- "Have you ever"
- "Today we're talking about"
- "Let's talk about"
- "In this video"

Think: vet educator, 45 seconds, colleague over coffee, clinical and specific.
Shorter = more completions = more reach.`
    }

    const platformRule = platformRules[platform as keyof typeof platformRules] || platformRules.telegram

    // Build platform-specific prompt
    let promptContent: string
    if (platform === 'twitter') {
      promptContent = `PLATFORM: Twitter
PLATFORM RULE: ${platformRule}

Write a ${language} tweet for Twitter.

Article: ${article.title}
Clinical Bottom Line: ${article.clinical_bottom_line}
Labels: ${article.labels?.join(', ') || 'N/A'}

IMPORTANT: This post is for small animal first opinion practice only. If the article is about large animals, equine, livestock, or poultry - do not generate a post and return ONLY the text: SKIP_LARGE_ANIMAL

TWITTER RULES (CRITICAL):
- Total post must be UNDER 280 characters including the link
- Count every character. Be ruthless with brevity
- One hook sentence + one clinical insight
- No fluff, no adjectives, just facts

Format:
[Hook - max 1 sentence]
[One clinical insight - max 1 sentence]
🔗 ${articleUrl}

Return ONLY the tweet text. Count characters carefully - MUST be under 280 total.`
    } else if (platform === 'linkedin') {
      promptContent = `PLATFORM: LinkedIn
PLATFORM RULE: ${platformRule}

Write a ${language} LinkedIn post.

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

🔗 ${articleUrl}

🌿 vetree.app

Return ONLY the post text following this exact rhythm pattern.`
    } else if (platform === 'tiktok') {
      promptContent = `PLATFORM: TikTok
PLATFORM RULE: ${platformRule}

Write a ${language} TikTok voiceover script.

Article: ${article.title}
Clinical Bottom Line: ${article.clinical_bottom_line}
Labels: ${article.labels?.join(', ') || 'N/A'}

IMPORTANT: This post is for small animal first opinion practice only. If the article is about large animals, equine, livestock, or poultry - do not generate a post and return ONLY the text: SKIP_LARGE_ANIMAL

TIKTOK SCRIPT RULES (CRITICAL):
- 80-100 words MAX — completable in 30-45 seconds spoken aloud
- No URLs, hashtags, or bullet points in the script body
- Natural sentence breaks create spoken pauses
- After the script, add the link on a new line (not inside the script)

Format:
[HOOK — 1 punchy sentence, seconds 1-3]

[CORE — 2-3 sentences of clinical evidence with specific numbers, seconds 4-35]

[TAKEAWAY — 1 sentence, what the vet does differently tomorrow, seconds 36-45]

🔗 vetree.app/article/${article.id}?${utmParams.tiktok}

Return ONLY the voiceover script followed by the link on a new line.`
    } else if (platform === 'threads') {
      // Fetch last Threads post to avoid repeating the same format
      const { data: lastThreads } = await supabase
        .from('growth_agent_memory')
        .select('hook_line')
        .eq('platform', 'threads')
        .eq('outcome', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const formatHint = lastThreads?.hook_line
        ? `\n\nLast Threads post style used: "${lastThreads.hook_line.slice(0, 80)}..."\nUse a DIFFERENT format this time.`
        : ''

      promptContent = `PLATFORM: Threads
PLATFORM RULE: ${platformRule}

Write a ${language} Threads post.

Article: ${article.title}
Clinical Bottom Line: ${article.clinical_bottom_line}
Labels: ${article.labels?.join(', ') || 'N/A'}

IMPORTANT: This post is for small animal first opinion practice only. If the article is about large animals, equine, livestock, or poultry - do not generate a post and return ONLY the text: SKIP_LARGE_ANIMAL

THREADS RULES (CRITICAL):
- 150-300 words
- Choose ONE format (A, B, C, or D) as described in the platform rule
- Conversational, not polished — write like thinking out loud
- No hashtags, no dashes for bullet points
- End with the article link on its own line
${formatHint}

Format:
[Your chosen format post — 150-300 words]

🔗 ${articleUrl}

Return ONLY the post text. Do not label which format you chose.`
    } else {
      promptContent = `PLATFORM: ${platform}
PLATFORM RULE: ${platformRule}

Write a ${language} social media post for ${platform}.

Article: ${article.title}
Clinical Bottom Line: ${article.clinical_bottom_line}
Labels: ${article.labels?.join(', ') || 'N/A'}

IMPORTANT: This post is for small animal first opinion practice only. If the article is about large animals, equine, livestock, or poultry - do not generate a post and return ONLY the text: SKIP_LARGE_ANIMAL

FORMATTING REQUIREMENTS:
${platformRule}

Format:
[Hook line]

[2-3 sentences insight]

📄 ${article.title.slice(0, 80)}
🔗 ${articleUrl}
🌿 vetree.app

Return ONLY the post text. Follow the platform rule exactly.`
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
