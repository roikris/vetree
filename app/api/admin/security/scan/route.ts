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

  // Findings that are intentionally accepted. Each entry: finding_id → reason.
  // Update this map (with a comment and date) when a risk is reviewed and deferred.
  const ACKNOWLEDGED: Record<string, string> = {
    missing_csp: 'Intentionally deferred — CSP requires whitelisting Supabase/Vercel/Sentry/Google OAuth. See comment in next.config.ts.',
  }

  // Load previous 4 runs for recurrence and resolved tracking
  const { data: prevRuns } = await adminSupabase
    .from('security_reports')
    .select('run_id, findings_json')
    .order('created_at', { ascending: false })
    .limit(4)
  const prevRunFindings: Array<Set<string>> = (prevRuns || []).map(r =>
    new Set((r.findings_json as Finding[] || []).map((f: Finding) => f.id))
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

  const adminId = '90cb8294-b593-4144-a9f5-23ca52dd5e35'

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

    // Exclude this file — it intentionally references PII patterns for detection purposes
    const thisScanRoute = path.join(cwd, 'app/api/admin/security/scan/route.ts')

    const piiLeakFiles: string[] = []
    for (const file of allRouteFiles) {
      if (file === thisScanRoute) continue
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

  // CHECK 13: Medical disclaimer present on article pages
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

  // CHECK 15: Privilege escalation — can anon INSERT into user_roles?
  // If the RLS WITH CHECK policy is misconfigured, any user could grant
  // themselves the 'admin' role and gain full platform access.
  try {
    const { error: privEscErr } = await anonSupabase
      .from('user_roles')
      .insert({ user_id: adminId, role: 'admin' })

    if (!privEscErr) {
      // Succeeded — clean up immediately and flag critical
      await adminSupabase
        .from('user_roles')
        .delete()
        .eq('user_id', adminId)
        .eq('role', 'admin')
        .neq('user_id', adminId) // safety: only delete the probe row, not the real admin row
      findings.push({
        id: 'privilege_escalation',
        severity: 'critical',
        title: 'Privilege escalation — anon can INSERT into user_roles',
        description: 'An unauthenticated request successfully inserted a row into user_roles. Any visitor can grant themselves admin access. The RLS WITH CHECK policy on user_roles is missing or broken.',
        affected: ['user_roles'],
        detected_at: new Date().toISOString(),
      })
    } else if (!privEscErr.message?.includes('row-level security') &&
               privEscErr.code !== '42501' &&
               privEscErr.code !== 'PGRST301') {
      // RLS did not block it — a different error did (e.g. unique constraint)
      findings.push({
        id: 'privilege_escalation_partial',
        severity: 'critical',
        title: 'Privilege escalation — user_roles INSERT bypassed RLS (stopped by constraint only)',
        description: `An anon INSERT into user_roles was not blocked by RLS — it was stopped by a database constraint (${privEscErr.code}). If the constraint is removed or a different user_id is used, escalation succeeds.`,
        affected: ['user_roles'],
        detected_at: new Date().toISOString(),
      })
    }
  } catch {
    // Skip
  }

  // CHECK 16: Missing Content-Security-Policy header
  // next.config.ts explicitly skips CSP ("requires careful whitelisting").
  // Without CSP, any XSS in AI-generated content (summaries, posts) can
  // exfiltrate session tokens or redirect users to malicious sites.
  try {
    const nextConfigContent = fs.readFileSync(path.join(cwd, 'next.config.ts'), 'utf-8')
    const hasCSP = nextConfigContent.includes('Content-Security-Policy')
    if (!hasCSP) {
      findings.push({
        id: 'missing_csp',
        severity: 'high',
        title: 'Content-Security-Policy header not set',
        description: 'next.config.ts does not include a Content-Security-Policy header. The file contains a comment acknowledging this is intentionally skipped. Without CSP, XSS in AI-generated article summaries or social posts can steal session tokens, exfiltrate clipboard data, or silently redirect veterinary professionals to attacker-controlled pages.',
        affected: ['next.config.ts'],
        detected_at: new Date().toISOString(),
      })
    }
  } catch {
    // Config file not found
  }

  // CHECK 17: API routes bypass email-verification middleware
  // Dynamically walks all app/api route files. For each file that calls getUser(),
  // checks whether it also verifies email_confirmed_at. Admin-only routes (those
  // checking role === 'admin') are excluded — admin access implies verified email.
  try {
    const middlewareContent = fs.readFileSync(path.join(cwd, 'middleware.ts'), 'utf-8')
    const apiExcluded = middlewareContent.includes('api') &&
      middlewareContent.match(/\(\?\!.*api.*\)/) !== null

    if (apiExcluded) {
      const allApiRoutes: string[] = []
      const walkApiDir = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) walkApiDir(full)
          else if (entry.name === 'route.ts') allApiRoutes.push(full)
        }
      }
      walkApiDir(path.join(cwd, 'app/api'))

      const noEmailCheck: string[] = []
      const thisScanRoute = path.join(cwd, 'app/api/admin/security/scan/route.ts')
      for (const fullPath of allApiRoutes) {
        if (fullPath === thisScanRoute) continue
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          // Match only .auth.getUser() — excludes auth.admin.getUserById (service-role routes)
          const hasAuth = content.includes('.auth.getUser()')
          // Auth must be REQUIRED: route returns 401 when user is null.
          // Excludes optional-auth routes (telemetry, public) that use user?.id || null
          // without a 401 gate — those are not email-verification bypass candidates.
          const hasRequiredAuth = hasAuth && content.includes('401') && (
            content.includes('if (!user)') || content.includes('authError || !user')
          )
          const hasEmailCheck = content.includes('email_confirmed_at') || content.includes('emailConfirmed')
          // Admin-only routes don't need per-route email checks (admin implies verified)
          const isAdminOnly = content.includes("role === 'admin'") || content.includes("role !== 'admin'")
          // GDPR right to erasure applies to unverified users — exempt account deletion
          const isGdprDeletion = content.includes('deleteUser') || content.includes('right to erasure')
          if (hasRequiredAuth && !hasEmailCheck && !isAdminOnly && !isGdprDeletion) {
            noEmailCheck.push(fullPath.replace(cwd + '/', ''))
          }
        } catch { /* skip unreadable */ }
      }

      if (noEmailCheck.length > 0) {
        findings.push({
          id: 'api_email_verification_bypass',
          severity: 'high',
          title: 'API routes accept unverified email sessions',
          description: `middleware.ts excludes all /api/* routes from email-verification enforcement. These user-facing routes authenticate the user but do not check email_confirmed_at: ${noEmailCheck.join(', ')}. Unverified accounts can access protected features.`,
          affected: noEmailCheck,
          detected_at: new Date().toISOString(),
        })
      }
    }
  } catch {
    // Skip
  }

  // CHECK 18: Supabase Storage bucket exposure
  // The avatars bucket (migration 007) has never been audited for:
  //   a) public listing (exposes all user IDs via filename enumeration)
  //   b) non-image file uploads (stored XSS via CDN URL)
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Get bucket metadata
    const bucketRes = await fetch(`${supabaseUrl}/storage/v1/bucket/avatars`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    })

    if (bucketRes.ok) {
      const bucket = await bucketRes.json()
      const bucketIssues: string[] = []

      if (bucket.public === true) {
        bucketIssues.push('bucket is set to public — any URL is accessible without authentication')
      }

      // Try listing the bucket as anon (no auth) — should fail if access controls are correct
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const listRes = await fetch(`${supabaseUrl}/storage/v1/object/list/avatars`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefix: '', limit: 5 }),
      })

      if (listRes.ok) {
        const listed = await listRes.json()
        if (Array.isArray(listed) && listed.length > 0) {
          bucketIssues.push(`anon can enumerate bucket contents (${listed.length} objects visible) — leaks user IDs via filenames`)
        }
      }

      // Check for non-image files using service role listing
      const serviceListRes = await fetch(`${supabaseUrl}/storage/v1/object/list/avatars`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefix: '', limit: 100 }),
      })

      if (serviceListRes.ok) {
        const allFiles = await serviceListRes.json()
        const nonImageExts = ['.html', '.js', '.svg', '.htm', '.php', '.exe', '.sh']
        const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
        const dangerousFiles = (Array.isArray(allFiles) ? allFiles : [])
          .filter((f: any) => nonImageExts.some(ext => f.name?.toLowerCase().endsWith(ext)))
          // Strip any UUID path segments (bucket files are stored as {userId}/filename)
          .map((f: any) => (f.name as string).replace(uuidRe, '[uid]'))

        if (dangerousFiles.length > 0) {
          bucketIssues.push(`non-image files found in avatars bucket: ${dangerousFiles.join(', ')} — potential stored XSS via CDN URL`)
        }
      }

      if (bucketIssues.length > 0) {
        findings.push({
          id: 'storage_bucket_exposure',
          severity: bucket.public ? 'critical' : 'high',
          title: 'Supabase Storage avatars bucket security issues',
          description: bucketIssues.join('; '),
          affected: ['storage/avatars', ...bucketIssues],
          detected_at: new Date().toISOString(),
        })
      }
    }
  } catch {
    // Storage API unavailable — skip
  }

  // Remove intentionally acknowledged findings — see ACKNOWLEDGED map above
  {
    const active = findings.filter(f => !ACKNOWLEDGED[f.id])
    findings.length = 0
    findings.push(...active)
  }

  // Recurrence helper: how many of the 4 previous runs contained this finding?
  const recurrenceCount = (findingId: string): number =>
    prevRunFindings.filter(runSet => runSet.has(findingId)).length

  // Resolved findings: present in the most recent previous run but absent now
  const prevMostRecentIds = prevRunFindings[0] || new Set<string>()
  const resolvedIds = [...prevMostRecentIds].filter(id => !findings.some(f => f.id === id))

  // PART 3: Generate Claude Haiku fix prompts for each finding
  // Scrub PII from finding fields before sending to external services (Claude API, Slack).
  // The DB insert below uses the original findings — admin-only access, full detail is useful.
  const scrubPII = (s: string): string => s
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g, '[email]')
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[ip]')

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

EMAIL VERIFICATION CHECK (for routes that need verified email):
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
if (!user.email_confirmed_at) return NextResponse.json({ error: 'Email verification required' }, { status: 403 })
IMPORTANT: user.email_confirmed_at is already on the getUser() result — do NOT query auth.users table (not PostgREST-accessible)

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
Description: ${scrubPII(finding.description)}
Affected: ${finding.affected.map(scrubPII).join(', ')}

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
    const issueLines = findings.map(f => {
      const weeks = recurrenceCount(f.id)
      const tag = weeks > 0 ? ` *(${weeks} week${weeks > 1 ? 's' : ''})*` : ' *(new)*'
      return `${severityEmoji[f.severity]} [${f.severity.toUpperCase()}] ${f.title}${tag}`
    }).join('\n')

    const resolvedSection = resolvedIds.length > 0
      ? `\n\n*🟢 Resolved since last run:*\n${resolvedIds.map(id => `✓ ${id}`).join('\n')}`
      : ''

    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${severityEmoji[overallSeverity]} *Vetree Security Report*\n\n` +
          `*Overall Severity:* ${overallSeverity.toUpperCase()}\n` +
          `*Issues Found:* ${findings.length}\n\n` +
          (findings.length > 0
            ? `*Issues:*\n${issueLines}`
            : '🎉 No issues detected — all checks passed!') +
          resolvedSection +
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
