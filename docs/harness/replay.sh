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
OUT=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/replay-$MODE.XXXXXX")
NAME="replay-$MODE-$$"

for v in SUPABASE_URL NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD DATABASE_URL PGHOST; do
  if [ -n "${!v:-}" ]; then echo "replay: UNVERIFIED — $v is set; the replay never talks to production (unset it)"; exit 2; fi
done

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
fail2() { echo "replay ($MODE): UNVERIFIED — $*"; [ -n "${SHOW_LOG:-}" ] && docker logs "$NAME" 2>&1 | tail -40; exit 2; }

echo "== replay ($MODE defaults) on $IMAGE"
docker run -d --name "$NAME" --network none -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null || fail2 "image did not start"
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -q 2>/dev/null && break; sleep 2; done
docker exec "$NAME" pg_isready -U postgres -q || fail2 "database not ready"
# the image restarts once after its init scripts; wait for a stable connection
for _ in $(seq 1 30); do docker exec "$NAME" psql -U postgres -d postgres -qAtc 'select 1' >/dev/null 2>&1 && break; sleep 2; done

# q: as postgres (the role db push runs migrations as; it owns every public object in production)
# qsu: as supabase_admin (the image's superuser), only for setup the postgres role may not do
q()   { docker exec -i "$NAME" psql -U postgres       -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
qsu() { docker exec -i "$NAME" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }

# Every default-privilege entry, one line each (role · schema|global · type · acl) — compared before / after
dacl() { q -c "select pg_get_userbyid(d.defaclrole) || ' · ' || coalesce(n.nspname, '(global)') || ' · ' || d.defaclobjtype || ' · ' || d.defaclacl::text
               from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace order by 1"; }

# ---- simulate the default privileges
if [ "$MODE" = new ]; then
  # Remove every grant to the four roles from table / sequence default privileges, for every creator role and scope
  qsu <<'SQL' || fail2 "could not clear the default privileges"
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
q -c "create table public.__replay_probe (id serial)" || fail2 "probe table could not be created"
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
    grep -m1 -E 'ERROR' "$OUT/migrate.log" | sed 's/^/  /' | cut -c1-300
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

# ---- the default privileges are what this simulation set, untouched by every migration
dacl > "$OUT/defaults-after.txt"
if cmp -s "$OUT/defaults-before.txt" "$OUT/defaults-after.txt"; then
  echo "default privileges: unchanged by the migrations ($(wc -l < "$OUT/defaults-after.txt" | tr -d ' ') entries, $MODE defaults)"
else
  echo "default privileges: CHANGED by a migration ($(diff "$OUT/defaults-before.txt" "$OUT/defaults-after.txt" | grep -c '^[<>]') line(s)) — review before accepting"
  [ $rc -lt 1 ] && rc=1
fi

# ---- the report functions stay denied to the API roles
for role in anon authenticated; do
  for fn in harness_acl_report harness_rls_report harness_schema_report; do
    if q -c "set role $role; select 1 from public.$fn() limit 1" >/dev/null 2>&1; then
      echo "replay ($MODE): $role can call $fn() — must be service role only"; [ $rc -lt 1 ] && rc=1
    fi
  done
done

[ "$rc" = 0 ] && echo "replay ($MODE): PASS — a rebuild from supabase/migrations/ matches production's snapshots" \
              || echo "replay ($MODE): exit $rc"
exit "$rc"
