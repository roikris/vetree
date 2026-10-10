#!/usr/bin/env bash
# Vetree session harness — start-of-session checks. See docs/harness/README.md and DESIGN.md.
#
#   docs/harness/init.sh                         state, then check
#   docs/harness/init.sh state                   repo info + set up / sync .harness-state/
#   docs/harness/init.sh check [--quick] [--item <id>]
#                                                deps + tsc + lint (ratchet) + build (unless --quick);
#                                                --item classifies red results against that item's WIP
#   docs/harness/init.sh lock <item-id|backlog> --agent <claude|codex>
#                                                take the session lock (refuses when any lock exists)
#   docs/harness/init.sh unlock "<handoff message>"
#                                                publish the handoff + release YOUR lock, one commit
#   docs/harness/init.sh --check-git             capability probe for Codex working sessions
#   docs/harness/init.sh --write-lint-baseline   regenerate docs/harness/lint-baseline.json
#
# Never runs Playwright, never runs `npm install`, never approves install scripts, never forces.
# Only `lock` / `unlock` publish: one commit on harness-state, built off-tree, pushed compare-and-swap. Exit codes: 0 ok · 1 check failed / regression · 2 stop (needs
# a human) · 3 possible transient (re-run once) · 10 expected WIP failure (continue the item).
# Written for bash 3.2 (macOS /bin/bash) as well as newer bash.
set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "init.sh: not inside a git repo"; exit 2; }
cd "$ROOT" || exit 2
H="docs/harness"
WT="$ROOT/.harness-state"
STATE_BRANCH="harness-state"
LOGDIR="$(git rev-parse --git-path harness)"
case "$LOGDIR" in /*) ;; *) LOGDIR="$ROOT/$LOGDIR" ;; esac   # absolute: lock / unlock run git -C .harness-state
mkdir -p "$LOGDIR"
ALLOWED="README.md vercel.json $H/primer.md $H/feature_list.json $H/session-log.md $H/session.lock"

say()  { printf '%s\n' "$*"; }
head_() { printf '\n== %s\n' "$*"; }
stop() { say "STOP: $*"; exit 2; }

# One state / lock / unlock at a time per checkout (harness-003): mkdir is atomic. Released by
# unlink + rmdir (a single file and an empty folder — never a recursive delete).
MUTEX="$LOGDIR/state-mutex"
MUTEX_OWNED=0
TMPIDX=""
cleanup() {
  if [ -n "$TMPIDX" ] && [ -f "$TMPIDX" ]; then unlink "$TMPIDX"; fi
  mutex_release
}
trap cleanup EXIT
mutex_take() { # $1 = command
  if mkdir "$MUTEX" 2>/dev/null; then
    MUTEX_OWNED=1
    printf 'pid: %s\ncommand: %s\nstarted: %s\n' "$$" "$1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$MUTEX/owner" || true
  else
    say "STATE MUTEX HELD: $MUTEX"
    if [ -f "$MUTEX/owner" ]; then sed 's/^/  /' "$MUTEX/owner"; else say "  (no owner file: it is starting right now, or crashed just after taking the mutex)"; fi
    stop "another init.sh state / lock / unlock is running in this checkout, or one crashed. Remove the folder $MUTEX only when no init.sh process is running (ps -ax | grep '[i]nit.sh')."
  fi
}
mutex_release() {
  if [ "$MUTEX_OWNED" = 1 ]; then
    if [ -f "$MUTEX/owner" ]; then unlink "$MUTEX/owner"; fi
    rmdir "$MUTEX" 2>/dev/null || say "warning: could not remove $MUTEX (not empty?) — remove it by hand"
    MUTEX_OWNED=0
  fi
}
# Test-only pause points (docs/harness/test/lock/selftest.sh); inert unless HARNESS_TEST_PAUSE_DIR is set.
test_pause() {
  local d="${HARNESS_TEST_PAUSE_DIR:-}" n=0
  { [ -n "$d" ] && [ -f "$d/pause-$1" ]; } || return 0
  : > "$d/at-$1"
  while [ ! -f "$d/go-$1" ]; do sleep 0.1; n=$((n + 1)); [ $n -lt 600 ] || stop "test pause '$1' timed out"; done
}

# ---------------------------------------------------------------- state
cmd_state() {
  mutex_take state
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
  mutex_release
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

# ---------------------------------------------------------------- lock / unlock (harness-003)
# Both: mutex → preliminary checks → sync (fetch + ff-only) → checks on the synced BASE → the new commit
# is built OFF-TREE (temporary index, commit-tree -p BASE) → pushed compare-and-swap (never forced; a
# remote change since the fetch makes it non-fast-forward) → only then the worktree adopts it with
# `reset --mixed` (moves HEAD + index, never touches file contents). Any failure before the push leaves
# the worktree, its index and local refs as they were after the sync.
LOCK="$H/session.lock"
STATE_FILES="primer.md feature_list.json session-log.md"
BASE=""
NEW=""
MOVED=0

check_dirty() { # $1: 0 = must be clean · 1 = only primer.md / feature_list.json / session-log.md modified
  local st line xy p ok bad=""
  st="$(git -C "$WT" status --porcelain --ignored --untracked-files=all)" || stop "git status failed in .harness-state"
  [ -n "$st" ] || return 0
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    xy="${line:0:2}"; p="${line:3}"; ok=0
    if [ "$1" = 1 ]; then
      case "$xy" in " M"|"M "|"MM")
        case "$p" in "$H/primer.md"|"$H/feature_list.json"|"$H/session-log.md") ok=1 ;; esac ;;
      esac
    fi
    [ $ok = 1 ] || bad="$bad
  $line"
  done <<EOF
$st
EOF
  [ -z "$bad" ] && return 0
  if [ "$1" = 1 ]; then
    stop "changes in .harness-state that unlock may not publish:$bad
  (unlock publishes only edits to primer.md, feature_list.json, session-log.md). Nothing changed."
  fi
  stop "lock needs a clean state worktree:$bad
  Nothing changed."
}

txn_begin() { # $1 = command, $2 = check_dirty mode
  mutex_take "$1"
  [ -d "$WT" ] || stop "no .harness-state — run docs/harness/init.sh state first"
  local top common_wt common_root ahead f bad=""
  top="$(git -C "$WT" rev-parse --show-toplevel 2>/dev/null)" || top=""
  [ "$top" = "$WT" ] || stop "$WT is not a git worktree — run init.sh state"
  common_wt="$(cd "$WT" && cd "$(git rev-parse --git-common-dir)" && pwd -P)" || stop "cannot resolve .harness-state's repository"
  common_root="$(cd "$(git rev-parse --git-common-dir)" && pwd -P)" || stop "cannot resolve this repository"
  [ "$common_wt" = "$common_root" ] || stop "$WT belongs to a different repository"
  [ "$(git -C "$WT" branch --show-current)" = "$STATE_BRANCH" ] || stop "$WT is not on $STATE_BRANCH"
  check_dirty "$2"
  ahead="$(git -C "$WT" rev-list --count "origin/$STATE_BRANCH..HEAD")" || stop "cannot compare .harness-state with origin/$STATE_BRANCH"
  [ "$ahead" = "0" ] || stop "unpushed state commits in .harness-state — see README 'Failed state push'. Nothing changed."
  git -C "$WT" fetch -q origin "$STATE_BRANCH" > "$LOGDIR/state-fetch.log" 2>&1 \
    || stop "git fetch failed ($(tail -1 "$LOGDIR/state-fetch.log")) — nothing changed"
  git -C "$WT" merge -q --ff-only "origin/$STATE_BRANCH" > "$LOGDIR/state-merge.log" 2>&1 \
    || stop "local state cannot fast-forward to origin/$STATE_BRANCH (diverged, or origin changed a file you edited) — nothing published; ask Roi"
  BASE="$(git -C "$WT" rev-parse "origin/$STATE_BRANCH")" || stop "cannot read origin/$STATE_BRANCH"
  [ "$(git -C "$WT" rev-parse HEAD)" = "$BASE" ] || stop "local state is not at origin/$STATE_BRANCH after the sync — nothing published"
  test_pause after-sync
  check_dirty "$2"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case " $ALLOWED " in *" $f "*) ;; *) bad="$bad
  $f" ;; esac
  done <<EOF
$(git -C "$WT" ls-tree -r --name-only "$BASE")
EOF
  [ -z "$bad" ] || stop "files outside the state allowlist on origin/$STATE_BRANCH:$bad
  — nothing published; tell Roi"
  node "$H/harness.mjs" vercel-ok "$WT/vercel.json" || stop "vercel.json on $STATE_BRANCH must disable deployments — nothing published"
  TMPIDX="$LOGDIR/state-index.$$"
  if [ -f "$TMPIDX" ]; then unlink "$TMPIDX"; fi
  GIT_INDEX_FILE="$TMPIDX" git -C "$WT" read-tree "$BASE" || stop "could not prepare the commit (read-tree) — nothing changed"
}

txn_publish() { # $1 = commit message; sets NEW
  local tree rc=0 remote
  tree="$(GIT_INDEX_FILE="$TMPIDX" git -C "$WT" write-tree)" || stop "could not build the commit (write-tree) — nothing changed"
  NEW="$(git -C "$WT" commit-tree "$tree" -p "$BASE" -m "$1")" || stop "could not build the commit (commit-tree) — nothing changed"
  [ "$(git -C "$WT" rev-parse "$NEW^")" = "$BASE" ] || stop "internal: the new commit's parent is not origin/$STATE_BRANCH — nothing changed"
  test_pause before-push
  git -C "$WT" push -q origin "$NEW:refs/heads/$STATE_BRANCH" > "$LOGDIR/state-push.log" 2>&1 || rc=$?
  if [ $rc != 0 ]; then
    say "push failed (exit $rc):"; sed -n '1,8p' "$LOGDIR/state-push.log" | sed 's/^/  /'
    # The push may have landed with its reply lost — and origin may have moved on since: decide by
    # ancestry on a fresh fetch, never by comparing the tip alone.
    if git -C "$WT" fetch -q origin "$STATE_BRANCH" > "$LOGDIR/state-fetch.log" 2>&1 \
       && remote="$(git -C "$WT" rev-parse "origin/$STATE_BRANCH")"; then
      if [ "$remote" = "$NEW" ]; then
        say "origin/$STATE_BRANCH is ${NEW:0:7} nevertheless — published"
      elif git -C "$WT" merge-base --is-ancestor "$NEW" "$remote" 2>/dev/null; then
        say "origin/$STATE_BRANCH contains ${NEW:0:7} — published, and origin has moved on since (${remote:0:7})"
        MOVED=1
      else
        stop "NOT published (origin/$STATE_BRANCH is at ${remote:0:7} and does not contain ${NEW:0:7}). Nothing changed locally. If origin moved, run init.sh state and read the lock; otherwise fix the reason above and re-run."
      fi
    else
      stop "could not read origin after the failed push — NOT KNOWN whether ${NEW:0:7} was published. Nothing changed locally. Run init.sh state and check the lock before anything else; unsure → tell Roi."
    fi
  fi
  [ "$MOVED" = 1 ] || git -C "$WT" update-ref "refs/remotes/origin/$STATE_BRANCH" "$NEW" || true
}

moved_exit() { # published, but origin moved on after it: the local state is adopted up to NEW only
  if [ "$MOVED" = 1 ]; then
    say "STOP: origin/$STATE_BRANCH moved on after this publish — run init.sh state and read the lock before continuing."
    exit 1
  fi
}

adopt_fail() { # $1 = remaining step
  say "PUBLISHED $NEW to origin/$STATE_BRANCH, but updating .harness-state failed."
  say "Recover (inside .harness-state): git reset --mixed $NEW && $1"
  exit 1
}

cmd_lock() {
  local item="" agent="" agent_name hex id content blob
  while [ $# -gt 0 ]; do
    case "$1" in
      --agent) agent="${2:-}"; [ $# -ge 2 ] && shift ;;
      -*) stop "unknown option for lock: $1" ;;
      *) [ -z "$item" ] || stop "lock takes one item id"; item="$1" ;;
    esac
    shift
  done
  [ -n "$item" ] || stop "usage: init.sh lock <item-id|backlog> --agent <claude|codex>"
  case "$item" in *[!a-z0-9-]*) stop "item id '$item': only a-z, 0-9 and '-'" ;; esac
  case "$agent" in claude) agent_name="Claude Code" ;; codex) agent_name="Codex" ;; *) stop "--agent must be claude or codex" ;; esac
  txn_begin lock 0
  if git -C "$WT" cat-file -e "$BASE:$LOCK" 2>/dev/null; then
    say "LOCK HELD:"; git -C "$WT" show "$BASE:$LOCK" | sed 's/^/  /'
    stop "a session lock already exists — whoever owns it, this session included. It is never replaced; a stale lock is removed only on Roi's word."
  fi
  if [ "$item" != "backlog" ]; then
    git -C "$WT" show "$BASE:$H/feature_list.json" > "$LOGDIR/state-features.json" 2>/dev/null || stop "cannot read feature_list.json on origin"
    node -e 'const f=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).features||[];process.exit(f.some(x=>x&&x.id===process.argv[2])?0:1)' \
      "$LOGDIR/state-features.json" "$item" || stop "unknown item '$item' (not in feature_list.json) — use 'backlog' for a backlog session"
  fi
  hex="$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n')" || stop "cannot read /dev/urandom"
  [ ${#hex} = 4 ] || stop "could not make a session id"
  id="$(date -u +%Y%m%d-%H%M)-$agent-$hex"
  content="$(printf 'session: %s\nagent: %s\nstarted: %s\nitem: %s' "$id" "$agent_name" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$item")"
  blob="$(printf '%s\n' "$content" | git -C "$WT" hash-object -w --stdin)" || stop "could not write the lock (hash-object) — nothing changed"
  GIT_INDEX_FILE="$TMPIDX" git -C "$WT" update-index --add --cacheinfo "100644,$blob,$LOCK" || stop "could not stage the lock — nothing changed"
  txn_publish "state: lock $id; item $item"
  git -C "$WT" reset -q --mixed "$NEW" || adopt_fail "git checkout -- $LOCK"
  git -C "$WT" checkout -q -- "$LOCK" || adopt_fail "git checkout -- $LOCK"
  moved_exit
  say "lock taken: $id (item $item) — pushed ${NEW:0:7}"
  say "now run:  export HARNESS_SESSION=$id"
}

cmd_unlock() {
  local msg="${1:-}" me="${HARNESS_SESSION:-}" owner f blob
  { [ $# = 1 ] && [ -n "$msg" ]; } || stop "usage: init.sh unlock \"<handoff message>\""
  [ -n "$me" ] || stop "HARNESS_SESSION is not set — export HARNESS_SESSION=<your session id>. Nothing changed."
  txn_begin unlock 1
  git -C "$WT" cat-file -e "$BASE:$LOCK" 2>/dev/null || stop "no session lock on origin/$STATE_BRANCH — nothing to release (already released, or never taken). Nothing changed."
  owner="$(git -C "$WT" show "$BASE:$LOCK" | awk '/^session: /{print $2; exit}')"
  if [ "$owner" != "$me" ]; then
    say "LOCK HELD:"; git -C "$WT" show "$BASE:$LOCK" | sed 's/^/  /'
    stop "the lock belongs to '${owner:-?}', not $me — never release another session's lock. Nothing changed."
  fi
  grep -qF "### Session $me · " "$WT/$H/session-log.md" \
    || stop "no entry '### Session $me · …' in session-log.md — write the session entry first (README 'Before you stop'). Nothing changed."
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$WT/$H/feature_list.json" 2>/dev/null \
    || stop "feature_list.json is not valid JSON — fix it first. Nothing changed."
  for f in $STATE_FILES; do
    blob="$(git -C "$WT" hash-object -w -- "$H/$f")" || stop "could not read $f — nothing changed"
    GIT_INDEX_FILE="$TMPIDX" git -C "$WT" update-index --add --cacheinfo "100644,$blob,$H/$f" || stop "could not stage $f — nothing changed"
  done
  GIT_INDEX_FILE="$TMPIDX" git -C "$WT" update-index --force-remove "$LOCK" || stop "could not stage the lock removal — nothing changed"
  txn_publish "$msg"
  git -C "$WT" reset -q --mixed "$NEW" || adopt_fail "unlink $LOCK"
  # After the reset the lock file is untracked (perhaps even ignored): remove exactly that file.
  if [ -e "$WT/$LOCK" ]; then unlink "$WT/$LOCK" || adopt_fail "unlink $LOCK"; fi
  [ ! -e "$WT/$LOCK" ] || adopt_fail "unlink $LOCK"
  moved_exit
  say "lock released: $me — handoff pushed ${NEW:0:7}"
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
  lock)                  shift; cmd_lock "$@" ;;
  unlock)                shift; cmd_unlock "$@" ;;
  --check-git)           cmd_check_git ;;
  --write-lint-baseline) cmd_write_lint_baseline ;;
  *) stop "unknown command: $1 (see the header of $H/init.sh)" ;;
esac
