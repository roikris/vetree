#!/usr/bin/env bash
# docs/harness/replay.sh <new|old> — infra-003: rebuild the database from supabase/migrations/ on an EMPTY, pinned
# Supabase Postgres image and check it matches production's snapshots (supabase/access.json, rls.json, schema.json).
#
#   new  — simulate Supabase's 2026-10-30 change: before any migration, no default privilege grants anything on
#          tables / sequences to anon, authenticated, service_role or PUBLIC (proved with a probe table)
#   old  — the image's own (old) default privileges, as when every migration so far ran on production
#
# Local Docker only, never production: the container runs with --network none, psql connects over its Unix socket
# inside the container, and the script refuses to start when any Supabase credential is in its environment.
# Output: names, counts, short hashes (the audits' rules) — never database text. Exit 0 = matches, 1 = differs,
# 2 = could not check (setup, preflight, probe, a migration failing).
set -euo pipefail

MODE=${1:-}
case "$MODE" in new|old) ;; *) echo "usage: replay.sh <new|old>"; exit 2 ;; esac
IMAGE=${PG_IMAGE:-supabase/postgres:17.6.1.063}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
H="$ROOT/docs/harness"
# REPLAY_OUT: where the rebuilt database's reports go (CI uploads them — they hold only what the repo's own
# migration files define, never production data)
OUT=${REPLAY_OUT:-$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/replay-$MODE.XXXXXX")}
mkdir -p "$OUT"
NAME="replay-$MODE-$$"

for v in SUPABASE_URL NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD DATABASE_URL PGHOST; do
  if [ -n "${!v:-}" ]; then echo "replay: UNVERIFIED — $v is set; the replay never talks to production (unset it)"; exit 2; fi
done

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
fail2() { echo "replay ($MODE): UNVERIFIED — $*"; [ -n "${SHOW_LOG:-}" ] && docker logs "$NAME" 2>&1 | tail -40; exit 2; }

echo "== replay ($MODE defaults) on $IMAGE"
docker run -d --name "$NAME" --network none -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null || fail2 "image did not start"
# The image's init runs a temporary server on the Unix socket only, then restarts; the real server is the one that
# listens on loopback — wait for that, or setup races the restart.
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h 127.0.0.1 -q 2>/dev/null && break; sleep 2; done
docker exec "$NAME" pg_isready -U postgres -h 127.0.0.1 -q || fail2 "database not ready"

# q: as postgres (the role db push runs migrations as; it owns every public object in production)
# qsu: as supabase_admin (the image's superuser), only for setup the postgres role may not do
q()   { docker exec -i "$NAME" psql -U postgres       -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
qsu() { docker exec -i "$NAME" psql -U supabase_admin -h 127.0.0.1 -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }  # loopback inside the container

# Every default-privilege entry, one line each (role · schema|global · type · acl) — compared before / after
dacl() { q -c "select pg_get_userbyid(d.defaclrole) || ' · ' || coalesce(n.nspname, '(global)') || ' · ' || d.defaclobjtype::text || ' · ' || d.defaclacl::text
               from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace order by 1"; }

# ---- environment the image lacks but migrations need (not compared — see the file)
qsu < "$H/test/replay/storage-stub.sql" 2>"$OUT/err" || fail2 "storage stand-in failed: $(grep -m1 -E 'ERROR|FATAL' "$OUT/err" | cut -c1-240)"
qsu < "$H/test/replay/platform.sql" 2>"$OUT/err" || fail2 "platform settings failed: $(grep -m1 -E 'ERROR|FATAL' "$OUT/err" | cut -c1-240)"

# ---- simulate the default privileges
if [ "$MODE" = new ]; then
  # Remove every grant to the four roles from table / sequence default privileges, for every creator role and scope
  qsu 2>"$OUT/err" <<'SQL' || fail2 "could not clear the default privileges: $(grep -m1 -E 'ERROR|FATAL' "$OUT/err" | cut -c1-240)"
DO $$
DECLARE d record; s text;
BEGIN
  FOR d IN SELECT pg_get_userbyid(defaclrole) AS role, n.nspname AS schema, defaclobjtype AS t
           FROM pg_default_acl LEFT JOIN pg_namespace n ON n.oid = defaclnamespace
           WHERE defaclobjtype IN ('r', 'S') LOOP
    s := format('ALTER DEFAULT PRIVILEGES FOR ROLE %I %s REVOKE ALL ON %s FROM anon, authenticated, service_role, PUBLIC',
                d.role, CASE WHEN d.schema IS NULL THEN '' ELSE format('IN SCHEMA %I', d.schema) END,
                CASE d.t WHEN 'r' THEN 'TABLES' ELSE 'SEQUENCES' END);
    EXECUTE s;
  END LOOP;
END $$;
SQL
  left=$(q -c "select count(*) from pg_default_acl d, aclexplode(d.defaclacl) a
               where d.defaclobjtype in ('r','S') and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon','authenticated','service_role'))")
  [ "$left" = 0 ] || fail2 "$left default-privilege grant(s) to anon / authenticated / service_role / PUBLIC remain"
fi
dacl > "$OUT/defaults-before.txt"

# ---- probe: what does a new table / sequence created by postgres in public get, before any migration?
q -c "create table public.__replay_probe (id serial)" 2>"$OUT/err" || fail2 "probe table could not be created: $(grep -m1 -E 'ERROR|FATAL' "$OUT/err" | cut -c1-240)"
probe=$(q -c "select count(*) from pg_class c, aclexplode(coalesce(c.relacl, acldefault(case when c.relkind = 'S' then 's' else 'r' end::\"char\", c.relowner))) a
              where c.oid in ('public.__replay_probe'::regclass, 'public.__replay_probe_id_seq'::regclass)
                and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon','authenticated','service_role'))")
q -c "drop table public.__replay_probe"
if [ "$MODE" = new ]; then
  [ "$probe" = 0 ] || fail2 "probe: a new table / sequence still gets $probe grant(s) to the API roles — the simulation is wrong"
  echo "probe: a new table + sequence get no grants to anon / authenticated / service_role / PUBLIC (2026-10-30 defaults)"
else
  [ "$probe" -gt 0 ] || fail2 "probe: a new table gets no API-role grants — the image's old defaults are not active"
  echo "probe: a new table + sequence get $probe grant(s) to the API roles (old defaults)"
fi

# ---- apply every migration, in order, as postgres, each file in one transaction (as db push does)
n=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  base=$(basename "$f")
  if ! q -1 < "$f" > "$OUT/migrate.log" 2>&1; then
    echo "replay ($MODE): migration $base FAILED — first error:"
    tail -6 "$OUT/migrate.log" | sed 's/^/  /' | cut -c1-300
    exit 2
  fi
  n=$((n + 1))
done
echo "applied $n migrations"

# ---- the three reports, as service_role (what the audits read in production)
q -c "set role service_role; select coalesce(json_agg(r), '[]') from public.harness_acl_report() r" > "$OUT/acl.json"
q -c "set role service_role; select coalesce(json_agg(r), '[]') from public.harness_rls_report() r" > "$OUT/rls.json"
q -c "set role service_role; select public.harness_schema_report()" > "$OUT/schema.json"

# worst exit code wins: 2 (could not check) > 1 (differs) > 0
rc=0
worst() { local r=0; "$@" || r=$?; [ "$r" -gt "$rc" ] && rc=$r; return 0; }
worst node "$H/harness.mjs" acl-audit --report "$OUT/acl.json"
worst node "$H/harness.mjs" rls-audit --report "$OUT/rls.json"
# default privileges differ from production by design in each mode: checked below, not against schema.json
worst node "$H/harness.mjs" schema-audit --report "$OUT/schema.json" --skip-default-privileges

# ---- the default privileges stay what this simulation set: no entry removed or changed by a migration; an entry
# ADDED (e.g. by CREATE EXTENSION pg_cron's Supabase hook, in schema cron) must be outside public, grant nothing to
# anon / authenticated / service_role / PUBLIC, and exist in production too (supabase/schema.json)
dacl > "$OUT/defaults-after.txt"
dp=0
node - "$OUT/defaults-before.txt" "$OUT/defaults-after.txt" "$ROOT/supabase/schema.json" <<'JS' || dp=$?
const fs = require('fs')
const [before, after, schema] = process.argv.slice(2).map(f => fs.readFileSync(f, 'utf8'))
const lines = t => t.split('\n').filter(Boolean)
const b = new Set(lines(before)), a = new Set(lines(after))
const facts = JSON.parse(schema).facts
const removed = [...b].filter(l => !a.has(l)), added = [...a].filter(l => !b.has(l))
let bad = removed.map(l => `removed or changed: ${l.split(' · ').slice(0, 3).join(' · ')}`)
for (const l of added) {
  const [role, schemaName, type, acl] = l.split(' · ')
  const grantees = (acl.match(/(?:^\{|,)("?)([^=,"]*)\1=/g) || []).map(g => g.replace(/^[{,]"?|"?=$/g, ''))
  const at = `${role} · ${schemaName} · ${type}`
  if (schemaName === 'public') bad.push(`added in public: ${at}`)
  if (grantees.some(g => g === '' || ['anon', 'authenticated', 'service_role'].includes(g))) bad.push(`added, grants to an API role or PUBLIC: ${at}`)
  if (!(`default privileges ${JSON.stringify([role, schemaName === '(global)' ? null : schemaName, type])} · present` in facts)) bad.push(`added, not in production: ${at}`)
}
for (const x of bad) console.log(`default privileges: ${x}`)
console.log(`default privileges: ${b.size} before, ${a.size} after${bad.length ? '' : ` (${added.length} added by migrations, each also in production and outside public)`}`)
process.exit(bad.length ? 1 : 0)
JS
[ "$dp" -gt "$rc" ] && rc=$dp

# ---- the report functions stay denied to the API roles
for role in anon authenticated; do
  for fn in harness_acl_report harness_rls_report harness_schema_report; do
    if q -c "set role $role; select 1 from public.$fn() limit 1" >/dev/null 2>&1; then
      echo "replay ($MODE): $role can call $fn() — must be service role only"; [ $rc -lt 1 ] && rc=1
    fi
  done
done

# ---- self-check (REPLAY_SELFCHECK=1): the compare must SEE real catalog changes. Each change runs in a transaction
# on the rebuilt database, the report is read inside it, then it is rolled back; the audit must fail every time.
if [ "${REPLAY_SELFCHECK:-}" = 1 ] && [ "$rc" = 0 ]; then
  idx=$(q -c "select i.indexrelid::regclass from pg_index i join pg_class c on c.oid = i.indrelid
              where c.relnamespace = 'public'::regnamespace and not exists (select 1 from pg_constraint k where k.conindid = i.indexrelid)
              order by 1 limit 1")
  sc=0
  check() {  # check <expected exit> <label> <sql>
    local want=$1 label=$2 sql=$3 got=0
    q -c "begin; $sql; set role service_role; select public.harness_schema_report(); rollback" > "$OUT/mut.json" 2>"$OUT/err" || { echo "  self-check: $label — the change itself failed"; sc=1; return; }
    node "$H/harness.mjs" schema-audit --report "$OUT/mut.json" --skip-default-privileges >/dev/null || got=$?
    if [ "$got" = "$want" ]; then echo "  self-check: $label → exit $got (caught)"; else echo "  self-check: $label → exit $got, want $want (MISSED)"; sc=1; fi
  }
  check 1 "column default changed"   "alter table public.articles alter column title set default 'x'"
  check 1 "grant option added"       "grant select on public.articles to anon with grant option"
  check 1 "trigger disabled"         "alter table public.articles disable trigger update_articles_updated_at"
  check 1 "routine EXECUTE granted"  "grant execute on function public.purge_expired_logs() to anon"
  check 1 "index dropped"            "drop index $idx"
  check 1 "NOT NULL added"           "alter table public.growth_tasks alter column scheduled_date set not null"
  check 1 "enum type added"          "create type public.replay_selfcheck as enum ('a')"
  check 1 "RLS forced"               "alter table public.articles force row level security"
  check 2 "rule added (uncovered)"   "create rule replay_selfcheck as on insert to public.page_views do also nothing"
  # 081 is atomic: a copy whose last statement fails leaves none of its grants behind
  q -c "revoke all on public.analytics_events from service_role" >/dev/null
  if { cat "$ROOT/supabase/migrations/081_service_role_explicit_grants.sql" | sed '$d'; echo "GRANT SELECT ON public.replay_no_such_table TO service_role;"; echo "COMMIT;"; } | q -1 >/dev/null 2>&1; then
    echo "  self-check: 081 with a failing statement applied — MISSED"; sc=1
  elif [ "$(q -c "select has_table_privilege('service_role', 'public.analytics_events', 'INSERT')")" = f ]; then
    echo "  self-check: 081 with a failing last statement → rolled back, no grant left (caught)"
  else
    echo "  self-check: 081 failed but left grants behind — not atomic (MISSED)"; sc=1
  fi
  [ "$sc" = 0 ] && echo "self-check: every planted change was caught" || { echo "self-check: FAIL"; rc=1; }
fi

[ "$rc" = 0 ] && echo "replay ($MODE): PASS — a rebuild from supabase/migrations/ matches production's snapshots" \
              || echo "replay ($MODE): exit $rc"
exit "$rc"
