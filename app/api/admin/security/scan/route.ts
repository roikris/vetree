import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type FindingSeverity = 'critical' | 'high' | 'medium' | 'low'

type Finding = {
  id: string
  severity: FindingSeverity
  title: string
  description: string
  affected: string[]
  detected_at: string
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))

  // Auth: Bearer token OR admin session
  const authHeader = request.headers.get('authorization')
  const expectedBearer = `Bearer ${process.env.DIGEST_SECRET}`
  let isAuthorized = authHeader === expectedBearer
  let triggeredBy = body.triggered_by || 'scheduled'

  if (!isAuthorized) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: role } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle()
      isAuthorized = !!role
      if (isAuthorized) triggeredBy = 'admin'
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Anon client for RLS testing (no session)
  const anonSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const findings: Finding[] = []

  // CHECK 1: RLS — try accessing sensitive tables with anon key
  // These tables should never return data to unauthenticated requests
  const sensitiveTables = [
    'page_views', 'digest_logs', 'user_roles',
    'security_reports', 'analytics_signals', 'digest_runs',
    'search_logs', 'user_article_saves',
  ]
  for (const table of sensitiveTables) {
    const { data } = await anonSupabase.from(table).select('id').limit(1)
    if (data && data.length > 0) {
      findings.push({
        id: `rls_disabled_${table}`,
        severity: 'critical',
        title: `RLS not enforced on table: ${table}`,
        description: `Anonymous (unauthenticated) access to "${table}" returned data. Row Level Security is either disabled or has an overly permissive policy allowing public reads.`,
        affected: [table],
        detected_at: new Date().toISOString(),
      })
    }
  }

  // CHECK 2: pg_tables RLS status via RPC (requires check_rls_status function)
  try {
    const { data: rlsTables } = await adminSupabase.rpc('check_rls_status')
    if (rlsTables) {
      for (const table of rlsTables as Array<{ tablename: string }>) {
        if (!findings.some(f => f.id === `rls_disabled_${table.tablename}`)) {
          findings.push({
            id: `rls_off_${table.tablename}`,
            severity: 'critical',
            title: `RLS disabled on table: ${table.tablename}`,
            description: `pg_tables reports rowsecurity=false for "${table.tablename}". All rows are accessible without authorization filters.`,
            affected: [table.tablename],
            detected_at: new Date().toISOString(),
          })
        }
      }
    }
  } catch {
    // RPC function not installed — RLS checked via anon client above
  }

  // CHECK 3: Exposed secrets via NEXT_PUBLIC_ env vars
  const dangerousPublicVars = [
    'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_ANTHROPIC_API_KEY',
    'NEXT_PUBLIC_RESEND_API_KEY',
    'NEXT_PUBLIC_GITHUB_PAT',
    'NEXT_PUBLIC_DIGEST_SECRET',
    'NEXT_PUBLIC_SLACK_WEBHOOK_URL',
  ]
  const exposedVars = dangerousPublicVars.filter(v => process.env[v])
  if (exposedVars.length > 0) {
    findings.push({
      id: 'exposed_secrets',
      severity: 'critical',
      title: 'Secret keys exposed via NEXT_PUBLIC_ env vars',
      description: `The following secret keys are bundled into client-side JavaScript: ${exposedVars.join(', ')}. Any visitor can extract these from the browser.`,
      affected: exposedVars,
      detected_at: new Date().toISOString(),
    })
  }

  // CHECK 4: Auth protection on sensitive API routes
  const cwd = process.cwd()
  const sensitiveRouteChecks = [
    { path: 'app/api/digest/send/route.ts', patterns: ['Unauthorized', 'Bearer'] },
    { path: 'app/api/growth/generate-post/route.ts', patterns: ['Unauthorized', '401'] },
    { path: 'app/api/admin/analytics/insights/route.ts', patterns: ['Unauthorized', '401', 'admin'] },
    { path: 'app/api/enrich-failed/route.ts', patterns: ['Unauthorized', '401', 'admin'] },
    { path: 'app/api/admin/security/scan/route.ts', patterns: ['Unauthorized', 'Bearer'] },
  ]
  for (const route of sensitiveRouteChecks) {
    try {
      const content = fs.readFileSync(path.join(cwd, route.path), 'utf-8')
      const hasAuth = route.patterns.some(p => content.includes(p))
      if (!hasAuth) {
        findings.push({
          id: `missing_auth_${route.path.replace(/\//g, '_')}`,
          severity: 'high',
          title: `Missing auth protection: ${route.path}`,
          description: `The route does not appear to have authorization checks (expected patterns: ${route.patterns.join(', ')}).`,
          affected: [route.path],
          detected_at: new Date().toISOString(),
        })
      }
    } catch {
      // File doesn't exist yet
    }
  }

  // CHECK 5: Rate limiting coverage
  const rateLimitedRouteChecks = [
    'app/api/delete-account/route.ts',
    'app/api/growth/generate-post/route.ts',
    'app/api/analytics/track/route.ts',
    'app/api/digest/send/route.ts',
  ]
  for (const routePath of rateLimitedRouteChecks) {
    try {
      const content = fs.readFileSync(path.join(cwd, routePath), 'utf-8')
      if (!content.includes('ratelimit') && !content.includes('rateLimit')) {
        findings.push({
          id: `missing_ratelimit_${routePath.replace(/\//g, '_')}`,
          severity: 'medium',
          title: `No rate limiting: ${routePath}`,
          description: `This route does not apply rate limiting, making it vulnerable to abuse and denial-of-service attacks.`,
          affected: [routePath],
          detected_at: new Date().toISOString(),
        })
      }
    } catch {
      // File doesn't exist
    }
  }

  // CHECK 7: Hallucinated summaries still visible to users
  const { count: hallucinatedCount } = await adminSupabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .or('summary.ilike.%I cannot provide%,summary.ilike.%based on the title alone%')
    .or('quarantined.is.null,quarantined.eq.false')

  if (hallucinatedCount && hallucinatedCount > 0) {
    findings.push({
      id: 'hallucinated_summaries',
      severity: 'medium',
      title: `${hallucinatedCount} hallucinated article summaries visible to users`,
      description: `Found ${hallucinatedCount} unquarantined articles with AI-hallucinated summaries (containing "I cannot provide" or "based on the title alone"). These may present false clinical information to veterinarians.`,
      affected: ['articles'],
      detected_at: new Date().toISOString(),
    })
  }

  // CHECK 8: Admin ID exclusion working correctly
  const adminId = '90cb8294-b593-4144-a9f5-23ca52dd5e35'
  const { data: adminPageViews } = await adminSupabase
    .from('page_views')
    .select('id')
    .eq('user_id', adminId)
    .limit(5)

  if (adminPageViews && adminPageViews.length > 0) {
    findings.push({
      id: 'admin_views_recorded',
      severity: 'low',
      title: 'Admin page views being recorded in analytics',
      description: `Found ${adminPageViews.length} page view records for the admin user ID. The analytics exclusion filter may not be working, inflating user engagement metrics.`,
      affected: ['page_views', 'app/api/analytics/track/route.ts'],
      detected_at: new Date().toISOString(),
    })
  }

  // PART 3: Generate Claude Haiku fix prompts for each finding
  const fixes: Array<{ finding_id: string; fix_prompt: string }> = []
  if (findings.length > 0) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const fixResults = await Promise.all(
      findings.map(async (finding) => {
        try {
          const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            messages: [{
              role: 'user',
              content: `Generate a specific Claude Code prompt to fix this security issue in Vetree:

Issue: ${finding.title}
Description: ${finding.description}
Affected: ${finding.affected.join(', ')}

The fix prompt should:
- Be ready to paste directly into Claude Code
- Reference specific files in the Vetree codebase
- Be actionable in under 1 hour
- Follow Vetree patterns (Next.js App Router, Supabase, service role key for admin routes)

Return ONLY the prompt text, nothing else.`
            }]
          })
          return {
            finding_id: finding.id,
            fix_prompt: response.content[0].type === 'text' ? response.content[0].text : '',
          }
        } catch {
          return { finding_id: finding.id, fix_prompt: '' }
        }
      })
    )
    fixes.push(...fixResults)
  }

  // PART 4: Save report
  const runId = `security_${Date.now()}`
  const overallSeverity = findings.length === 0 ? 'clean'
    : findings.some(f => f.severity === 'critical') ? 'critical'
    : findings.some(f => f.severity === 'high') ? 'high'
    : findings.some(f => f.severity === 'medium') ? 'medium' : 'low'

  await adminSupabase.from('security_reports').insert({
    run_id: runId,
    triggered_by: triggeredBy,
    severity: overallSeverity,
    findings_json: findings,
    fixes_json: fixes,
    summary: `${findings.length} issue${findings.length !== 1 ? 's' : ''} found. Severity: ${overallSeverity}`,
  })

  // Slack notification
  const severityEmoji: Record<string, string> = {
    clean: '✅', low: '🟡', medium: '🟠', high: '🔴', critical: '🚨',
  }

  if (process.env.SLACK_WEBHOOK_URL) {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${severityEmoji[overallSeverity]} *Vetree Security Report*\n\n` +
          `*Overall Severity:* ${overallSeverity.toUpperCase()}\n` +
          `*Issues Found:* ${findings.length}\n\n` +
          (findings.length > 0
            ? `*Issues:*\n${findings.map(f =>
                `${severityEmoji[f.severity]} [${f.severity.toUpperCase()}] ${f.title}`
              ).join('\n')}`
            : '🎉 No issues detected — all checks passed!') +
          `\n\n<https://vetree.app/admin/security|View Full Report & Fix Prompts →>`,
      }),
    }).catch(err => console.error('[security] Slack error:', err))
  }

  return NextResponse.json({
    success: true,
    run_id: runId,
    severity: overallSeverity,
    findings_count: findings.length,
  })
}
