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

# A test double for git, first on PATH only inside fake(): FAKE_GIT_FAIL=<subcommand> makes that
# subcommand fail; FAKE_GIT_LOST_ACK=1 makes a push land but report failure, after running the
# script FAKE_GIT_AFTER (which must use the real git: $REALGIT).
REALGIT="$(command -v git)"
mkdir -p "$T/fakegit"
cat > "$T/fakegit/git" <<EOF
#!/bin/sh
sub=""; skip=0
for a in "\$@"; do
  if [ \$skip = 1 ]; then skip=0; continue; fi
  case "\$a" in -C|-c) skip=1 ;; -*) ;; *) sub="\$a"; break ;; esac
done
if [ -n "\${FAKE_GIT_FAIL:-}" ] && [ "\$sub" = "\$FAKE_GIT_FAIL" ]; then echo "fake failure: \$sub" >&2; exit 1; fi
if [ "\$sub" = push ] && [ -n "\${FAKE_GIT_LOST_ACK:-}" ]; then
  "$REALGIT" "\$@" || exit \$?
  if [ -n "\${FAKE_GIT_AFTER:-}" ]; then sh "\$FAKE_GIT_AFTER" > /dev/null 2>&1; fi
  echo "fake: connection lost after the push" >&2; exit 1
fi
exec "$REALGIT" "\$@"
EOF
chmod +x "$T/fakegit/git"

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
fake() { # like run, with the git test double first on PATH (FAKE_GIT_* via env before `fake`)
  local d="$1"; shift
  ( cd "$E/$d" && PATH="$T/fakegit:$PATH" "$BASH" docs/harness/init.sh "$@" ) > "$E/out" 2>&1; RC=$?
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

case_ "unlock: refusal leaves staged / partly staged edits exactly as they were"
new_env; lock_A; entry A "$ME"; W="$E/A/.harness-state"
printf 'v1\n' >> "$W/docs/harness/primer.md"; git -C "$W" add docs/harness/primer.md; printf 'v2\n' >> "$W/docs/harness/primer.md"
cached="$(git -C "$W" diff --cached)"; unstaged="$(git -C "$W" diff)"; before="$(osha)"
HARNESS_SESSION="20990101-0000-codex-ffff" run A unlock "m"; is "$RC" 2 "refused"
is "$(git -C "$W" diff --cached)" "$cached" "index unchanged"; is "$(git -C "$W" diff)" "$unstaged" "worktree unchanged"
is "$(osha)" "$before" "origin unchanged"

case_ "unlock: lock file ignored locally (*.lock) is still removed"
new_env; lock_A; entry A "$ME"; printf '*.lock\n' >> "$E/A/.git/info/exclude"
HARNESS_SESSION="$ME" run A unlock "m"; is "$RC" 0 "exit"; is "$(olock)" "" "released on origin"
is "$([ -e "$E/A/.harness-state/$LK" ] && echo left || echo gone)" gone "local lock file gone"
run A state; is "$RC" 0 "state afterwards"; has "$E/out" "lock: free" "lock free"

case_ "build failures: write-tree (unlock) / commit-tree (lock)"
new_env; lock_A; entry A "$ME"; before="$(osha)"; lhead="$(whead A)"
FAKE_GIT_FAIL=write-tree HARNESS_SESSION="$ME" fake A unlock "m"
is "$RC" 2 "write-tree"; has "$E/out" "write-tree" "names the step"; is "$(osha)" "$before" "origin unchanged"
is "$(whead A)" "$lhead" "HEAD unchanged"; is "$(wst A)" " M docs/harness/session-log.md" "edits kept"
new_env; before="$(osha)"
FAKE_GIT_FAIL=commit-tree fake A lock x-001 --agent claude
is "$RC" 2 "commit-tree"; is "$(osha)" "$before" "origin unchanged"; is "$(olock)" "" "no lock"; is "$(wst A)" "" "clean"

case_ "push landed, reply lost (lock)"
new_env
FAKE_GIT_LOST_ACK=1 fake A lock x-001 --agent claude
is "$RC" 0 "exit"; has "$E/out" "nevertheless — published" "message"; is "$(olock | sed -n 2p)" "agent: Claude Code" "lock on origin"
is "$(whead A)" "$(osha)" "adopted"; is "$(wst A)" "" "clean"

case_ "push landed, reply lost, origin moved on (unlock)"
new_env; lock_A; entry A "$ME"
cat > "$E/advance.sh" <<EOF
"$REALGIT" -C "$E/seed" fetch -q "$E/origin.git" harness-state && "$REALGIT" -C "$E/seed" reset -q --hard FETCH_HEAD &&
printf 'more\n' >> "$E/seed/README.md" && "$REALGIT" -C "$E/seed" commit -qam "someone else" && "$REALGIT" -C "$E/seed" push -q "$E/origin.git" harness-state
EOF
FAKE_GIT_LOST_ACK=1 FAKE_GIT_AFTER="$E/advance.sh" HARNESS_SESSION="$ME" fake A unlock "state: handoff"
is "$RC" 1 "exit 1 (published, origin moved)"; has "$E/out" "moved on" "message"
is "$(git --git-dir="$E/origin.git" log -1 --format=%s harness-state)" "someone else" "origin advanced"
is "$(git --git-dir="$E/origin.git" log --format=%s harness-state | grep -c 'state: handoff')" 1 "our commit is in origin"
is "$(olock)" "" "lock released"
run A state; is "$RC" 0 "state afterwards catches up"; is "$(whead A)" "$(osha)" "local at origin"

case_ "adoption fails after the push (lock): recovery as printed"
new_env
FAKE_GIT_FAIL=reset fake A lock x-001 --agent claude
is "$RC" 1 "exit"; has "$E/out" "PUBLISHED" "message"; is "$(olock | sed -n 2p)" "agent: Claude Code" "lock on origin"
rec="$(sed -n 's/^Recover (inside .harness-state): //p' "$E/out")"
( cd "$E/A/.harness-state" && eval "$rec" ) > /dev/null 2>&1; is "$?" 0 "recovery command runs"
is "$(wst A)" "" "clean after recovery"; is "$(whead A)" "$(osha)" "adopted after recovery"
id2="$(olock | sed -n 's/^session: //p')"; HARNESS_SESSION="$id2" run A state; is "$RC" 0 "state afterwards"

case_ "default run (no arguments) respects the mutex"
new_env; mkdir "$E/A/.git/harness/state-mutex"
run A; is "$RC" 2 "refused"; has "$E/out" "STATE MUTEX HELD" "message"

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

# --- unlock: session-log.md may only grow (harness-004) -------------------------------------
LOGF="docs/harness/session-log.md"
OLD='# log\n\n### Session 20261001-0000-claude-aaaa · 2026-10-01 · test · x-001\n- one\n\n### Session 20261002-0000-codex-bbbb · 2026-10-02 · test · x-001\n- two SENTINEL-7f3a\n'
base_log() { seed_sync; printf '%b' "$1" > "$E/seed/$LOGF"; git -C "$E/seed" add "$LOGF"; seed_push "log on origin"; }
wlog() { printf '%s' "$E/A/.harness-state/$LOGF"; }
olog_to() { git --git-dir="$E/origin.git" show "harness-state:$LOGF" > "$1"; }
refused() { # $1 = label: exit 2, NOT published, origin unchanged, lock still ours
  is "$RC" 2 "$1: exit"; has "$E/out" "NOT published" "$1: message"; is "$(osha)" "$before" "$1: origin unchanged"
  is "$(olock | sed -n 1p)" "session: $ME" "$1: lock still held"
  if grep -qF "SENTINEL-7f3a" "$E/out"; then bad "$1: log content in the output"; else ok; fi
}
grow_setup() { new_env; base_log "${1:-$OLD}"; lock_A; before="$(osha)"; }

case_ "log: truncated to this session's entry"
grow_setup; printf '### Session %s · today · test · x-001\n- done\n' "$ME" > "$(wlog)"
HARNESS_SESSION="$ME" run A unlock "m"; refused "truncated"; has "$E/out" "would shrink or not grow" "reason"

case_ "log: one byte of an old entry edited"
grow_setup; sed 's/- one/- 0ne/' "$(wlog)" > "$E/l" && cat "$E/l" > "$(wlog)"; entry A "$ME"
HARNESS_SESSION="$ME" run A unlock "m"; refused "edited"; has "$E/out" "first difference at byte" "reason"; has "$E/out" "(line 4)" "line number"

case_ "log: a line deleted in the middle"
grow_setup; grep -v '^- one$' "$(wlog)" > "$E/l" && cat "$E/l" > "$(wlog)"; entry A "$ME"
HARNESS_SESSION="$ME" run A unlock "m"; refused "line deleted"

case_ "log: replaced by a reordered copy"
grow_setup; { printf '# log\n\n'; sed -n '/codex-bbbb/,$p' "$(wlog)"; printf '\n'; sed -n '/claude-aaaa/,/^- one$/p' "$(wlog)"; } > "$E/l" && cat "$E/l" > "$(wlog)"; entry A "$ME"
HARNESS_SESSION="$ME" run A unlock "m"; refused "reordered"

case_ "log: same length, different bytes (entry already on origin, so only the new check can refuse)"
new_env; base_log "$OLD"; lock_A
seed_sync; printf '\n### Session %s · early · test · x-001\n' "$ME" >> "$E/seed/$LOGF"; git -C "$E/seed" add "$LOGF"; seed_push "entry on origin"
git -C "$E/A/.harness-state" pull -q --ff-only origin harness-state; before="$(osha)"
sed 's/SENTINEL-7f3a/SENTINEL-7f3b/' "$(wlog)" > "$E/l" && cat "$E/l" > "$(wlog)"
HARNESS_SESSION="$ME" run A unlock "m"; refused "same length"; has "$E/out" "would shrink or not grow" "reason"

case_ "log: old text's last newline changed (LF → CRLF) before the append"
grow_setup; printf '%b' "$OLD" | sed '$ s/$/\r/' > "$E/l" && cat "$E/l" > "$(wlog)"; entry A "$ME"
HARNESS_SESSION="$ME" run A unlock "m"; refused "newline changed"

case_ "log: CRLF in the old text altered to LF"
grow_setup '# log\r\n\r\n### Session 20261001-0000-claude-aaaa · d · test · x-001\r\n- one SENTINEL-7f3a\r\n'
tr -d '\r' < "$(wlog)" > "$E/l" && cat "$E/l" > "$(wlog)"; entry A "$ME"
HARNESS_SESSION="$ME" run A unlock "m"; refused "CRLF altered"

case_ "log: this session's entry only in the old part (moved up), unrelated text appended"
new_env; lock_A
seed_sync; printf '\n### Session %s · early · test · x-001\n- moved\n' "$ME" >> "$E/seed/$LOGF"; git -C "$E/seed" add "$LOGF"; seed_push "entry on origin"
git -C "$E/A/.harness-state" pull -q --ff-only origin harness-state; before="$(osha)"
printf '\n- unrelated note\n' >> "$(wlog)"
HARNESS_SESSION="$ME" run A unlock "m"; refused "entry in old part"; has "$E/out" "not in the appended text" "reason"

case_ "log: origin has no session-log.md"
# (Refused already by check_dirty — the recreated log is untracked; the new missing-BASE guard in unlock is defence
#  in depth for a path the sync makes unreachable. Not a mutation witness.)
new_env; seed_sync; git -C "$E/seed" rm -q "$LOGF"; seed_push "no log"; lock_A; before="$(osha)"
entry A "$ME"
HARNESS_SESSION="$ME" run A unlock "m"; is "$RC" 2 "exit"; is "$(osha)" "$before" "origin unchanged"; is "$(olock | sed -n 1p)" "session: $ME" "lock still held"

case_ "log: append to an old log without a trailing newline (pass)"
grow_setup '# log\n\n### Session 20261001-0000-claude-aaaa · d · test · x-001\n- one'
entry A "$ME"; cp "$(wlog)" "$E/want"
HARNESS_SESSION="$ME" run A unlock "state: handoff"; is "$RC" 0 "exit"; has "$E/out" "lock released" "message"
olog_to "$E/got"; if cmp -s "$E/got" "$E/want"; then ok; else bad "published log differs from the worktree's"; fi

case_ "log: CRLF + BOM + invalid UTF-8 in the old text kept, entry appended (pass)"
grow_setup '\xef\xbb\xbf# log\r\n\r\n### Session 20261001-0000-claude-aaaa · d · test · x-001\r\n- bytes \xff\xfe\x80\r\n'
entry A "$ME"; cp "$(wlog)" "$E/want"
HARNESS_SESSION="$ME" run A unlock "state: handoff"; is "$RC" 0 "exit"
olog_to "$E/got"; if cmp -s "$E/got" "$E/want"; then ok; else bad "published bytes differ"; fi

case_ "log: BOM removed from the old text, entry appended"
grow_setup '\xef\xbb\xbf# log\n\n### Session 20261001-0000-claude-aaaa · d · test · x-001\n- one SENTINEL-7f3a\n'
tail -c +4 "$(wlog)" > "$E/l" && cat "$E/l" > "$(wlog)"; entry A "$ME"
HARNESS_SESSION="$ME" run A unlock "m"; refused "BOM removed"; has "$E/out" "first difference at byte 0 (line 1)" "reason"

case_ "log: origin fast-forwards (another file) before unlock — checked against the new BASE (pass)"
grow_setup; entry A "$ME"
seed_sync; printf 'from origin\n' >> "$E/seed/docs/harness/primer.md"; git -C "$E/seed" add docs/harness/primer.md; seed_push "primer on origin"
cp "$(wlog)" "$E/want"
HARNESS_SESSION="$ME" run A unlock "state: handoff"; is "$RC" 0 "exit"
is "$(git --git-dir="$E/origin.git" show harness-state:docs/harness/primer.md | tail -1)" "from origin" "origin's edit kept"
olog_to "$E/got"; if cmp -s "$E/got" "$E/want"; then ok; else bad "published log differs from the worktree's"; fi

case_ "log: truncated while unlock is paused before the push — the checked blob is published"
grow_setup; entry A "$ME"; cp "$(wlog)" "$E/want"
export HARNESS_SESSION="$ME"; bg A before-push unlock "state: handoff"; unset HARNESS_SESSION
printf 'truncated\n' > "$(wlog)"
resume before-push; is "$BGRC" 0 "exit"
olog_to "$E/got"; if cmp -s "$E/got" "$E/want"; then ok; else bad "published log is not the checked one"; fi
is "$(cat "$(wlog)")" "truncated" "later edit stays in the worktree"

case_ "log: a refusal can be fixed and re-run"
grow_setup; printf '### Session %s · today · test · x-001\n' "$ME" > "$(wlog)"
HARNESS_SESSION="$ME" run A unlock "m"; refused "first try"
git -C "$E/A/.harness-state" show "origin/harness-state:$LOGF" > "$(wlog)"; entry A "$ME"; cp "$(wlog)" "$E/want"
HARNESS_SESSION="$ME" run A unlock "state: handoff"; is "$RC" 0 "after restoring + appending"; is "$(olock)" "" "released"
olog_to "$E/got"; if cmp -s "$E/got" "$E/want"; then ok; else bad "published log differs from the restored + appended one"; fi

echo
echo "lock selftest: $PASS passed, $FAIL failed (bash $BASH_VERSION)"
[ "$FAIL" = 0 ]
