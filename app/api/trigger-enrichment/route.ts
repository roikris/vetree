import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Trigger GitHub Actions workflow
    const githubPat = process.env.GITHUB_PAT

    if (!githubPat) {
      console.error('[DEBUG] GITHUB_PAT not configured in environment variables')
      return NextResponse.json(
        { error: 'GitHub integration not configured. Please set GITHUB_PAT environment variable.' },
        { status: 500 }
      )
    }

    const workflowUrl = 'https://api.github.com/repos/roikris/vetree/actions/workflows/enrich-articles.yml/dispatches'

    console.log('[DEBUG] Triggering GitHub Actions workflow:', {
      url: workflowUrl,
      ref: 'main',
      hasToken: !!githubPat
    })

    const workflowResponse = await fetch(workflowUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubPat}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' })
    })

    console.log('[DEBUG] GitHub API response:', {
      status: workflowResponse.status,
      statusText: workflowResponse.statusText,
      ok: workflowResponse.ok
    })

    if (!workflowResponse.ok) {
      const errorText = await workflowResponse.text()
      console.error('[DEBUG] GitHub API error response body:', errorText)

      return NextResponse.json(
        {
          error: 'Failed to trigger enrichment workflow',
          details: `GitHub API returned ${workflowResponse.status}: ${errorText}`
        },
        { status: 500 }
      )
    }

    console.log('[DEBUG] Workflow triggered successfully')

    return NextResponse.json(
      {
        success: true,
        message: 'Enrichment workflow triggered successfully! Check GitHub Actions for progress.'
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('[DEBUG] Unexpected error in trigger-enrichment:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: String(error) },
      { status: 500 }
    )
  }
}
