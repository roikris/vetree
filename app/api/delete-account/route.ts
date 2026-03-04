import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Call the database function to delete all user data
    const { error: deleteError } = await supabase.rpc('delete_user_account', {
      user_id_to_delete: user.id
    })

    if (deleteError) {
      console.error('Error deleting account:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete account. Please try again.' },
        { status: 500 }
      )
    }

    // Sign out the user (this should happen automatically since user is deleted,
    // but we do it explicitly to be safe)
    await supabase.auth.signOut()

    return NextResponse.json(
      { success: true, message: 'Account deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error during account deletion:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
