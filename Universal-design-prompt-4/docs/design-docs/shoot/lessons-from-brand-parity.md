---
title: Lessons from Brand + Command Center Parity (PR #181)
version: "1.2"
lastUpdated: "2026-07-02"
applies_to: IPI-337 · IPI-273 · IPI-274 · IPI-248 · IPI-249 · IPI-296 · IPI-297 · all DESIGN-* screen parity
source_pr: https://github.com/amo-tech-ai/lumina-studio/pull/181
---

# Shoot implementation guardrails (PR #181 post-mortem)

**Core rule:** Don't start coding from Linear text alone. First prove what exists on **disk**, in **Supabase**, and in the **live browser**.

Simple summary: [`../lessons.md`](../lessons.md) · Process depth: [`implementation-checklist.md`](./implementation-checklist.md) · PR gate: [`production-readiness.md`](./production-readiness.md)

---

## Why PR #181 had many review fixes

One feature commit landed; **six+ fix commits** followed review.

| Root cause | Share of churn | Lesson |
|------------|----------------|--------|
| Stale Linear specs | ~20% | Shell/components "missing" but already on disk |
| Fabricated fallbacks | ~35% | Fake DNA history, CC score 87, wrong counts |
| Layout fighting shell | ~20% | `min-h-screen`, `#FBF8F5` inside `OperatorPanel` |
| Missing UI states | ~15% | Error treated as empty; no honest empty states |
| HITL / draft gaps | ~10% | `draft_ready` without `workflowRunId` → blank UI |

**Target for next screens:** ≤2 fix commits after feature — achieve via probes before line 1.

---

## Three problems (simple)

| Problem | Meaning | Fix |
|---------|---------|-----|
| **Stale specs** | Linear says missing; code already has it | Check repo before coding |
| **Assumed data** | UI expects tables/API fields that don't exist | Probe Supabase before building UI |
| **Skills too late** | Design/testing rules loaded after code written | Load skills before first edit |

---

## Mandatory before any code

### 1. Production state table

Copy into `docs/linear/issues/IPI-*.md` before In Progress.

```markdown
| Area | Exists today? | This PR changes? |
|------|---------------|------------------|
| Route | ✅ /app/shoots/[id] | No |
| Shell | ✅ OperatorPanel | No |
| API | ✅ GET /api/shoots/[id] | Maybe |
| Tabs | 🟡 3 live / 6 placeholders | Yes |
```

**PR #181 example:** Spec said "missing OperatorShell" — reality: `OperatorPanel` in `(operator)/layout.tsx`. Only the **center workspace column** needed reskin.

**Shoot parallel:** IPI-273/274 still say "Wrap OperatorShell." Shell exists. Gap = workspace CSS + DC grid — same as brand pre-#181.

### 2. Data-source table

Required for every tab, list, or panel block.

```markdown
| Tab | Data source | Empty state | Error state |
|-----|-------------|-------------|-------------|
| Team | TBD — probe Supabase | No crew assigned | Retry |
| Schedule | TBD — probe API payload | No schedule yet | Retry |
| Budget | TBD — probe shoot row | No budget yet | Retry |
```

Fill **TBD** with real table/view/RPC names from Supabase MCP **before** creating tab components.

### 3. Negative rules

```markdown
- Do not show fake team members, budget numbers, or schedule dates.
- Do not show score/history/progress fallbacks when API returns null.
- Do not treat fetch failure as empty list (show error + retry).
- If data is missing, show a real empty state or hide the section.
```

**Grep before PR:**

```bash
rg 'DEFAULT_.*HISTORY|dna:\s*87|COMMAND_CENTER_SCORES' app/src --glob '*.ts*'
rg '#FBF8F5|min-h-screen' app/src/app/\(operator\)/app/shoots
```

---

## Stale Linear spec warning

| Audit / Linear claim | Reality on disk (PR #181) |
|----------------------|---------------------------|
| "No OperatorShell" | `OperatorPanel` wraps routes |
| "Missing IntelligencePanel" | IPI-243 shipped |
| "Missing PersistentChatDock" | `OperatorChatDock` exists |
| Rebuild 3-panel shell | Center column only |

**Rule:** `rg` + read route file + browser snapshot **before** planning scope.

---

## Layout-first rule

Wrong order caused fix commits: Features → CSS → review fixes.

```text
1. Inspect production
2. Layout (strip min-h-screen, hex; *.module.css)
3. Components (DC grid/cards)
4. Data (wire API)
5. States (loading · empty · error)
6. QA (browser · Playwright · task-verifier)
```

**Anti-pattern (shoots on main today):**

```tsx
<div className="min-h-screen p-6" style={{ background: "#FBF8F5" }}>
```

Fix in **commit 1** of IPI-273/337 — don't copy forward.

---

## Supabase MCP before tab/API work

Run in Phase 2 (before worktree code):

```text
list_tables        → tab needs a table?
execute_sql        → column/RPC exists?
get_advisors       → RLS before new queries
```

**IPI-337:** Probe Team · Schedule · Budget · Activity sources before tab components.

---

## task-verifier readiness before coding

```text
@task-verifier — execution readiness only (not Done)
Expect 🔴 until production-state + data-source tables filled
Do not implement while 🔴 on API/table/component claims
```

Skills **before first edit:** `tasks` · `design-to-production` · `design-md` · `task-verifier`

---

## One screen family per PR

```text
✅ IPI-337 alone — Shoot Detail tabs
✅ IPI-273 alone — Shoots List
❌ Never mix list + detail + wizard + assets
❌ Never mix docs + code (repo rule)
❌ Do not touch intelligence-panel/* unless separate issue (#164 lock)
```

PR #181 bundled Command Center + Brand List + Brand Detail → large diff, long review.

---

## Browser + Playwright verification

```text
1. cd app && npm run lint && npm test && npm run build
2. Browser MCP — login → route → snapshot @1440 + @375 → console clean
3. Playwright — e2e spec when exists; smoke nav + one interaction minimum
4. Compare side-by-side with DC HTML
5. @task-verifier full gate → attach report to PR
6. Bugbot — 0 unresolved High/Critical
```

Evidence: `docs/ecommerce/evidence/YYYY-MM-DD/ipi-NNN-<slug>/`

Full gate: [`production-readiness.md`](./production-readiness.md)

---

## IPI-337 workflow example

**Task:** DESIGN-054b — Shoot Detail Remaining Tabs (Assets · Team · Schedule · Budget · Approvals · Activity)

```text
1. Read IPI-337 + docs/linear/issues/IPI-337-*.md
2. Check actual code — shoot-detail-client.tsx (3 live / 6 placeholders)
3. Check Supabase — tables/views for each tab (MCP)
4. Fill tab → data-source table in issue md (no TBD at implement time)
5. @task-verifier readiness — expect 🔴 until table complete
6. worktree ipi/337-shoot-detail-tabs
7. Load design-to-production · fashion-production · task-verifier
8. Commit 1 — layout (remove min-h-screen / hex if touched)
9. Build one tab at a time — test after each tab
10. Browser verify — happy + empty + error per tab
11. production-readiness.md gate
12. Open PR — one issue only
```

**Production state (IPI-337 — fill in issue md):**

| Area | Exists today? | This PR changes? |
|------|---------------|------------------|
| Route | ✅ `/app/shoots/[id]` | No |
| Shell | ✅ `OperatorPanel` | No |
| API | ✅ `GET /api/shoots/[id]` | Extend payload if needed |
| Tabs live | ✅ Overview · Shot List · Deliverables | No |
| Tabs placeholder | 🟡 Assets · Team · Schedule · Budget · Approvals · Activity | **Yes** |

Draft data-source table: [`shoot/README.md`](./README.md) § IPI-337 pre-work — **verify with Supabase MCP before coding.**

---

## PR #181 commit map (what review cost)

| Commit | Lesson |
|--------|--------|
| `ab37587` | Feature — too much in one landing |
| `dc2315c` | **Never fabricate DNA history or CC scores** |
| `006f048` | DraftBanner when no workflowRunId |
| `847a382` | Surface scores errors on list |
| `d5731ce` | Graceful degrade scores API |
| `5e2dff4` | Approve wiring · crawl "N of 0" copy |

---

## Shoot files already wrong on main (fix in commit 1)

| File | Smell |
|------|-------|
| `shoots/page.tsx` | `min-h-screen`, `#FBF8F5` |
| `shoot-detail-client.tsx` | same + 6 placeholder tabs |
| `shoots/new/page.tsx` | ~825 LOC inline · hardcoded hex |

---

## Related docs

| Doc | When |
|-----|------|
| [`../lessons.md`](../lessons.md) | One-page summary |
| [`../improve.md`](../improve.md) | Skills · MCP cadence · TASK-CONTRACT |
| [`implementation-checklist.md`](./implementation-checklist.md) | Discovery · reuse · commit order |
| [`production-readiness.md`](./production-readiness.md) | Fake data · a11y · perf · MCP gate |
| [`../docs/handoff/11-screen-checklists.md`](../docs/handoff/11-screen-checklists.md) | Per-screen DoD |

*Update when shoot/campaign/analytics PRs merge new lessons.*
