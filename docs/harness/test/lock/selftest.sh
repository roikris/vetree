#!/usr/bin/env bash
# Offline tests for `init.sh lock` / `init.sh unlock` (harness-003) and the state mutex.
# Each case builds a throwaway origin (bare repo) + clones in a temp folder; nothing touches the
# real repository or the network. Run with the bash you want to verify:
#   /bin/bash docs/harness/test/lock/selftest.sh      # macOS bash 3.2
#   bash docs/harness/test/lock/selftest.sh           # CI
# Temp folders are left under $TMPDIR (the OS clears it); the path is printed.
set -u

SRC="$(cd "$(dirname "$0")/../../../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/harness-lock-test.XXXXXX")" || exit 2
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$T/gitconfig"
git config --file "$T/gitconfig" user.name "selftest"
git config --file "$T/gitconfig" user.email "selftest@example.invalid"
git config --file "$T/gitconfig" init.defaultBranch main
git config --file "$T/gitconfig" advice.detachedHead false
unset HARNESS_SESSION HARNESS_TEST_PAUSE_DIR
LK="docs/harness/session.lock"
PASS=0 FAIL=0 N=0 E=""

echo "lock selftest — bash $BASH_VERSION ($BASH) — temp: $T"

ok()   { PASS=$((PASS + 1)); }
bad()  { FAIL=$((FAIL + 1)); echo "  FAIL [$CASE]: $*"; [ -f "$E/out" ] && sed 's/^/      | /' "$E/out" | tail -6; }
is()   { if [ "$1" = "$2" ]; then ok; else bad "$3 (got '$1', want '$2')"; fi; }
has()  { if grep -qF -- "$2" "$1"; then ok; else bad "$3 (missing '$2')"; fi; }
case_() { CASE="$1"; }

# --- fixtures -------------------------------------------------------------------------------
new_env() { # fresh origin with main + harness-state, clone A with .harness-state set up
  N=$((N + 1)); E="$T/c$N"; mkdir -p "$E"
  git init -q --bare "$E/origin.git"
  git init -q "$E/seed"
  mkdir -p "$E/seed/docs/harness"
  cp "$SRC/docs/harness/init.sh" "$SRC/docs/harness/harness.mjs" "$E/seed/docs/harness/"
  git -C "$E/seed" add -A && git -C "$E/seed" commit -qm "main" && git -C "$E/seed" push -q "$E/origin.git" main
  git -C "$E/seed" switch -q --orphan harness-state
  git -C "$E/seed" rm -rfq --cached . >/dev/null 2>&1 || true
  git -C "$E/seed" clean -fdxq
  mkdir -p "$E/seed/docs/harness"
  printf '# state\n' > "$E/seed/README.md"
  printf '{ "git": { "deploymentEnabled": false } }\n' > "$E/seed/vercel.json"
  printf '# primer\n' > "$E/seed/docs/harness/primer.md"
  printf '{ "features": [ { "id": "x-001" } ] }\n' > "$E/seed/docs/harness/feature_list.json"
  printf '# log\n' > "$E/seed/docs/harness/session-log.md"
  git -C "$E/seed" add -A && git -C "$E/seed" commit -qm "state" && git -C "$E/seed" push -q "$E/origin.git" harness-state
  clone A
}
clone() { # $1 = name
  git clone -q "$E/origin.git" "$E/$1"
  ( cd "$E/$1" && "$BASH" docs/harness/init.sh state > "$E/clone-$1.out" 2>&1 ) || { echo "setup: state failed in $1"; cat "$E/clone-$1.out"; exit 2; }
}
run() { # $1 = clone, then init.sh args; env via VAR=… before `run`. Sets RC, output in $E/out
  local d="$1"; shift
  ( cd "$E/$d" && "$BASH" docs/harness/init.sh "$@" ) > "$E/out" 2>&1; RC=$?
}
seed_push() { # $1 = message: commit whatever is staged in seed (on harness-state, synced to origin) and push
  git -C "$E/seed" commit -qm "$1" && git -C "$E/seed" push -q "$E/origin.git" harness-state
}
seed_sync() { git -C "$E/seed" fetch -q "$E/origin.git" harness-state && git -C "$E/seed" reset -q --hard FETCH_HEAD; }
osha()  { git --git-dir="$E/origin.git" rev-parse harness-state; }
olock() { git --git-dir="$E/origin.git" show "harness-state:$LK" 2>/dev/null; }
wst()   { git -C "$E/$1/.harness-state" status --porcelain --ignored --untracked-files=all; }
whead() { git -C "$E/$1/.harness-state" rev-parse HEAD; }
sid()   { sed -n 's/^now run:  export HARNESS_SESSION=//p' "$E/out"; }
entry() { printf '\n### Session %s · today · test · x-001\n- done\n' "$2" >> "$E/$1/.harness-state/docs/harness/session-log.md"; }
bg() { # $1 = clone, $2 = pause point, rest = init.sh args (env before bg) — runs paused in the background
  local d="$1" pt="$2"; shift 2
  P="$E/pause"; mkdir -p "$P"; : > "$P/pause-$pt"
  ( cd "$E/$d" && HARNESS_TEST_PAUSE_DIR="$P" "$BASH" docs/harness/init.sh "$@" > "$E/bg.out" 2>&1; echo $? > "$E/bg.rc" ) &
  BGPID=$!
  local n=0; while [ ! -f "$P/at-$pt" ]; do sleep 0.1; n=$((n + 1)); [ $n -lt 300 ] || { bad "background never reached $pt"; cat "$E/bg.out"; return 1; }; done
}
resume() { : > "$P/go-$1"; wait "$BGPID"; BGRC="$(cat "$E/bg.rc")"; }

# --- lock -----------------------------------------------------------------------------------
case_ "lock: free lock"
new_env; before="$(osha)"
run A lock x-001 --agent claude
is "$RC" 0 "exit"; id="$(sid)"
case "$id" in [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]-claude-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ok ;; *) bad "id format '$id'" ;; esac
is "$(olock | sed -n 1p)" "session: $id" "origin lock line 1"
is "$(olock | sed -n 2p)" "agent: Claude Code" "origin lock line 2"
case "$(olock | sed -n 3p)" in "started: "????-??-??T??:??:??Z) ok ;; *) bad "started line" ;; esac
is "$(olock | sed -n 4p)" "item: x-001" "origin lock line 4"
is "$(olock | wc -l | tr -d ' ')" 4 "lock has 4 lines"
is "$(git --git-dir="$E/origin.git" rev-parse harness-state^)" "$before" "parent = previous origin"
is "$(whead A)" "$(osha)" "local adopted"
is "$(wst A)" "" "worktree clean"

case_ "lock: held by this session"
before="$(osha)"; HARNESS_SESSION="$id" run A lock x-001 --agent claude
is "$RC" 2 "exit"; has "$E/out" "LOCK HELD" "message"; is "$(osha)" "$before" "origin unchanged"

case_ "state after own lock (HARNESS_SESSION) / foreign"
HARNESS_SESSION="$id" run A state; is "$RC" 0 "own lock passes state"
run A state; is "$RC" 2 "lock without HARNESS_SESSION stops state"

case_ "lock: held only on origin (other clone)"
new_env; clone B; run B lock x-001 --agent codex; is "$RC" 0 "B locks"; after_b="$(osha)"
run A lock x-001 --agent claude
is "$RC" 2 "exit"; is "$(osha)" "$after_b" "origin unchanged"
is "$(whead A)" "$after_b" "A fast-forwarded by the sync (expected)"; is "$(wst A)" "" "A clean"

case_ "lock: empty / malformed lock file on origin"
new_env; seed_sync; : > "$E/seed/$LK"; git -C "$E/seed" add "$LK"; seed_push "empty lock"; before="$(osha)"
run A lock x-001 --agent claude; is "$RC" 2 "empty lock = held"; is "$(osha)" "$before" "origin unchanged"
seed_sync; printf 'garbage\n' > "$E/seed/$LK"; git -C "$E/seed" add "$LK"; seed_push "malformed lock"; before="$(osha)"
run A lock x-001 --agent claude; is "$RC" 2 "malformed lock = held"; is "$(osha)" "$before" "origin unchanged"

case_ "lock: argument checks"
new_env; before="$(osha)"
run A lock nope-999 --agent claude; is "$RC" 2 "unknown item"; has "$E/out" "unknown item" "message"
run A lock x-001 --agent gpt; is "$RC" 2 "bad agent"
run A lock x-001; is "$RC" 2 "missing agent"
run A lock 'x-001;rm' --agent claude; is "$RC" 2 "bad item characters"
is "$(osha)" "$before" "origin unchanged"; is "$(olock)" "" "no lock"

case_ "lock: backlog session"
run A lock backlog --agent codex; is "$RC" 0 "exit"; is "$(olock | sed -n 4p)" "item: backlog" "item line"
is "$(olock | sed -n 2p)" "agent: Codex" "agent line"

case_ "lock: mutex present (with / without owner file)"
new_env; before="$(osha)"; MX="$E/A/.git/harness/state-mutex"
mkdir "$MX"; run A lock x-001 --agent claude; is "$RC" 2 "no owner file"; has "$E/out" "no owner file" "message"
printf 'pid: 99999\ncommand: lock\n' > "$MX/owner"; run A lock x-001 --agent claude; is "$RC" 2 "owner file"; has "$E/out" "pid: 99999" "shows owner"
run A state; is "$RC" 2 "state refuses too"
is "$(osha)" "$before" "origin unchanged"; is "$([ -d "$MX" ] && echo kept)" kept "foreign mutex kept"

case_ "lock: dirty worktree"
new_env; before="$(osha)"; : > "$E/A/.harness-state/stray.txt"
run A lock x-001 --agent claude; is "$RC" 2 "untracked file"; is "$(osha)" "$before" "origin unchanged"

case_ "lock: origin introduces a foreign file / deployable vercel.json"
new_env; seed_sync; : > "$E/seed/evil.ts"; git -C "$E/seed" add evil.ts; seed_push "foreign"; before="$(osha)"
run A lock x-001 --agent claude; is "$RC" 2 "foreign file"; has "$E/out" "evil.ts" "names it"; is "$(osha)" "$before" "origin unchanged"
new_env; seed_sync; printf '{}\n' > "$E/seed/vercel.json"; git -C "$E/seed" add vercel.json; seed_push "deploys"; before="$(osha)"
run A lock x-001 --agent claude; is "$RC" 2 "vercel.json"; is "$(osha)" "$before" "origin unchanged"

case_ "lock: failed fetch"
new_env; git -C "$E/A" remote set-url origin "$E/missing.git"
run A lock x-001 --agent claude; is "$RC" 2 "exit"; has "$E/out" "git fetch failed" "message"
git -C "$E/A" remote set-url origin "$E/origin.git"; is "$(olock)" "" "no lock"

case_ "lock: push rejected by origin"
new_env; before="$(osha)"; lhead="$(whead A)"
printf '#!/bin/sh\necho "rejected by test hook" >&2\nexit 1\n' > "$E/origin.git/hooks/pre-receive"; chmod +x "$E/origin.git/hooks/pre-receive"
run A lock x-001 --agent claude
is "$RC" 2 "exit"; has "$E/out" "NOT published" "message"; has "$E/out" "rejected by test hook" "git's reason shown"
is "$(osha)" "$before" "origin unchanged"; is "$(whead A)" "$lhead" "local HEAD unchanged"; is "$(wst A)" "" "worktree clean"
run A state; is "$RC" 0 "state afterwards: fine (nothing local to recover)"; has "$E/out" "lock: free" "lock free"

case_ "lock: race — other clone locks between fetch and push"
new_env; clone B; lhead="$(whead A)"
bg A before-push lock x-001 --agent claude
run B lock x-001 --agent codex; is "$RC" 0 "B locks meanwhile"; b_sha="$(osha)"; b_lock="$(olock)"
resume before-push
is "$BGRC" 2 "A refused"; is "$(osha)" "$b_sha" "origin keeps B's commit"; is "$(olock)" "$b_lock" "B's lock intact"
is "$(whead A)" "$lhead" "A local unchanged"; is "$(wst A)" "" "A clean"

case_ "lock: same-worktree overlap (paused after sync)"
new_env
bg A after-sync lock x-001 --agent claude
run A state; is "$RC" 2 "state refused during lock"; has "$E/out" "STATE MUTEX HELD" "mutex message"
run A lock x-001 --agent codex; is "$RC" 2 "second lock refused"
HARNESS_SESSION=x run A unlock "msg"; is "$RC" 2 "unlock refused"
is "$(olock)" "" "nothing published yet"
resume after-sync; is "$BGRC" 0 "first lock completes"; has "$E/bg.out" "lock taken" "taken"
is "$(olock | sed -n 2p)" "agent: Claude Code" "the first lock won"
is "$([ -d "$E/A/.git/harness/state-mutex" ] && echo left || echo gone)" gone "mutex released"

# --- unlock ---------------------------------------------------------------------------------
lock_A() { run A lock x-001 --agent claude; [ "$RC" = 0 ] || { bad "setup lock"; return 1; }; ME="$(sid)"; }

case_ "unlock: owner, unstaged edits"
new_env; lock_A; printf 'edited\n' >> "$E/A/.harness-state/docs/harness/primer.md"; entry A "$ME"
HARNESS_SESSION="$ME" run A unlock "state: handoff"
is "$RC" 0 "exit"; is "$(olock)" "" "lock gone on origin"
has "$E/out" "lock released" "message"
is "$(git --git-dir="$E/origin.git" show harness-state:docs/harness/primer.md | tail -1)" "edited" "edit published"
is "$(git --git-dir="$E/origin.git" log -1 --format=%s harness-state)" "state: handoff" "message used"
is "$(git --git-dir="$E/origin.git" diff --name-only harness-state^ harness-state | sort | tr '\n' ' ')" \
   "docs/harness/primer.md docs/harness/session-log.md docs/harness/session.lock " "one commit: edits + release"
is "$(wst A)" "" "worktree clean"; is "$(whead A)" "$(osha)" "local adopted"
run A state; is "$RC" 0 "state afterwards"; has "$E/out" "lock: free" "lock free"

case_ "unlock: staged and partly staged edits"
new_env; lock_A; W="$E/A/.harness-state"; entry A "$ME"
printf 'v1\n' >> "$W/docs/harness/primer.md"; git -C "$W" add docs/harness/primer.md
printf 'v2\n' >> "$W/docs/harness/primer.md"
printf '{ "features": [ { "id": "x-001", "status": "merged" } ] }\n' > "$W/docs/harness/feature_list.json"; git -C "$W" add docs/harness/feature_list.json
HARNESS_SESSION="$ME" run A unlock "state: handoff"
is "$RC" 0 "exit"
is "$(git --git-dir="$E/origin.git" show harness-state:docs/harness/primer.md | tail -1)" "v2" "worktree version published"
is "$(git --git-dir="$E/origin.git" show harness-state:docs/harness/feature_list.json | grep -c merged)" 1 "staged file published"
is "$(wst A)" "" "worktree clean"

case_ "unlock: wrong / missing HARNESS_SESSION"
new_env; lock_A; entry A "$ME"; before="$(osha)"
run A unlock "m"; is "$RC" 2 "missing"; has "$E/out" "HARNESS_SESSION is not set" "message"
entry A "20990101-0000-codex-ffff"   # an entry for the wrong id too: only the owner check may stop it
HARNESS_SESSION="20990101-0000-codex-ffff" run A unlock "m"; is "$RC" 2 "wrong"; has "$E/out" "never release another session's lock" "message"
HARNESS_SESSION="$ME" run A unlock; is "$RC" 2 "no message"
is "$(osha)" "$before" "origin unchanged"

case_ "unlock: no lock on origin"
new_env; entry A "nobody"; HARNESS_SESSION="nobody" run A unlock "m"; is "$RC" 2 "exit"; has "$E/out" "nothing to release" "message"

case_ "unlock: session entry missing / only a prefix-sharing entry"
new_env; lock_A; before="$(osha)"
HARNESS_SESSION="$ME" run A unlock "m"; is "$RC" 2 "no entry"; has "$E/out" "no entry" "message"
printf '\n### Session %sX · today\n' "$ME" >> "$E/A/.harness-state/docs/harness/session-log.md"
HARNESS_SESSION="$ME" run A unlock "m"; is "$RC" 2 "prefix entry"
is "$(osha)" "$before" "origin unchanged"

case_ "unlock: changes it may not publish"
new_env; lock_A; entry A "$ME"; before="$(osha)"; W="$E/A/.harness-state"
: > "$W/stray.txt"; HARNESS_SESSION="$ME" run A unlock "m"; is "$RC" 2 "untracked"; unlink "$W/stray.txt"
printf '{}\n' > "$W/vercel.json"; HARNESS_SESSION="$ME" run A unlock "m"; is "$RC" 2 "tracked foreign file"; git -C "$W" checkout -q -- vercel.json
printf 'x\n' >> "$W/README.md"; git -C "$W" add README.md; HARNESS_SESSION="$ME" run A unlock "m"; is "$RC" 2 "staged foreign file"
git -C "$W" reset -q -- README.md; git -C "$W" checkout -q -- README.md
printf 'x\n' >> "$W/$LK"; HARNESS_SESSION="$ME" run A unlock "m"; is "$RC" 2 "lock file edited"; git -C "$W" checkout -q -- "$LK"
printf 'ignored.txt\n' >> "$E/A/.git/info/exclude"; : > "$W/ignored.txt"; HARNESS_SESSION="$ME" run A unlock "m"; is "$RC" 2 "ignored file"; unlink "$W/ignored.txt"
printf '{ broken\n' > "$W/docs/harness/feature_list.json"; HARNESS_SESSION="$ME" run A unlock "m"; is "$RC" 2 "invalid JSON"
git -C "$W" checkout -q -- docs/harness/feature_list.json
is "$(osha)" "$before" "origin unchanged"; is "$(olock | sed -n 1p)" "session: $ME" "lock still held"

case_ "unlock: unpushed earlier commit"
new_env; lock_A; entry A "$ME"; W="$E/A/.harness-state"; git -C "$W" commit -qam "local only"; before="$(osha)"
HARNESS_SESSION="$ME" run A unlock "m"; is "$RC" 2 "exit"; has "$E/out" "unpushed" "message"; is "$(osha)" "$before" "origin unchanged"

case_ "unlock: lock replaced on origin between fetch and push"
new_env; lock_A; entry A "$ME"; printf 'mine\n' >> "$E/A/.harness-state/docs/harness/primer.md"
export HARNESS_SESSION="$ME"; bg A before-push unlock "state: handoff"; unset HARNESS_SESSION
seed_sync; printf 'session: 20990101-0000-codex-beef\nagent: Codex\nstarted: x\nitem: x-001\n' > "$E/seed/$LK"
git -C "$E/seed" add "$LK"; seed_push "foreign lock"; foreign="$(olock)"; fsha="$(osha)"
resume before-push
is "$BGRC" 2 "refused"; has "$E/bg.out" "NOT published" "message"
is "$(osha)" "$fsha" "origin unchanged"; is "$(olock)" "$foreign" "foreign lock intact"
is "$(wst A)" " M docs/harness/primer.md
 M docs/harness/session-log.md" "handoff edits still in the worktree"

case_ "unlock: push rejected by origin"
new_env; lock_A; entry A "$ME"; before="$(osha)"; lhead="$(whead A)"
printf '#!/bin/sh\nexit 1\n' > "$E/origin.git/hooks/pre-receive"; chmod +x "$E/origin.git/hooks/pre-receive"
HARNESS_SESSION="$ME" run A unlock "m"
is "$RC" 2 "exit"; is "$(osha)" "$before" "origin unchanged"; is "$(whead A)" "$lhead" "local HEAD unchanged"
is "$(wst A)" " M docs/harness/session-log.md" "edits kept"
HARNESS_SESSION="$ME" run A state; is "$RC" 2 "state afterwards stops on the uncommitted handoff (documented)"
has "$E/out" "uncommitted changes" "state message"
unlink "$E/origin.git/hooks/pre-receive"
HARNESS_SESSION="$ME" run A unlock "m"; is "$RC" 0 "re-run after the cause is gone"; is "$(olock)" "" "released"

case_ "unlock: edits made while it runs survive"
new_env; lock_A; entry A "$ME"; W="$E/A/.harness-state"; printf 'first\n' >> "$W/docs/harness/primer.md"
export HARNESS_SESSION="$ME"; bg A before-push unlock "state: handoff"; unset HARNESS_SESSION
printf 'later\n' >> "$W/docs/harness/primer.md"
resume before-push
is "$BGRC" 0 "exit"
is "$(git --git-dir="$E/origin.git" show harness-state:docs/harness/primer.md | tail -1)" "first" "published the snapshot"
is "$(tail -1 "$W/docs/harness/primer.md")" "later" "later edit kept in the file"
is "$(wst A)" " M docs/harness/primer.md" "later edit shows as a modification"

case_ "unlock: same-worktree overlap (paused before push)"
new_env; lock_A; entry A "$ME"
export HARNESS_SESSION="$ME"; bg A before-push unlock "state: handoff"; unset HARNESS_SESSION
run A lock x-001 --agent codex; is "$RC" 2 "lock refused"
HARNESS_SESSION="$ME" run A state; is "$RC" 2 "state refused"
HARNESS_SESSION="$ME" run A unlock "again"; is "$RC" 2 "second unlock refused"
resume before-push; is "$BGRC" 0 "first unlock completes"; is "$(olock)" "" "released"

case_ "unlock: object store not writable (commit cannot be built)"
if [ "$(id -u)" = 0 ]; then
  echo "  skip: running as root (permissions not enforced)"
else
  new_env; lock_A; entry A "$ME"; before="$(osha)"; lhead="$(whead A)"
  chmod -R a-w "$E/A/.git/objects"
  HARNESS_SESSION="$ME" run A unlock "m"
  chmod -R u+w "$E/A/.git/objects"
  is "$RC" 2 "exit"; has "$E/out" "nothing changed" "message"
  is "$(osha)" "$before" "origin unchanged"; is "$(whead A)" "$lhead" "local HEAD unchanged"
  is "$(wst A)" " M docs/harness/session-log.md" "edits kept"; is "$(olock | sed -n 1p)" "session: $ME" "lock still held"
fi

echo
echo "lock selftest: $PASS passed, $FAIL failed (bash $BASH_VERSION)"
[ "$FAIL" = 0 ]
