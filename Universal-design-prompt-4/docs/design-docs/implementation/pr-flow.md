# PR flow — `/pr` orchestrator playbook

**Verified:** 2026-07-01 · PRs [#164](https://github.com/amo-tech-ai/lumina-studio/pull/164) · [#169](https://github.com/amo-tech-ai/lumina-studio/pull/169) · [#170](https://github.com/amo-tech-ai/lumina-studio/pull/170) · [#171](https://github.com/amo-tech-ai/lumina-studio/pull/171)

**Commands:** `/pr` (canonical) · `/pr-process` (alias) · see `.claude/commands/pr.md` (#172)

**Short answer:** `/pr new` = catch problems **before commit/push**. Open PRs with bot threads → **`/pr fix N`**. Draft + green CI + 0 threads → **`/pr ready N`**.

---

## Command map (open PRs)

| Command | When to use | Commits? |
|---------|-------------|----------|
| **`/pr new`** | Local diff, no push yet — read-only review + verify | No |
| **`/pr fix N`** | Unresolved **inline threads** or CI failures | Fix locally; ask before commit |
| **`/pr ship N`** | Fixes verified locally — commit + push + resolve | Yes (explicit) |
| **`/pr ready N`** | CI green, threads = 0, undraft + trigger Bugbot | No |
| **`/pr`** (no args) | Auto-detect → one phase → stop at gate | No |

---

## Verified state (2026-07-01)

| PR | State | Unresolved thread | Next command |
|----|-------|-------------------|--------------|
| [#164](https://github.com/amo-tech-ai/lumina-studio/pull/164) | Open · not draft · `ipi/286-route-aware-sections` | optibot — `app/src/lib/intelligence/generate-suggestions.ts` (`?? 0` score defaults) | `/pr fix 164` |
| [#169](https://github.com/amo-tech-ai/lumina-studio/pull/169) | Open · not draft · `ipi/17-command-center-dc-polish` | optibot — `role="alert"` on interactive container (`command-center-approvals.tsx`) | `/pr fix 169` |
| [#170](https://github.com/amo-tech-ai/lumina-studio/pull/170) | Open · **draft** · mergeable · `ipi/295-cc-3-panel-layout` | 0 | `/pr ready 170` |
| [#171](https://github.com/amo-tech-ai/lumina-studio/pull/171) | Open · **draft** · base **`ipi/295-cc-3-panel-layout`** (not `main`) | 0 | Wait for #170 → rebase on `main` → `/pr new` → `/pr ready 171` |

Codacy `ACTION_REQUIRED` on #164/#170/#171 = **no inline threads** — triage as Fix vs Dismiss in `/pr fix`; not a merge blocker when CI is green.

---

## Canonical execution order

Run top-to-bottom. Do not parallelize #170 and #171 (stack dependency).

```text
 1. /pr ready 170
 2. merge #170
 3. rebase #171 on main
 4. /pr new                    # full rebased diff review before push
 5. /pr ready 171
 6. merge #171
 7. npm run worktree:audit     # gate before any fix
 8. /pr fix 164
 9. /pr ship 164
10. npm run worktree:audit
11. /pr fix 169
12. /pr ship 169
```

**Independence:** #164 and #169 do not depend on #170/#171 — steps 7–12 can run anytime after step 1, but the stack (#170 → #171) should land first to reduce rebase churn on command-center work.

---

## Worktree gate (mandatory before `/pr fix N`)

Wrong checkout = wrong fixes pushed to the wrong PR. **Always run audit first:**

```bash
npm run worktree:audit
```

Then confirm HEAD matches PR remote:

```bash
gh pr view <N> --json headRefOid,headRefName -q '{branch:.headRefName, oid:.headRefOid}'
git rev-parse HEAD
git branch --show-current
```

| PR | Expected worktree (typical) | Branch |
|----|----------------------------|--------|
| #164 | `../wt-ipi-286` | `ipi/286-route-aware-sections` |
| #169 | `../wt-ipi-169-dc-polish` | `ipi/17-command-center-dc-polish` |
| #170 | `../wt-ipi-295-3-panel-layout` | `ipi/295-cc-3-panel-layout` |
| #171 | `../wt-ipi-17-command-center-dc-polish` (or 306 wt) | `ipi/306-cc-int-panel-parity` |

Mismatch → `cd` to correct path before `/pr fix`.

---

## Fix efficiency tiers

**Default to Tier A.** Escalate only when confidence drops below 80% or the issue touches auth, RLS, agents, migrations, CI, or runtime UI.

| Tier | When | Skills / MCP | Verify |
|------|------|--------------|--------|
| **A — Thread-only** | Clear inline comment with exact file/line | None unless confidence < 80% | Targeted test + lint |
| **B — Domain** | UI architecture, Supabase/RLS, auth, agents, migrations, shared components | Max 1–2 skills; MCP only if external truth needed | `npm test` on affected glob |
| **C — Forensic** | CI red, runtime disputed, AC drift, stacked PR unclear | `task-verifier` + MCP + browser | Full `tasks` PR verification matrix |

### Tier A — Thread-only

Use for clear inline comments with exact file/line.  
No skills or MCP unless confidence is below 80%.  
Verify with targeted test + lint.

Examples: null-guard logic (#164), single a11y role fix (#169).

### Tier B — Domain

Use when the fix touches UI architecture, Supabase/RLS, auth, agents, migrations, or shared components.  
Load max 1–2 relevant skills (see `.claude/commands/pr-fix.md` path matrix).  
Use MCP only if external truth is needed.

### Tier C — Forensic

Use when CI is red, runtime behavior is disputed, AC drift exists, or stacked PR state is unclear.  
Use `task-verifier`, MCP probes, browser snapshot, and full verify matrix.

Run Tier C on **`/pr ready`**, not every thread fix.

**Efficient loop:**

```text
npm run worktree:audit → classify A|B|C → fix → verify by tier → /pr ship → resolve
```

---

## Per-PR playbooks

### #164 — score defaults thread

```bash
npm run worktree:audit
cd ../wt-ipi-286
/pr fix 164
```

Triage optibot on `generate-suggestions.ts`: `?? 0` may hide brands with no score rows — fix logic or reply + resolve with evidence.

```bash
cd app && npm run lint && npm test && npx tsc --noEmit
/pr ship 164
/pr ready 164    # if needed after push
```

---

### #169 — a11y `role="alert"` thread

```bash
npm run worktree:audit
cd ../wt-ipi-169-dc-polish
/pr fix 169
```

Fix direction: `role="alert"` on container with interactive children → `role="region"` + `aria-live="polite"`, or split alert text from links.

```bash
cd app && npm run lint && npm test && npx tsc --noEmit
/pr ship 169
/pr ready 169
```

---

### #170 — undraft + merge (0 threads)

```bash
cd ../wt-ipi-295-3-panel-layout
/pr status 170
/pr ready 170
```

Merge when human approves. Unblocks #171.

---

### #171 — stacked on #170

Base branch is `ipi/295-cc-3-panel-layout`, not `main`. After #170 merges:

```bash
cd ../wt-ipi-306   # or path from worktree:audit
git fetch origin
git rebase origin/main
/pr new
cd app && npm run lint && npm test && npx tsc --noEmit
git push --force-with-lease   # after rebase; or /pr ship 171 if fixes needed
/pr ready 171
```

---

## `/pr new` vs `/pr fix`

| Use **`/pr new`** | Use **`/pr fix N`** |
|-------------------|---------------------|
| Before first push on a branch | Open PR with inline bot threads |
| After rebase (#171 post-#170) | CI failed on PR branch |
| Local uncommitted fixes before `/pr ship` | Need triage table before coding |

**Do not** use `new` instead of `fix` for #164/#169 — `new` does not reply or resolve GitHub threads.

---

## Cursor session snippets

```text
/pr ready 170
```

```text
npm run worktree:audit
/pr fix 164
```

```text
npm run worktree:audit
/pr fix 169
```

```text
/pr new
```
(run after #171 rebase, before push)

---

## Related

- `.claude/commands/pr.md` — orchestrator SSOT (#172)
- `.claude/commands/pr-fix.md` — triage + verify loop
- `npm run worktree:audit` · `npm run worktree:add` — worktree manager (#173)
- `tasks` — PR verification matrix (`cd app && npm run lint && npm test && npm run build`)
