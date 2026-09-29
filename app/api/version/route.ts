export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

/**
 * The git commit this deployment was built from. The post-deploy smoke run polls it until
 * production serves the pushed commit, so it never tests the previous release. The repo is
 * public, so the SHA discloses nothing.
 */
export async function GET() {
  return NextResponse.json(
    { sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
