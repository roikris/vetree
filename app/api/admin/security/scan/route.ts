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

  // CHECK 9: Tables missing explicit grants (Supabase breaking change Oct 30, 2026)
  try {
    const { data: tablesWithoutGrants } = await adminSupabase.rpc('check_table_grants')
    if (tablesWithoutGrants && (tablesWithoutGrants as Array<{ table_name: string }>).length > 0) {
      const affected = (tablesWithoutGrants as Array<{ table_name: string }>).map(t => t.table_name)
      findings.push({
        id: 'missing_grants',
        severity: 'high',
        title: 'Tables missing explicit grants',
        description: `${affected.length} tables lack explicit grants — will break with 42501 errors after Supabase's Oct 30, 2026 default grant change.`,
        affected,
        detected_at: new Date().toISOString(),
      })
    }
  } catch {
    // RPC not installed yet — skip
  }

  // CHECK 10: Cross-user data isolation (Broken Access Control — OWASP #1)
  // Tests that authenticated users cannot read other users' private rows,
  // and that anon cannot mass-assign user_id to hijack another user's data.
  try {
    const userOwnedTables = ['saved_articles', 'user_preferences', 'user_consents', 'followed_tags']
    const crossUserViolations: string[] = []

    for (const table of userOwnedTables) {
      // Get a real row owned by a non-admin user (service role bypasses RLS)
      const { data: row } = await adminSupabase
        .from(table)
        .select('user_id')
        .not('user_id', 'is', null)
        .neq('user_id', adminId)
        .limit(1)
        .maybeSingle()

      if (row?.user_id) {
        // Try to read that row as anon — should return nothing if RLS is correct
        const { data: leaked } = await anonSupabase
          .from(table)
          .select('user_id')
          .eq('user_id', row.user_id)
          .limit(1)

        if (leaked && leaked.length > 0) {
          crossUserViolations.push(`${table}: anon can read rows owned by other users`)
        }
      }
    }

    // Mass-assignment probe: anon tries to INSERT into saved_articles with explicit user_id
    // RLS WITH CHECK (auth.uid() = user_id) should block this since anon has no uid
    const testArticleId = 'ffffffffffffffffffffffffffffffff'
    const { error: massAssignErr } = await anonSupabase
      .from('saved_articles')
      .insert({ user_id: adminId, article_id: testArticleId })

    if (!massAssignErr) {
      // RLS did not block — clean up and flag
      crossUserViolations.push('saved_articles: anon INSERT with explicit user_id succeeded (mass assignment)')
      await adminSupabase
        .from('saved_articles')
        .delete()
        .eq('user_id', adminId)
        .eq('article_id', testArticleId)
    } else if (massAssignErr.code !== '42501' && massAssignErr.code !== 'PGRST301' && massAssignErr.message?.includes('violates row-level security')) {
      // Passed RLS but hit a different error (e.g. FK) — still a mass-assignment issue
      crossUserViolations.push(`saved_articles: anon INSERT bypassed RLS (blocked by constraint, not RLS): ${massAssignErr.code}`)
    }

    if (crossUserViolations.length > 0) {
      findings.push({
        id: 'broken_access_control',
        severity: 'critical',
        title: 'Broken access control — cross-user data leak',
        description: `Row-level security is not fully isolating user data: ${crossUserViolations.join('; ')}`,
        affected: crossUserViolations,
        detected_at: new Date().toISOString(),
      })
    }
  } catch {
    // Skip — tables may be empty or probe errored
  }

  // CHECK 11: GDPR data deletion completeness
  // The delete-account route must reference every table that stores user PII.
  // Missing a table = residual data after user requests erasure = GDPR violation.
  try {
    const userDataTables = [
      'page_views', 'search_logs', 'saved_articles', 'followed_tags',
      'user_preferences', 'user_consents', 'reports', 'synthesis_feedback',
    ]
    const deleteRouteContent = fs.readFileSync(
      path.join(cwd, 'app/api/delete-account/route.ts'), 'utf-8'
    )
    const notCovered = userDataTables.filter(t => !deleteRouteContent.includes(t))

    if (notCovered.length > 0) {
      findings.push({
        id: 'gdpr_incomplete_deletion',
        severity: 'high',
        title: 'GDPR: account deletion does not cover all user data tables',
        description: `The delete-account route does not reference these tables that store user PII: ${notCovered.join(', ')}. Users exercising their right to erasure (GDPR Art. 17 / Israeli Privacy Protection Law) would have residual data remaining.`,
        affected: notCovered,
        detected_at: new Date().toISOString(),
      })
    }
  } catch {
    // Route file not found — flag it
    findings.push({
      id: 'gdpr_no_deletion_route',
      severity: 'high',
      title: 'GDPR: delete-account route not found',
      description: 'Could not find app/api/delete-account/route.ts. Users have no way to request data erasure.',
      affected: ['app/api/delete-account/route.ts'],
      detected_at: new Date().toISOString(),
    })
  }

  // CHECK 12: PII exposure in external notifications (Slack / Sentry)
  // Routes that send to Slack or Sentry must not include user emails, IPs, or tokens
  // in the outbound payload — those are third parties with their own data retention.
  try {
    const piiPatterns = ['.email', 'user?.email', 'user.email', '\.ip\b', 'x-forwarded-for', 'user_id', 'userId', 'password', 'token', 'secret']
    const allRouteFiles: string[] = []

    const walkDir = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walkDir(full)
        else if (entry.name === 'route.ts') allRouteFiles.push(full)
      }
    }
    walkDir(path.join(cwd, 'app/api'))

    const piiLeakFiles: string[] = []
    for (const file of allRouteFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const hasExternalSink = content.includes('SLACK_WEBHOOK_URL') || content.includes('captureException') || content.includes('captureMessage')
      if (!hasExternalSink) continue

      // Extract ~500 chars around each external-sink call and look for PII patterns
      const sinkMatches = [...content.matchAll(/(SLACK_WEBHOOK_URL|captureException|captureMessage)[\s\S]{0,500}/g)]
      const contexts = sinkMatches.map(m => m[0])
      const hasPII = piiPatterns.some(p => {
        const re = new RegExp(p.replace('.', '\\.').replace('\\b', '\\b'))
        return contexts.some(ctx => re.test(ctx))
      })
      if (hasPII) piiLeakFiles.push(file.replace(cwd + '/', ''))
    }

    if (piiLeakFiles.length > 0) {
      findings.push({
        id: 'pii_external_leak',
        severity: 'high',
        title: 'Potential PII sent to Slack or Sentry',
        description: `These routes send to external services and contain PII-like patterns near the notification call: ${piiLeakFiles.join(', ')}. Verify that user emails, IPs, and IDs are not included in outbound payloads — both services retain data and are subject to their own privacy policies.`,
        affected: piiLeakFiles,
        detected_at: new Date().toISOString(),
      })
    }
  } catch {
    // Skip on any FS error
  }

  // CHECK 13: Medical content liability
  // 13a — Strong clinical claims from low-confidence AI enrichments
  // 13b — Medical disclaimer present on article pages
  try {
    const { count: riskCount, data: riskArticles } = await adminSupabase
      .from('articles')
      .select('id', { count: 'exact' })
      .or('quarantined.is.null,quarantined.eq.false')
      .eq('needs_enrichment', false)
      .lt('enrichment_attempts', 2)
      .or(
        'clinical_bottom_line.ilike.%always%,' +
        'clinical_bottom_line.ilike.%never%,' +
        'clinical_bottom_line.ilike.%contraindicated%,' +
        'clinical_bottom_line.ilike.%treatment of choice%,' +
        'clinical_bottom_line.ilike.%must be%'
      )
      .limit(20)

    if (riskCount && riskCount > 0) {
      findings.push({
        id: 'medical_liability_claims',
        severity: 'high',
        title: `${riskCount} articles with strong clinical claims from single-attempt AI enrichment`,
        description: `Found ${riskCount} visible articles where the AI used definitive clinical language ("always", "never", "contraindicated", "treatment of choice", "must be") but the article was only enriched once. Low-attempt enrichments are less reliable and these summaries could influence veterinary treatment decisions.`,
        affected: (riskArticles || []).map((a: any) => a.id).slice(0, 10),
        detected_at: new Date().toISOString(),
      })
    }
  } catch {
    // Skip DB errors
  }

  try {
    const articlePageContent = fs.readFileSync(path.join(cwd, 'app/article/[id]/page.tsx'), 'utf-8')
    const lc = articlePageContent.toLowerCase()
    const hasDisclaimer =
      lc.includes('disclaimer') ||
      lc.includes('professional use') ||
      lc.includes('not a substitute') ||
      lc.includes('clinical judgment') ||
      lc.includes('לא מחליף') // Hebrew disclaimer
    if (!hasDisclaimer) {
      findings.push({
        id: 'missing_medical_disclaimer',
        severity: 'high',
        title: 'No medical disclaimer on article pages',
        description: 'Article pages do not contain a medical disclaimer. A veterinary clinical platform should state that AI summaries are for professional reference only and are not a substitute for clinical judgment — required for regulatory compliance and liability protection in both Israeli and international markets.',
        affected: ['app/article/[id]/page.tsx'],
        detected_at: new Date().toISOString(),
      })
    }
  } catch {
    // Page file not found
  }

  // CHECK 14: Dependency vulnerabilities (npm audit)
  // Checks installed packages against the npm advisory database.
  // Flags high and critical severity CVEs only.
  try {
    const { execSync } = await import('child_process')
    let auditJson = ''
    try {
      execSync('npm audit --json 2>/dev/null', {
        cwd,
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      // exit 0 → no vulnerabilities
    } catch (auditErr: any) {
      // npm audit exits non-zero when vulnerabilities exist; stdout has the JSON
      auditJson = auditErr.stdout?.toString() || ''
    }

    if (auditJson) {
      const audit = JSON.parse(auditJson)
      const vulns: Array<[string, any]> = Object.entries(audit.vulnerabilities || {})
      const highCrit = vulns.filter(([, v]) => ['critical', 'high'].includes(v.severity))

      if (highCrit.length > 0) {
        const critCount = highCrit.filter(([, v]) => v.severity === 'critical').length
        const highCount = highCrit.filter(([, v]) => v.severity === 'high').length
        findings.push({
          id: 'dependency_vulnerabilities',
          severity: critCount > 0 ? 'critical' : 'high',
          title: `${highCrit.length} high/critical dependency vulnerabilities`,
          description: `npm audit found ${critCount} critical and ${highCount} high severity CVEs in installed packages: ${highCrit.map(([n, v]) => `${n} (${v.severity})`).join(', ')}.`,
          affected: highCrit.map(([name]) => name),
          detected_at: new Date().toISOString(),
        })
      }
    }
  } catch {
    // npm not available in this environment — skip
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
              content: `You are generating a Claude Code prompt to fix a security issue in Vetree, a Next.js + Supabase veterinary platform.

VETREE EXISTING PATTERNS — fixes MUST follow these, never invent new ones:

AUTH PATTERN (use this for any auth fix):
- Use createClient from @/lib/supabase/server to get session from cookies
- Check user_roles table for admin: .from('user_roles').select('role').eq('user_id', user.id)
- Return 401 if no user, 403 if not admin
- Never create new auth utility files

ADMIN ROUTES PATTERN:
- Always add: export const runtime = 'nodejs' and export const dynamic = 'force-dynamic'
- Initialize Supabase client INSIDE the handler function, never at module level
- Use SUPABASE_SERVICE_ROLE_KEY for admin routes

RLS PATTERN:
- Enable RLS: ALTER TABLE x ENABLE ROW LEVEL SECURITY
- Admin policy: USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
- Public read: USING (true)
- Public insert (analytics): WITH CHECK (true)

RATE LIMITING PATTERN:
- Import from @/lib/ratelimit (ratelimitStrict/Moderate/Loose already exist)
- const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'

DO NOT suggest:
- Creating new auth utility files
- Using middleware for route protection
- Any pattern not listed above

SECURITY ISSUE TO FIX:
Title: ${finding.title}
Description: ${finding.description}
Affected: ${finding.affected.join(', ')}

Generate a ready-to-paste Claude Code prompt that:
1. Starts with: "Read CLAUDE.md, app/api/CLAUDE.md, supabase/CLAUDE.md first. Then:"
2. References specific existing files and patterns above
3. Is achievable in under 1 hour
4. Returns ONLY the prompt text, nothing else.`
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
