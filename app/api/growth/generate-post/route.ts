export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Step 1: Just return success to verify route works
    return NextResponse.json({
      step: 1,
      message: 'Route is alive',
      env_check: {
        supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        anthropic_key: !!process.env.ANTHROPIC_API_KEY,
      }
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 })
}
