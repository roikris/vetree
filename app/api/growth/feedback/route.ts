import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force this route to use Node.js runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
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

    // Parse request body
    const body = await request.json()
    const {
      article_id,
      outcome,
      skip_reason,
      hook_line,
      platform,
      language,
      article_labels
    } = body

    if (!article_id || !outcome || !platform || !language) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Save to growth_agent_memory
    const { error: memoryError } = await supabase
      .from('growth_agent_memory')
      .insert({
        article_id,
        platform,
        language,
        outcome,
        skip_reason: skip_reason || null,
        hook_line: hook_line || null
      })

    if (memoryError) {
      console.error('Error saving to memory:', memoryError)
      return NextResponse.json(
        { error: 'Failed to save feedback', details: memoryError.message },
        { status: 500 }
      )
    }

    // Update preferences based on outcome
    const { data: preferences } = await supabase
      .from('growth_agent_preferences')
      .select('*')
      .limit(1)
      .single()

    if (preferences) {
      const updates: any = {}

      if (outcome === 'skipped') {
        updates.skipped_count = (preferences.skipped_count || 0) + 1

        // Learn from skip reason
        if (skip_reason) {
          // If skip reason mentions specialty issues
          if (skip_reason === 'Not relevant specialty' && article_labels) {
            const currentAvoided = preferences.avoided_specialties || []
            const newAvoided = [...new Set([...currentAvoided, ...article_labels])]
            updates.avoided_specialties = newAvoided
          }

          // Track hook styles that get skipped
          if ((skip_reason === 'Too generic' || skip_reason === 'Wrong tone') && hook_line) {
            const currentAvoided = preferences.avoided_hook_styles || []
            // Extract first few words as hook style pattern
            const hookPattern = hook_line.split(' ').slice(0, 3).join(' ')
            updates.avoided_hook_styles = [...new Set([...currentAvoided, hookPattern])]
          }
        }
      } else if (outcome === 'approved') {
        updates.approved_count = (preferences.approved_count || 0) + 1

        // Learn from approved content
        if (hook_line) {
          const currentPreferred = preferences.preferred_hook_styles || []
          // Extract first few words as hook style pattern
          const hookPattern = hook_line.split(' ').slice(0, 3).join(' ')
          updates.preferred_hook_styles = [...new Set([...currentPreferred, hookPattern])]
        }

        // Reinforce specialty preferences
        if (article_labels) {
          const currentPreferred = preferences.preferred_specialties || []
          const newPreferred = [...new Set([...currentPreferred, ...article_labels])]
          updates.preferred_specialties = newPreferred
        }
      }

      updates.updated_at = new Date().toISOString()

      // Update preferences
      const { error: updateError } = await supabase
        .from('growth_agent_preferences')
        .update(updates)
        .eq('id', preferences.id)

      if (updateError) {
        console.error('Error updating preferences:', updateError)
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback saved successfully'
    })

  } catch (error) {
    console.error('Error processing feedback:', error)
    return NextResponse.json(
      { error: 'Failed to process feedback', details: String(error) },
      { status: 500 }
    )
  }
}
