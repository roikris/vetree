import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { ratelimitStrict, getClientIP } from '@/lib/ratelimit'

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

    // Process each user
    for (const user of users) {
      if (!user.email) continue

      // DEDUP CHECK: Skip if user got an email in the last 5 days
      const { data: recentDigest } = await supabase
        .from('digest_logs')
        .select('id')
        .eq('user_id', user.id)
        .gte('sent_at', fiveDaysAgoISO)
        .limit(1)
        .maybeSingle()

      if (recentDigest) {
        console.log(`[digest] Skipping ${user.email} - already sent in last 5 days`)
        skippedCount++
        continue
      }

      // Check if user has followed tags
      const { data: followedTags } = await supabase
        .from('followed_tags')
        .select('tag')
        .eq('user_id', user.id)

      const tags = followedTags?.map(t => t.tag) || []

      // Article selection logic
      let articles
      if (tags.length > 0) {
        // User has followed tags → show articles matching their tags
        const { data } = await supabase
          .from('articles')
          .select('id, title, clinical_bottom_line, labels, source_journal, publication_date, strength_of_evidence')
          .eq('needs_enrichment', false)
          .not('clinical_bottom_line', 'is', null)
          .or('quarantined.is.null,quarantined.eq.false')
          .overlaps('labels', tags)
          .order('publication_date', { ascending: false })
          .limit(5)
        articles = data || []
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

      // Check last page view for re-engagement eligibility (5-14 days inactive)
      const { data: lastView } = await supabase
        .from('page_views')
        .select('viewed_at')
        .eq('user_id', user.id)
        .order('viewed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const daysSinceLastView = lastView
        ? Math.floor((Date.now() - new Date(lastView.viewed_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999 // No views = treat as inactive

      const isAtRisk = daysSinceLastView >= 5 && daysSinceLastView <= 14

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
          // Filter large animals
          const filtered = reEngageArticles.filter(a => !a.labels?.some((l: string) => LARGE_ANIMAL.includes(l)))
          if (filtered.length > 0) {
            reEngagementArticles = filtered
          }
        }
      }

      // Build email subject
      const formattedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const subject = tags.length > 0
        ? `🌿 Your Vetree Weekly Digest — ${tags.slice(0, 3).join(', ')}${tags.length > 3 ? `, +${tags.length - 3}` : ''}`
        : `🌿 This Week on Vetree — Fresh Research (${formattedDate})`

      // Send email
      try {
        await resend.emails.send({
          from: 'Vetree <digest@digest.vetree.app>',
          to: user.email,
          subject,
          html: generateEmailHTML(user.email, tags, articles, reEngagementArticles ?? undefined)
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

function generateEmailHTML(email: string, tags: string[], articles: any[], reEngagementArticles?: any[]): string {
  const articlesHTML = articles.map(article => `
    <div style="margin-bottom: 24px; padding: 20px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #3D7A5F;">
      <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #1a1a1a;">
        <a href="https://vetree.app/article/${article.id}" style="color: #3D7A5F; text-decoration: none;">
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
            Here's this week's research in ${tags.slice(0, 3).join(', ')}${tags.length > 3 ? `, and ${tags.length - 3} more` : ''}:
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
              <a href="https://vetree.app/api/tags/unsubscribe-all" style="color: #9ca3af; text-decoration: underline;">Unsubscribe from all digests</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}
