import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requeueFailedArticles } from '@/lib/enrichment/requeueFailed'

async function sendSlackNotification(count: number) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    console.log('No SLACK_WEBHOOK_URL configured, skipping notification')
    return
  }

  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })

  const message = {
    text: `🔄 *Vetree Manual Enrichment Retry*
• Articles queued for retry: ${count}
• Triggered by: Admin
• Time: ${timestamp}
• Note: Articles with enrichment_attempts >= 3 were manually re-queued`
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })

    if (!response.ok) {
      console.error('Failed to send Slack notification:', response.statusText)
    } else {
      console.log('✓ Slack notification sent')
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Service role client that bypasses RLS for admin operations
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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

    // Only failed, unpublished articles (lib/enrichment/requeueFailed.ts — shared with Article Health)
    let requeued = 0
    let released = 0
    try {
      ({ requeued, released } = await requeueFailedArticles(supabaseAdmin))
    } catch (e) {
      console.error('[enrich-failed] requeue failed:', e)
      return NextResponse.json({ error: 'Failed to re-queue articles' }, { status: 500 })
    }
    if (requeued === 0) {
      return NextResponse.json({ message: 'No failed articles to re-enrich', count: 0 }, { status: 200 })
    }
    console.log(`[enrich-failed] re-queued ${requeued} (${released} un-hidden for retry)`)

    // Trigger GitHub Actions workflow
    const githubPat = process.env.GITHUB_PAT

    if (!githubPat) {
      console.error('GITHUB_PAT not configured')
      return NextResponse.json(
        { error: 'GitHub integration not configured. Articles queued but workflow not triggered.' },
        { status: 500 }
      )
    }

    const workflowResponse = await fetch(
      'https://api.github.com/repos/roikris/vetree/actions/workflows/enrich-articles.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubPat}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' })
      }
    )

    if (!workflowResponse.ok) {
      const errorText = await workflowResponse.text()
      console.error('GitHub Actions trigger failed:', errorText)
      return NextResponse.json(
        { error: 'Failed to trigger enrichment workflow. Articles queued but workflow not started.' },
        { status: 500 }
      )
    }

    // Send Slack notification
    await sendSlackNotification(requeued)

    const response = {
      success: true,
      message: `${requeued} articles queued for enrichment retry`,
      count: requeued
    }

    console.log('[DEBUG] Sending success response:', response)

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Unexpected error in enrich-failed:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
