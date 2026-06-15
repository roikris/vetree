import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { ratelimitStrict, getClientIP } from '@/lib/ratelimit'
import { createHmac } from 'crypto'

function generateUnsubscribeToken(userId: string): string {
  const secret = process.env.DIGEST_SECRET || ''
  return createHmac('sha256', secret).update(userId).digest('hex')
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for sending emails

async function sendSlackNotification(sentCount: number, skippedCount: number, errorCount: number, totalUsers: number) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🌿 *Vetree Weekly Digest Sent*\n• Emails sent: ${sentCount}\n• Skipped: ${skippedCount}\n• Errors: ${errorCount}\n• Total users: ${totalUsers}`
      })
    })
  } catch (error) {
    console.error('[digest] Slack notification error:', error)
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let triggeredBy = 'github-action' // default

  try {
    // Rate limiting - 3 requests per minute per IP
    const ip = getClientIP(request)
    const { success } = await ratelimitStrict.limit(ip)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    // Check authorization
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.DIGEST_SECRET}`

    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if manually triggered (from admin UI)
    const body = await request.json().catch(() => ({}))
    if (body.triggered_by) {
      triggeredBy = body.triggered_by
    }

    const resend = new Resend(process.env.RESEND_API_KEY!)
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Admin ID to exclude from digest
    const adminId = '90cb8294-b593-4144-a9f5-23ca52dd5e35'

    // Get ALL registered users with confirmed emails
    const { data: allUsersData } = await supabase.auth.admin.listUsers()
    const users = allUsersData.users.filter(u =>
      u.email_confirmed_at !== null &&
      u.id !== adminId
    )

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No confirmed users found',
        sentCount: 0
      })
    }

    let sentCount = 0
    let skippedCount = 0
    let errorCount = 0
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    const fiveDaysAgoISO = fiveDaysAgo.toISOString()
    const fiveDaysAgoDate = fiveDaysAgo.toISOString().split('T')[0]

    // Define large animal labels to filter (as per CLAUDE.md)
    const LARGE_ANIMAL = ['Equine','equine','Large Animal','large animal','Livestock','livestock','Poultry','poultry','Food Animal','food animal']

    // Fetch all opted-out users in one query (avoids N+1 per user)
    const { data: optedOut } = await supabase
      .from('user_preferences')
      .select('user_id')
      .eq('digest_opt_out', true)

    const optedOutIds = new Set((optedOut || []).map(r => r.user_id))

    // Fetch users with explicit marketing consent (Israeli Anti-Spam Law)
    // Only users who have ticked the marketing opt-in checkbox may receive digest emails
    const { data: consented } = await supabase
      .from('user_consents')
      .select('user_id')
      .eq('marketing_opted_in', true)

    const consentedIds = new Set((consented || []).map(r => r.user_id))

    // Dry-run mode: collect preview, skip sends and DB writes
    const dryRun = body.dry_run === true
    const previewList: { email: string; tags: string[]; article_count: number; titles: string[] }[] = []

    // --- Batch pre-queries (Fix 4: eliminate N+1) ---

    // Batch 1: Which users got a digest in the last 5 days?
    const { data: recentDigests } = await supabase
      .from('digest_logs')
      .select('user_id')
      .gte('sent_at', fiveDaysAgoISO)
    const recentDigestIds = new Set((recentDigests || []).map(r => r.user_id))

    // Batch 2: All followed tags for all users
    const { data: allTagsData } = await supabase.from('followed_tags').select('user_id, tag')
    const tagsByUser = new Map<string, string[]>()
    for (const row of allTagsData || []) {
      if (!tagsByUser.has(row.user_id)) tagsByUser.set(row.user_id, [])
      tagsByUser.get(row.user_id)!.push(row.tag)
    }

    // Batch 3: Most recent page_view per user (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentViews } = await supabase
      .from('page_views')
      .select('user_id, viewed_at')
      .gte('viewed_at', ninetyDaysAgo)
      .order('viewed_at', { ascending: false })
    const lastViewByUser = new Map<string, string>()
    for (const row of recentViews || []) {
      if (!lastViewByUser.has(row.user_id)) lastViewByUser.set(row.user_id, row.viewed_at)
    }

    // Process each user
    for (const user of users) {
      if (!user.email) continue

      // Skip users who have explicitly unsubscribed
      if (optedOutIds.has(user.id)) {
        skippedCount++
        continue
      }

      // Skip users without explicit marketing consent (Israeli Anti-Spam Law)
      if (!consentedIds.has(user.id)) {
        skippedCount++
        continue
      }

      // DEDUP CHECK: Skip if user got an email in the last 5 days (batch lookup)
      if (recentDigestIds.has(user.id)) {
        console.log(`[digest] Skipping ${user.email} - already sent in last 5 days`)
        skippedCount++
        continue
      }

      // Tags and last view from batch maps
      const tags = tagsByUser.get(user.id) || []
      const lastViewedAt = lastViewByUser.get(user.id)
      const daysSinceLastView = lastViewedAt
        ? Math.floor((Date.now() - new Date(lastViewedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 999

      // Article selection logic
      let articles
      if (tags.length > 0) {
        // Try fresh articles first (last 5 days matching tags)
        const { data: freshData } = await supabase
          .from('articles')
          .select('id, title, clinical_bottom_line, labels, source_journal, publication_date, strength_of_evidence')
          .eq('needs_enrichment', false)
          .not('clinical_bottom_line', 'is', null)
          .or('quarantined.is.null,quarantined.eq.false')
          .overlaps('labels', tags)
          .gte('publication_date', fiveDaysAgoDate)
          .order('publication_date', { ascending: false })
          .limit(5)

        if (freshData && freshData.length > 0) {
          articles = freshData
        } else {
          // Fall back to most recent if no fresh articles in their topics
          const { data: fallback } = await supabase
            .from('articles')
            .select('id, title, clinical_bottom_line, labels, source_journal, publication_date, strength_of_evidence')
            .eq('needs_enrichment', false)
            .not('clinical_bottom_line', 'is', null)
            .or('quarantined.is.null,quarantined.eq.false')
            .overlaps('labels', tags)
            .order('publication_date', { ascending: false })
            .limit(5)
          articles = fallback || []
        }
      } else {
        // User has no tags → show 5 most recent articles from last 5 days
        const { data } = await supabase
          .from('articles')
          .select('id, title, clinical_bottom_line, labels, source_journal, publication_date, strength_of_evidence')
          .eq('needs_enrichment', false)
          .not('clinical_bottom_line', 'is', null)
          .or('quarantined.is.null,quarantined.eq.false')
          .gte('publication_date', fiveDaysAgoDate)
          .order('publication_date', { ascending: false })
          .limit(5)
        articles = data || []
      }

      // Skip user if no articles found
      if (!articles || articles.length === 0) {
        console.log(`[digest] Skipping ${user.email} - no articles found`)
        skippedCount++
        continue
      }

      // Filter large animals in JS (as per CLAUDE.md)
      articles = articles.filter(a => !a.labels?.some((l: string) => LARGE_ANIMAL.includes(l)))

      if (articles.length === 0) {
        console.log(`[digest] Skipping ${user.email} - only large animal articles`)
        skippedCount++
        continue
      }

      // Fix 2: Re-engagement threshold 21-90 days (not 5-14)
      const isAtRisk = daysSinceLastView >= 21 && daysSinceLastView <= 90

      // Fetch re-engagement articles if user is at-risk AND has followed tags
      let reEngagementArticles = null
      if (isAtRisk && tags.length > 0) {
        const { data: reEngageArticles } = await supabase
          .from('articles')
          .select('id, title, clinical_bottom_line, source_journal, publication_date, labels')
          .eq('needs_enrichment', false)
          .not('clinical_bottom_line', 'is', null)
          .or('quarantined.is.null,quarantined.eq.false')
          .overlaps('labels', tags)
          .order('publication_date', { ascending: false })
          .limit(3)

        if (reEngageArticles && reEngageArticles.length > 0) {
          const filtered = reEngageArticles.filter(a => !a.labels?.some((l: string) => LARGE_ANIMAL.includes(l)))
          if (filtered.length > 0) {
            reEngagementArticles = filtered
          }
        }
      }

      // Fix 1: Conditional intro text (no broken "in :" for no-tag users)
      const intro = tags.length > 0
        ? `Here's this week's research in ${tags.slice(0, 3).join(', ')}${tags.length > 3 ? `, and ${tags.length - 3} more` : ''}:`
        : `Here's the latest evidence-based research from Vetree this week:`

      // Build email subject
      const formattedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const subject = tags.length > 0
        ? `🌿 Your Vetree Weekly Digest — ${tags.slice(0, 3).join(', ')}${tags.length > 3 ? `, +${tags.length - 3}` : ''}`
        : `🌿 This Week on Vetree — Fresh Research (${formattedDate})`

      // Dry-run: collect preview without sending
      if (dryRun) {
        previewList.push({
          email: user.email,
          tags,
          article_count: articles.length,
          titles: articles.map(a => a.title),
        })
        sentCount++
        continue
      }

      // Send email
      try {
        await resend.emails.send({
          from: 'Vetree <digest@digest.vetree.app>',
          to: user.email,
          subject,
          html: generateEmailHTML(user.email, user.id, generateUnsubscribeToken(user.id), tags, articles, intro, reEngagementArticles ?? undefined)
        })

        // Log the digest
        await supabase.from('digest_logs').insert({
          user_id: user.id,
          sent_at: new Date().toISOString(),
          articles_count: articles.length,
          tags: tags.length > 0 ? tags : null
        })

        sentCount++
      } catch (emailError) {
        console.error(`[digest] Failed to send to ${user.email}:`, emailError)
        errorCount++
      }
    }

    // Dry-run: return preview without DB writes
    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        would_send: previewList,
        would_skip: skippedCount,
        total_users: users.length,
      })
    }

    // Log the digest run
    const runTime = Date.now() - startTime
    const { error: logError } = await supabase.from('digest_runs').insert({
      triggered_by: triggeredBy,
      sent_count: sentCount,
      skipped_count: skippedCount,
      total_users: users.length,
      run_time_ms: runTime,
      status: 'success'
    })

    if (logError) {
      console.error('[digest] Failed to log run:', logError)
    }

    await sendSlackNotification(sentCount, skippedCount, errorCount, users.length)

    return NextResponse.json({
      success: true,
      sentCount,
      skippedCount,
      totalUsers: users.length
    })

  } catch (error) {
    console.error('[digest] Error:', error)

    // Log failed run
    const runTime = Date.now() - startTime
    const supabaseForLog = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error: logError } = await supabaseForLog.from('digest_runs').insert({
      triggered_by: triggeredBy,
      sent_count: 0,
      skipped_count: 0,
      total_users: 0,
      run_time_ms: runTime,
      status: 'failed',
      error_message: String(error)
    })

    if (logError) {
      console.error('[digest] Failed to log failed run:', logError)
    }

    return NextResponse.json({
      error: 'Failed to send digests',
      details: String(error)
    }, { status: 500 })
  }
}

function generateEmailHTML(email: string, userId: string, unsubscribeToken: string, tags: string[], articles: any[], intro: string, reEngagementArticles?: any[]): string {
  const unsubscribeUrl = `https://vetree.app/api/tags/unsubscribe-all?uid=${encodeURIComponent(userId)}&token=${unsubscribeToken}`
  const articlesHTML = articles.map(article => `
    <div style="margin-bottom: 24px; padding: 20px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #3D7A5F;">
      <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #1a1a1a;">
        <a href="https://vetree.app/article/${article.id}?utm_source=digest&utm_medium=email" style="color: #3D7A5F; text-decoration: none;">
          ${article.title}
        </a>
      </h3>
      <p style="margin: 4px 0; font-size: 14px; color: #6b7280;">
        ${article.source_journal || 'Unknown Journal'} · ${new Date(article.publication_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
      <div style="margin: 12px 0; padding: 12px; background: #fef3c7; border-radius: 6px;">
        <p style="margin: 0; font-size: 14px; color: #78350f; font-weight: 500;">📌 Clinical Bottom Line</p>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #451a03; line-height: 1.5;">
          ${article.clinical_bottom_line}
        </p>
      </div>
      ${article.strength_of_evidence ? `
        <span style="display: inline-block; padding: 4px 12px; background: #d1fae5; color: #065f46; font-size: 12px; border-radius: 12px; margin-top: 8px;">
          Evidence: ${article.strength_of_evidence}
        </span>
      ` : ''}
    </div>
  `).join('')

  // Re-engagement section for at-risk users (5-14 days inactive)
  const reEngagementHTML = reEngagementArticles && reEngagementArticles.length > 0 ? `
    <div style="margin-bottom: 40px; padding: 24px; background: #fef3e2; border-radius: 12px; border: 2px solid #f59e0b;">
      <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #92400e;">
        👋 Haven't seen you in a while! Here's what you missed:
      </h2>
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #78350f;">
        We've enriched some new articles in your followed topics:
      </p>
      ${reEngagementArticles.map(article => `
        <div style="margin-bottom: 16px; padding: 16px; background: #ffffff; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <h3 style="margin: 0 0 6px 0; font-size: 16px; color: #1a1a1a;">
            <a href="https://vetree.app/article/${article.id}?utm_source=digest&utm_medium=email&utm_campaign=reengagement" style="color: #f59e0b; text-decoration: none;">
              ${article.title}
            </a>
          </h3>
          <p style="margin: 4px 0 8px 0; font-size: 13px; color: #6b7280;">
            ${article.source_journal || 'Unknown Journal'} · ${new Date(article.publication_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <p style="margin: 0; font-size: 14px; color: #451a03; line-height: 1.5;">
            ${article.clinical_bottom_line}
          </p>
        </div>
      `).join('')}
    </div>
  ` : ''

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #ffffff;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="margin: 0; font-size: 32px; color: #3D7A5F;">🌿 Vetree</h1>
            <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">Evidence-based veterinary research, distilled.</p>
          </div>

          <!-- Greeting -->
          <p style="font-size: 16px; color: #1a1a1a; margin-bottom: 8px;">
            Hi there,
          </p>
          <p style="font-size: 16px; color: #1a1a1a; margin-bottom: 24px;">
            ${intro}
          </p>

          <!-- Re-engagement Section (for at-risk users) -->
          ${reEngagementHTML}

          <!-- Articles -->
          ${articlesHTML}

          <!-- Footer -->
          <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
              <a href="https://vetree.app" style="color: #3D7A5F; text-decoration: none;">Browse more articles →</a>
            </p>
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">
              <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe from all digests</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}
