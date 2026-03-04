import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Fetch all articles where enrichment_attempts >= 3
    const { data: failedArticles, error: fetchError } = await supabase
      .from('articles')
      .select('id')
      .gte('enrichment_attempts', 3)

    if (fetchError) {
      console.error('Error fetching failed articles:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch articles' },
        { status: 500 }
      )
    }

    if (!failedArticles || failedArticles.length === 0) {
      return NextResponse.json(
        { message: 'No failed articles to re-enrich', count: 0 },
        { status: 200 }
      )
    }

    const articleIds = failedArticles.map(a => a.id)

    // Set needs_enrichment = true AND force_retry = true for manual retry
    // Do NOT reset enrichment_attempts - let them accumulate
    const { error: updateError } = await supabase
      .from('articles')
      .update({
        needs_enrichment: true,
        force_retry: true
      })
      .in('id', articleIds)

    if (updateError) {
      console.error('Error updating articles:', updateError)
      return NextResponse.json(
        { error: 'Failed to update articles' },
        { status: 500 }
      )
    }

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
    await sendSlackNotification(failedArticles.length)

    return NextResponse.json(
      {
        success: true,
        message: `${failedArticles.length} articles queued for enrichment retry`,
        count: failedArticles.length
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error in enrich-failed:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
