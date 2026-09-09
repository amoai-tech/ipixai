---
description: "iPixai /pr — one command: detect, fix, commit, push, GraphQL-resolve. Optional args pin a phase (fix / ship / resolve / open / ready / status)."
argument-hint: "[fix|ship|resolve|open|ready|status|new|post-merge] [PR#]"
---

# /pr — one command

`/pr` is the whole PR loop. It **includes** fix, GraphQL resolve, commit, and push. Typing `/pr` is consent to do those when the detected state needs them. Do not stop and ask for `/pr ship`.

Replaces old iPix `/pr`, `/pr-process`, `/pr-fix`, `/pr-fix-ship`, and `/pr-ready`.

**Args:** `$ARGUMENTS` — optional phase + PR number, `PR#N`, or URL. Empty args = auto-detect, then run that path to the end (including commit + push + resolve when that is the path).

| Typed | Means |
|-------|--------|
| `/pr` (no args) | Detect state, then run the matching path **through commit, push, and GraphQL resolve** when that is next. |
| `/pr ship` · `/pr-ship` | Skip detect. Verify → `git add` allowlist → `git commit` → `git push -u origin HEAD` → GraphQL resolve. |
| `/pr fix` · `/pr-fix` | Edit only. Stop before commit. |
| `/pr resolve` | GraphQL reply + `resolveReviewThread` only. No code, no commit. |
| `/pr ready` · `/pr-ready` | Undraft / CI / bots. No commit. |
| `/pr post-merge` | After MERGED — execute `.claude/skills/tasks/references/post-merge.md` |

## Dispatch (`$ARGUMENTS`)

Parse the first token (strip a leading `/pr` or `/pr-`).

| First token | Path |
|-------------|------|
| empty | Auto-detect, then **execute** that path. If the path is fix-then-ship or ship, commit + push + GraphQL resolve without asking. |
| `ship` · `pr-ship` · `fix-ship` | `/pr ship` |
| `fix` · `pr-fix` | `/pr fix` (stop before commit) |
| `open` | `/pr open` |
| `new` | `/pr new` |
| `ready` · `pr-ready` | `/pr ready` |
| `resolve` | `/pr resolve` |
| `status` | `/pr status` (read-only) |
| `post-merge` · `merged` | After MERGED — load `.claude/skills/tasks/references/post-merge.md` and execute (no code unless a follow-up PR is required) |

**Load first:** `.claude/skills/tasks/SKILL.md` (canonical task/PR standard — GraphQL resolve, taxonomy, and templates live under its `references/`). Legacy `pr-workflow` is a deprecated compatibility alias only; do not load it as primary.

**This repo (not old `/home/sk/ipix`):** git root is this checkout. App lives in `src/`. Never `cd app`. Never combined `npm run dev` (**DEV-STAB-001**). Never mutate production Supabase. Secrets: `infisical run --env=dev -- <command>` per `AGENTS.md` § Secrets / Infisical.

---

## Injected context

- Branch: !`git branch --show-current`
- Top-level: !`git rev-parse --show-toplevel`
- Status: !`git status -sb | head -20`
- Diff vs main: !`{ git diff origin/main...HEAD --stat 2>/dev/null || git diff main...HEAD --stat 2>/dev/null || git diff --stat HEAD; } | head -20`
- HEAD: !`git rev-parse HEAD`
- Open PR: !`gh pr view --json number,url,headRefName,headRefOid,isDraft,mergeable,statusCheckRollup 2>/dev/null || echo "no open PR"`

---

## What each old command became

| Old command | Now |
|-------------|-----|
| `/pr` / `/pr-process` | `/pr` — detect **and** run: fix, commit, push, GraphQL resolve as needed |
| `/pr-fix` | `/pr fix [N]` — triage + edit only (no commit) |
| `/pr-fix-ship` · `/pr-ship` | `/pr ship [N]` — same commit/push/resolve steps as the ship path of `/pr` |
| `/pr-ready` | `/pr ready [N]` — undraft + CI + thread inventory + bot trigger offer |
| resolve-only | `/pr resolve [N]` — reply + GraphQL resolve, no code |
| (implied) | `/pr new` review · `/pr open` draft PR · `/pr status` dashboard |

Never undraft or merge from `/pr` / `/pr ship`. Offer `/pr ready` after ship. Do not stop mid-pipeline to ask for a second `/pr ship`.

---

## Phase 0 — banner (every invocation)

```markdown
# /pr — state

| Check | Result |
|-------|--------|
| Branch | |
| On main? | yes → **STOP** |
| Uncommitted | N files |
| Open PR | #N draft/open/none |
| HEAD vs PR `headRefOid` | match / mismatch |
| CI | pass / fail / pending / n/a |
| Unresolved threads | N (**GraphQL inventory below** — not REST/`gh pr view` comment count) |
| **Next** | `/pr <subcommand>` |
```

**Stop if:** on `main` with feature work · local HEAD ≠ PR `headRefOid` · nested/wrong worktree.

**Unresolved count:** run the inventory query in **GraphQL resolve** every time. A reply without `resolveReviewThread` still counts as unresolved.

**Git safety:** `git status -sb`, `git diff --stat HEAD`, `git diff origin/main...HEAD --stat`, `git log -5 --oneline`.

**Never stage:** `.env*`, `.mcp.json`, `.agents/**`, secrets, unrelated `docs/**`, lockfile churn.

**PR body (create/edit):** `.cursor/rules/pr-description.mdc` — plain English + hard-rule block. Title: `IPI-NNN · SPEC — Plain English title`.

**Repo for GraphQL:** `gh repo view --json nameWithOwner --jq .nameWithOwner` (do not hardcode `lumina-studio`).

Thread count + reply/resolve: `.claude/skills/tasks/references/review-comments.md`.

---

## Auto-detect (`/pr` with no args)

Run Phase 0, then **execute one path** (do not only report and wait):

```text
On main?                         → STOP. Branch off main (worktrees skill if isolating).
HEAD ≠ headRefOid?               → STOP. Checkout the PR branch.
Unresolved threads > 0?          → /pr fix, then /pr ship (commit + push + GraphQL resolve)
CI failing (code you can fix)?   → Fix, then /pr ship
CI failing (infra / not code)?   → Report checks + links. STOP.
CI pending?                      → Report. STOP.
Dirty tree + PR + threads = 0?   → /pr ship (commit allowlist + push)
Dirty tree, no PR?               → /pr ship, then /pr open if verify is green
Commits, no PR, clean tree?      → /pr new, then /pr open if verify is green
Draft + threads = 0 + clean?     → /pr ready (still ask before undraft)
Open + green + threads = 0?      → /pr status → merge-ready (human still merges)
Clean, no PR?                    → Nothing to do.
```

---

## `/pr new`

1. Self-review `git diff origin/main...HEAD` (Critical / Important / Suggestions).
2. Fix Critical + Important only if the user continues.
3. Verify (below). **Do not commit.**
4. Ask: commit allowlist, then `/pr open`?

---

## `/pr open`

Preconditions: feature branch, verify green, commits exist (or user just approved commit).

1. `git push -u origin HEAD`
2. `gh pr create --draft` with **pr-description.mdc** body (not old Infisical/app/ template).
3. STOP. Ask: `/pr ready` after bots?

---

## `/pr fix [N]`  (old `/pr-fix`)

Explicit **`/pr fix`** is edit-only. Bare **`/pr`** uses these same steps, then ships.

1. HEAD gate. Load domain skills from changed paths (`copilotkit`, `mastra`, `ipix-supabase`, `nextjs-developer`, `shadcn`). `graphify query` before reading flagged files.
2. Inventory unresolved **inline** threads (GraphQL). Bot summary “Needs Changes” is **not** a thread.
3. Triage table **before coding:** Fix / Already fixed / Out of scope / Dismiss. Order: bug → security/RLS → CI → style.
4. Smallest diff. One concern. UI change → browser, not screenshot-only.
5. Verify. If the user typed **`/pr fix`**, STOP before commit. If this ran from bare **`/pr`**, continue into `/pr ship`.

Tiers: A = exact file/line (targeted check) · B = domain skill + MCP · C = `task-verifier` + full matrix.

---

## `/pr ship [N]` · `/pr-ship`  (old `/pr-fix-ship`)

Also the last stage of bare **`/pr`**. **Hard rule:** do **not** ask “commit?” or “push?”. If there is nothing allowed to commit, say so and still push if the branch is ahead, then GraphQL-resolve.

Run in this order. Stop only on a red verify, empty allowlist with no ahead commits, or a push rejection (never `--force`).

1. Same as `/pr fix` if inline threads are still open and unfixed.
2. Verify green on the working tree you are about to commit (`npx tsc --noEmit`, plus tests/build from **Verify** when those paths changed).
3. Stage **allowlist only** (`git add -- <paths>`). Never `git add -A`. Never stage graphify output, `.env*`, `.mcp.json`, `.agents/**`, secrets, unrelated `docs/**`, lockfile churn.
4. Commit (HEREDOC, no `--no-verify`):

```bash
git commit -m "$(cat <<'EOF'
fix(pr-<N>): address review — <summary>

EOF
)"
```

Use an IPI title instead when this is feature work, not review follow-up. One concern per commit. Split docs vs code if both changed.

5. Push the current branch (creates upstream on first ship):

```bash
git push -u origin HEAD
```

Never `--force` / `--force-with-lease` unless the user typed that. Re-fetch PR `headRefOid` and confirm it equals `git rev-parse HEAD`.

6. **Must run GraphQL resolve** (section below). Re-count ~10s later; new sibling threads → `/pr fix` again, do not sign off.
7. Report SHAs + PR URL. Offer `/pr ready [N]` — do not undraft unless they asked.

---

## `/pr resolve [N]`

No code. HEAD must match. Per thread: read full body → verify at HEAD → GraphQL reply → **`resolveReviewThread`**. A REST/MCP reply alone does **not** close the thread. Unfixed → skip and say needs `/pr fix`.

---

## GraphQL resolve (mandatory — actually run this)

REST comments and CodeRabbit “addressed” do **not** resolve threads. Only `resolveReviewThread` (or MCP `resolve_thread`) does.

```bash
OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
OWNER=${OWNER_REPO%/*}
NAME=${OWNER_REPO#*/}
N=<PR number>

# Inventory (gate: unresolved length must be 0)
gh api graphql -f query='
query($owner:String!, $name:String!, $n:Int!) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$n) {
      reviewThreads(first:100) {
        nodes { id isResolved path line comments(first:1){nodes{databaseId author{login} body}} }
      }
    }
  }
}' -F owner="$OWNER" -F name="$NAME" -F n="$N"

# Per unresolved thread, after verify at HEAD:
gh api graphql -f query='
mutation($id:ID!, $body:String!) {
  addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $id, body: $body }) {
    comment { id }
  }
}' -F id="PRRT_..." -F body="Fixed in <sha>: <what changed>. Verified: <command>."

gh api graphql -f query='
mutation($id:ID!) {
  resolveReviewThread(input: { threadId: $id }) {
    thread { isResolved }
  }
}' -F id="PRRT_..."
```

If `gh` cannot see the repo: GitHub MCP `add_reply_to_pull_request_comment` (REST `databaseId`) **and** `pull_request_review_write` `method=resolve_thread` `threadId=PRRT_...`. Never reply without resolve. Re-inventory after.

---

## `/pr ready [N]`  (old `/pr-ready`)

No commit.

1. Branch matches `headRefName`.
2. If draft: **ask**, then `gh pr ready <N>`.
3. `gh pr checks <N> --watch=false` + unresolved thread count.
4. Offer (do not claim they ran): `cursor review` / `bugbot run` / `@coderabbitai review`.
5. Summary: CI table, mergeable, threads, next step.

---

## `/pr status [N]`

Read-only: branch, HEAD, draft, mergeable, dirty files, CI, unresolved count, next `/pr` subcommand.

---

## Verify (iPixai)

Do **not** run old iPix `cd app && npm test` — that layout doesn't exist here. Secret-dependent commands run through `infisical run --env=dev -- <command>` (canonical, see `AGENTS.md` § Secrets / Infisical).

| Path | Check |
|------|--------|
| TS/TSX | `npx tsc --noEmit` |
| Routes / env / middleware / CopilotKit / Mastra | `npm run build` **only if ports 3000 and 4111 are free** (`scripts/dev-guard.mjs`) |
| UI behavior | Browser: exercise the flow |
| Supabase | Preview / MCP read-only. No production writes. Stop if a fix needs a new migration. |

UI: `npm run dev:ui` and `npm run dev:agent` in **separate** terminals. Combined `npm run dev` is blocked.

---

## Approval gates

| Action | Needs |
|--------|--------|
| commit + push | **`/pr`** (auto-detect ship path) or **`/pr ship`** — no second ask. `/pr fix` does not commit. |
| GraphQL resolve | verified at HEAD + **`/pr` / `/pr ship` / `/pr resolve`** |
| `gh pr ready` | user confirms undraft |
| `--force` | user explicit |

**Never merge if:** build/tsc red · secrets in diff · mixed docs+code · unresolved inline threads · Bugbot High/Critical without waiver.

Detail SSOT: `tasks` skill — `references/review-comments.md`, `references/github-pr.md`, `references/pre-commit.md` (sign-off/waiver only; **PR body is pr-description.mdc**). Legacy `pr-workflow` is a deprecated compatibility alias only — do not treat it as SSOT.
