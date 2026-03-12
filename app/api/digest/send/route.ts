import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { ratelimitStrict, getClientIP } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for sending emails

export async function POST(request: NextRequest) {
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

    const resend = new Resend(process.env.RESEND_API_KEY!)
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get all users with followed tags
    const { data: usersWithTags } = await supabase
      .from('followed_tags')
      .select('user_id')
      .order('user_id')

    if (!usersWithTags || usersWithTags.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users with followed tags',
        sentCount: 0
      })
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(usersWithTags.map(u => u.user_id))]

    let sentCount = 0
    let skippedCount = 0
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Process each user
    for (const userId of uniqueUserIds) {
      // Get user's followed tags
      const { data: userTags } = await supabase
        .from('followed_tags')
        .select('tag')
        .eq('user_id', userId)

      const tags = userTags?.map(t => t.tag) || []
      if (tags.length === 0) continue

      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(userId)
      if (!userData.user?.email) continue

      // Fetch recent articles matching user's tags
      const { data: articles } = await supabase
        .from('articles')
        .select('id, title, clinical_bottom_line, source_journal, publication_date, strength_of_evidence, labels')
        .eq('needs_enrichment', false)
        .not('clinical_bottom_line', 'is', null)
        .or('quarantined.is.null,quarantined.eq.false')
        .overlaps('labels', tags)
        .gte('publication_date', sevenDaysAgo.toISOString().split('T')[0])
        .order('publication_date', { ascending: false })
        .limit(5)

      // Skip if fewer than 3 articles
      if (!articles || articles.length < 3) {
        skippedCount++
        continue
      }

      // Send email
      try {
        await resend.emails.send({
          from: 'Vetree <digest@vetree.app>',
          to: userData.user.email,
          subject: `🌿 Your Vetree Weekly Digest — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          html: generateEmailHTML(userData.user.email, tags, articles)
        })

        // Log the digest
        await supabase.from('digest_logs').insert({
          user_id: userId,
          articles_count: articles.length,
          tags: tags
        })

        sentCount++
      } catch (emailError) {
        console.error(`[digest] Failed to send to ${userData.user.email}:`, emailError)
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      skippedCount,
      totalUsers: uniqueUserIds.length
    })

  } catch (error) {
    console.error('[digest] Error:', error)
    return NextResponse.json({
      error: 'Failed to send digests',
      details: String(error)
    }, { status: 500 })
  }
}

function generateEmailHTML(email: string, tags: string[], articles: any[]): string {
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
