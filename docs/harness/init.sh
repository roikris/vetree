#!/usr/bin/env bash
# Vetree session harness — start-of-session checks. See docs/harness/README.md and DESIGN.md.
#
#   docs/harness/init.sh                         state, then check
#   docs/harness/init.sh state                   repo info + set up / sync .harness-state/
#   docs/harness/init.sh check [--quick] [--item <id>]
#                                                deps + tsc + lint (ratchet) + build (unless --quick);
#                                                --item classifies red results against that item's WIP
#   docs/harness/init.sh --check-git             capability probe for Codex working sessions
#   docs/harness/init.sh --write-lint-baseline   regenerate docs/harness/lint-baseline.json
#
# Never runs Playwright, never pushes, never runs `npm install`, never approves install scripts,
# never deletes or forces anything. Exit codes: 0 ok · 1 check failed / regression · 2 stop (needs
# a human) · 3 possible transient (re-run once) · 10 expected WIP failure (continue the item).
# Written for bash 3.2 (macOS /bin/bash) as well as newer bash.
set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "init.sh: not inside a git repo"; exit 2; }
cd "$ROOT" || exit 2
H="docs/harness"
WT="$ROOT/.harness-state"
STATE_BRANCH="harness-state"
LOGDIR="$(git rev-parse --git-path harness)"
mkdir -p "$LOGDIR"
ALLOWED="README.md vercel.json $H/primer.md $H/feature_list.json $H/session-log.md $H/session.lock"

say()  { printf '%s\n' "$*"; }
head_() { printf '\n== %s\n' "$*"; }
stop() { say "STOP: $*"; exit 2; }

# ---------------------------------------------------------------- state
cmd_state() {
  head_ "Repo"
  say "root:    $ROOT"
  say "branch:  $(git branch --show-current || echo '(detached)')"
  say "HEAD:    $(git rev-parse --short HEAD)"
  say "dirty:   $(git status --porcelain | wc -l | tr -d ' ') file(s)"
  if git fetch -q origin 2>/dev/null; then
    say "behind origin/main: $(git rev-list --count HEAD..origin/main 2>/dev/null || echo '?')"
  else
    say "WARNING: git fetch failed (offline?) — remote state may be stale"
  fi

  head_ "State worktree ($WT)"
  local exclude; exclude="$(git rev-parse --git-path info/exclude)"
  mkdir -p "$(dirname "$exclude")"
  grep -qxF '/.harness-state/' "$exclude" 2>/dev/null || printf '/.harness-state/\n' >> "$exclude"
  git worktree prune

  git show-ref --verify -q "refs/remotes/origin/$STATE_BRANCH" \
    || stop "origin/$STATE_BRANCH does not exist — the state branch is not set up (see $H/README.md)"

  local elsewhere
  elsewhere="$(git worktree list --porcelain | awk -v b="branch refs/heads/$STATE_BRANCH" -v wt="$WT" '
    /^worktree /{p=substr($0,10)} $0==b && p!=wt {print p}')"

  if [ ! -e "$WT" ]; then
    [ -n "$elsewhere" ] && stop "$STATE_BRANCH is checked out in another worktree: $elsewhere
  It may be removed only if it has no uncommitted changes AND no unpushed commits
  (git -C '$elsewhere' status --porcelain; git -C '$elsewhere' log origin/$STATE_BRANCH..HEAD),
  and only with Roi's OK. Nothing was changed."
    if git show-ref --verify -q "refs/heads/$STATE_BRANCH"; then
      git worktree add -q "$WT" "$STATE_BRANCH" || stop "git worktree add failed"
    else
      git worktree add -q --track -b "$STATE_BRANCH" "$WT" "origin/$STATE_BRANCH" || stop "git worktree add failed"
    fi
    say "created worktree"
  else
    [ -d "$WT" ] || stop "$WT exists but is not a directory — move it aside, then re-run"
    local top common_wt common_root br
    top="$(git -C "$WT" rev-parse --show-toplevel 2>/dev/null)"
    [ "$top" = "$WT" ] || stop "$WT is not a git worktree — move it aside (do not delete it), then re-run"
    common_wt="$(cd "$WT" && cd "$(git rev-parse --git-common-dir)" && pwd -P)"
    common_root="$(cd "$(git rev-parse --git-common-dir)" && pwd -P)"
    [ "$common_wt" = "$common_root" ] || stop "$WT belongs to a different repository — move it aside, then re-run"
    br="$(git -C "$WT" branch --show-current)"
    [ "$br" = "$STATE_BRANCH" ] || stop "$WT is on branch '$br', expected $STATE_BRANCH — fix by hand (git -C .harness-state switch $STATE_BRANCH) after checking it is clean"
  fi

  if [ -n "$(git -C "$WT" status --porcelain)" ]; then
    git -C "$WT" status --short
    stop "uncommitted changes in .harness-state — possibly an unfinished handoff. Inspect, then commit or ask Roi."
  fi
  local ahead; ahead="$(git -C "$WT" rev-list --count "origin/$STATE_BRANCH..HEAD")"
  if [ "$ahead" != "0" ]; then
    say "unpushed state commits:"; git -C "$WT" log --oneline "origin/$STATE_BRANCH..HEAD"
    say "remote lock: $(git show "origin/$STATE_BRANCH:$H/session.lock" 2>/dev/null || echo '(none)')"
    stop "local state commits were never pushed (a failed lock / claim / handoff push). Do not discard them; see README 'Failed state push'."
  fi
  git -C "$WT" pull -q --ff-only || stop "git pull --ff-only failed in .harness-state — local and remote state diverged; ask Roi"

  local bad="" f
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case " $ALLOWED " in *" $f "*) ;; *) bad="$bad
  $f";; esac
  done <<EOF
$(git -C "$WT" ls-files; git -C "$WT" ls-files --others)
EOF
  [ -z "$bad" ] || stop "files outside the state allowlist in .harness-state:$bad
  (they could leak into tsc / eslint / next build — tsconfig.json and eslint.config.mjs don't exclude the folder)"
  node "$H/harness.mjs" vercel-ok "$WT/vercel.json" || stop "vercel.json on $STATE_BRANCH must disable deployments"

  say "state synced: $(git -C "$WT" log -1 --format='%h %s')"
  # A held lock stops the run (exit 2) unless it is this session's own: export HARNESS_SESSION=<id>
  # right after taking the lock, so re-running `state` mid-session still works.
  if [ -f "$WT/$H/session.lock" ]; then
    local owner; owner="$(awk '/^session:/{print $2}' "$WT/$H/session.lock")"
    if [ -n "$owner" ] && [ "${HARNESS_SESSION:-}" = "$owner" ]; then
      say "lock: held by this session ($owner)"
    else
      say "LOCK HELD:"; sed 's/^/  /' "$WT/$H/session.lock"
      stop "another session holds the lock (active, or crashed). Do not work; tell Roi. A stale lock is removed only on Roi's word."
    fi
  else
    say "lock: free"
  fi
}

# ---------------------------------------------------------------- check
deps() {
  head_ "Dependencies"
  local want have
  want="$(node "$H/harness.mjs" stamp "$ROOT")" || stop "could not compute install fingerprint"
  have="$(cat node_modules/.harness-install-stamp 2>/dev/null || true)"
  if [ -d node_modules ] && [ "$want" = "$have" ]; then
    say "node_modules up to date (node $(node -v), npm $(npm -v))"
  else
    say "installing: npm ci (lockfile, .npmrc, node or npm changed — or no stamp yet)"
    # Write to the log first: piping npm into `head` could SIGPIPE it and leave a half install.
    local rc=0
    npm ci --no-audit --no-fund > "$LOGDIR/npm-ci.log" 2>&1 || rc=$?
    grep -iE 'install-scripts|^npm (warn|error)' "$LOGDIR/npm-ci.log" | sed -n '1,20p'
    [ "$rc" = "0" ] || stop "npm ci failed (exit $rc) — see $LOGDIR/npm-ci.log"
    printf '%s\n' "$want" > node_modules/.harness-install-stamp
    say "note: npm may skip install scripts it has not been allowed to run — approving any is Roi's call"
  fi
}

run_timed() { # name, then the command
  local name="$1"; shift
  local t0 rc; t0=$(date +%s)
  "$@" > "$LOGDIR/$name.log" 2>&1; rc=$?
  say "$name: $([ $rc = 0 ] && echo PASS || echo "FAIL (exit $rc)")  $(( $(date +%s) - t0 ))s  log: $LOGDIR/$name.log"
  return $rc
}

cmd_check() {
  local quick=0 item=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --quick) quick=1 ;;
      --item) item="${2:-}"; shift ;;
      *) stop "unknown option for check: $1" ;;
    esac
    shift
  done
  # On the item's recorded WIP commit the build is skipped: it is red by design, and a build failure
  # can never be an expected one — tsc + lint decide (DESIGN.md, step 9). The next normal commit
  # still needs a GREEN build.
  # WIP mode needs ALL of: HEAD == the item's wip_sha, HEAD's subject starts "WIP (build red):",
  # and the current branch is the item's branch. A matching SHA with anything else inconsistent
  # stops (exit 2) — a wrong or hand-set wip_sha must never skip the build on an ordinary commit.
  local wipmode=0
  if [ -n "$item" ] && [ -f "$WT/$H/feature_list.json" ]; then
    local wsha wbranch; wsha="$(node -e 'const f=require(process.argv[1]).features||[];const it=f.find(x=>x.id===process.argv[2]);process.stdout.write((it&&it.wip_sha)||"")' "$WT/$H/feature_list.json" "$item")"
    wbranch="$(node -e 'const f=require(process.argv[1]).features||[];const it=f.find(x=>x.id===process.argv[2]);process.stdout.write((it&&it.branch)||"")' "$WT/$H/feature_list.json" "$item")"
    if [ -n "$wsha" ] && [ "$wsha" = "$(git rev-parse HEAD)" ]; then
      case "$(git log -1 --format=%s HEAD)" in
        "WIP (build red):"*) ;;
        *) stop "$item's wip_sha is HEAD, but HEAD is not a 'WIP (build red): …' commit — inconsistent WIP record; tell Roi" ;;
      esac
      [ -n "$wbranch" ] && [ "$wbranch" = "$(git branch --show-current)" ] \
        || stop "$item's wip_sha is HEAD, but the current branch '$(git branch --show-current)' is not the item's branch '$wbranch' — inconsistent WIP record; tell Roi"
      # The classification must describe the recorded WIP commit itself, not edits on top of it.
      local wst; wst="$(git status --porcelain --untracked-files=all)" \
        || stop "git status failed — cannot prove the tree is clean for WIP classification"
      [ -z "$wst" ] \
        || stop "uncommitted changes on top of $item's WIP commit — WIP classification needs a clean tree (commit them, or run 'init.sh check' without --item)"
      wipmode=1
    fi
  fi
  deps
  head_ "Checks on $(git branch --show-current || echo detached) @ $(git rev-parse --short HEAD)"
  { [ $quick = 1 ] || [ $wipmode = 1 ]; } || say "effects: next build READS production Supabase (sitemap, static article pages) — it writes nothing"
  rm -f "$LOGDIR"/*.sigs.json "$LOGDIR/failed-checks" "$LOGDIR/lint.json"
  local red=0 transient=0 tsc_red=0 lint_red=0 acl_block=0

  # sigs <check> — record a failed check and its signatures; a crash in the parser = unparsed.
  sigs() {
    printf '%s\n' "$1" >> "$LOGDIR/failed-checks"
    node "$H/harness.mjs" signatures "$1" "$LOGDIR/$1.log" "$LOGDIR/$1.sigs.json" >/dev/null \
      || printf '{"check":"%s","unparsed":true,"failures":[]}\n' "$1" > "$LOGDIR/$1.sigs.json"
  }

  local trc=0; run_timed tsc npx tsc --noEmit || trc=$?
  if [ $trc != 0 ]; then
    red=1; tsc_red=1; sigs tsc
    # tsc exits 1 or 2 when it reports diagnostics; anything else (a crash, a signal) is unparsed.
    case $trc in 1|2) ;; *) printf '{"check":"tsc","unparsed":true,"failures":[]}\n' > "$LOGDIR/tsc.sigs.json" ;; esac
  fi

  # eslint exits 1 on main because of the known errors (D9): 0/1 are normal, >=2 = eslint failed.
  local t0 erc=0; t0=$(date +%s)
  npx eslint --format json --output-file "$LOGDIR/lint.json" > "$LOGDIR/lint.log" 2>&1 || erc=$?
  say "lint: ran  $(( $(date +%s) - t0 ))s  eslint exit $erc  (verdict = ratchet below; raw JSON: $LOGDIR/lint.json)"
  local lrc=0
  if [ "$erc" -gt 1 ] || [ ! -s "$LOGDIR/lint.json" ]; then
    say "lint: eslint did not run successfully — see $LOGDIR/lint.log"; lrc=2
    printf '{"check":"lint","unparsed":true,"failures":[]}\n' > "$LOGDIR/lint.sigs.json"
  else
    node "$H/harness.mjs" lint-compare "$LOGDIR/lint.json" "$ROOT" "$H/lint-baseline.json" "$LOGDIR/lint.sigs.json" || lrc=$?
  fi
  case "$lrc" in
    0) say "lint ratchet: PASS (no errors beyond docs/harness/lint-baseline.json)" ;;
    1) say "lint ratchet: FAIL (new lint errors)"; red=1; lint_red=1; printf 'lint\n' >> "$LOGDIR/failed-checks" ;;
    *) say "lint ratchet: COULD NOT COMPARE (unparsed)"; red=1; lint_red=1; printf 'lint\n' >> "$LOGDIR/failed-checks"
       [ -s "$LOGDIR/lint.sigs.json" ] || printf '{"check":"lint","unparsed":true,"failures":[]}\n' > "$LOGDIR/lint.sigs.json" ;;
  esac

  # Access-control audit (infra-001): production's actual privileges vs supabase/access.json, exactly.
  # Every mode. A mismatch, or an unverified result that is not a network error, blocks: never
  # POSSIBLE TRANSIENT and never EXPECTED-WIP (classify rejects a failed 'acl' check).
  local arc=0
  node --env-file-if-exists=.env.local "$H/harness.mjs" acl-audit > "$LOGDIR/acl.log" 2>&1 || arc=$?
  case "$arc" in
    0) say "$(grep '^acl audit:' "$LOGDIR/acl.log")" ;;
    1) say "acl audit: FAIL — privileges differ from supabase/access.json:"; grep -E '^  (NEW|GONE|KIND|ACL) ' "$LOGDIR/acl.log" | sed -n '1,20p'
       red=1; acl_block=1; printf 'acl\n' >> "$LOGDIR/failed-checks" ;;
    *) red=1; printf 'acl\n' >> "$LOGDIR/failed-checks"
       if grep -q '^acl audit: UNVERIFIED — network:' "$LOGDIR/acl.log" && [ $tsc_red = 0 ] && [ $lint_red = 0 ]; then
         transient=1; say "$(grep '^acl audit:' "$LOGDIR/acl.log") — possible transient: re-run once"
       else
         acl_block=1; say "$(grep '^acl audit:' "$LOGDIR/acl.log")"; grep -E '^  ' "$LOGDIR/acl.log" | grep -v '^  info' | sed -n '1,10p'
       fi ;;
  esac

  if [ $wipmode = 1 ]; then
    say "build: skipped — HEAD is $item's recorded WIP commit (tsc + lint decide; build must be GREEN before the next normal commit)"
  elif [ $quick = 0 ]; then
    if ! run_timed build npm run build; then
      red=1; sigs build
      # Only the known Supabase/network blip counts as transient, and only when tsc + lint passed.
      if [ $tsc_red = 0 ] && [ $lint_red = 0 ] && [ $acl_block = 0 ] && \
         grep -qE '^[[:space:]]*\[?[A-Za-z]*Error\]?:? .*(sitemap: .* failed after [0-9]+ attempts|fetch failed|getaddrinfo ENOTFOUND|connect ETIMEDOUT|read ECONNRESET|socket hang up)' "$LOGDIR/build.log"; then
        transient=1
        say "build failure matches the known Supabase/network blip — possible transient: re-run once"
      fi
    fi
  else
    say "build: skipped (--quick)"
  fi

  head_ "Result"
  if [ $red = 0 ] && [ $wipmode = 1 ]; then
    say "EXPECTED-WIP: tsc + lint clean on $item's recorded WIP commit — build NOT run (this is never GREEN)"
    return 10
  fi
  if [ $red = 0 ]; then
    if [ $quick = 1 ]; then say "GREEN (quick — build not run)"
    else say "GREEN"; fi
    return 0
  fi
  if [ $transient = 1 ] && [ $acl_block = 0 ]; then say "POSSIBLE TRANSIENT — re-run once; a second exit 3 in a row = treat as a regression (controlled stop, tell Roi)"; return 3; fi
  if [ -n "$item" ]; then
    local fl="$WT/$H/feature_list.json"
    [ -f "$fl" ] || stop "--item given but $fl not found (run init.sh state first)"
    if node "$H/harness.mjs" classify "$LOGDIR" "$fl" "$item" "$(git rev-parse HEAD)"; then return 10; fi
    return 1
  fi
  say "RED — not classified (pass --item <id> when resuming a WIP item). Signatures: $LOGDIR/*.sigs.json"
  return 1
}

# ---------------------------------------------------------------- probes / tools
cmd_check_git() {
  head_ "Git capability probe (preliminary — the real proof is that the lock + claim commits push)"
  local probe; probe="$(git rev-parse --git-path harness-probe)"
  if printf 'probe\n' > "$probe" 2>/dev/null && rm -f "$probe"; then say "git metadata write: OK"; else stop "cannot write under .git — this sandbox cannot commit"; fi
  git fetch -q origin "$STATE_BRANCH" 2>/dev/null && say "fetch: OK" || stop "git fetch failed — no network or no auth in this sandbox"
  git push -q --dry-run origin "refs/remotes/origin/$STATE_BRANCH:refs/heads/$STATE_BRANCH" 2>/dev/null \
    && say "push (dry run): OK" || stop "git push --dry-run failed — this sandbox cannot publish state"
  say "probe passed"
}

cmd_write_lint_baseline() {
  head_ "Regenerating $H/lint-baseline.json"
  rm -f "$LOGDIR/lint.json"
  local erc=0; npx eslint --format json --output-file "$LOGDIR/lint.json" > "$LOGDIR/lint.log" 2>&1 || erc=$?
  { [ "$erc" -le 1 ] && [ -s "$LOGDIR/lint.json" ]; } || stop "eslint did not run successfully (exit $erc) — see $LOGDIR/lint.log"
  node "$H/harness.mjs" lint-baseline "$LOGDIR/lint.json" "$ROOT" "$H/lint-baseline.json"
}

case "${1:-}" in
  "")                    cmd_state; cmd_check ;;
  state)                 cmd_state ;;
  check)                 shift; cmd_check "$@" ;;
  --check-git)           cmd_check_git ;;
  --write-lint-baseline) cmd_write_lint_baseline ;;
  *) stop "unknown command: $1 (see the header of $H/init.sh)" ;;
esac
