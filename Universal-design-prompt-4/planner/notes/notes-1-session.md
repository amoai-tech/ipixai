web search find how to improve the plan find different options to setup  for for each explain better  for each task we have multiple options and suggest the best grade scores

A real compliance issue, found by running skill-creator's own validator — pre-existing, not something I introduced, but since I'm applying its best practices now, let me fix it properly.

Applied skill-creator's actual validator, not just eyeballed guidance — found one real, pre-existing compliance issue and fixed it.

## What I checked and fixed

**Ran `skill-creator/scripts/quick_validate.py` against `design-to-production`** — this is skill-creator's own tool for exactly this job, not something I improvised.

**Found:** the skill's frontmatter had a top-level `version: "2.0.0"` field — not one of the 6 allowed frontmatter keys (`name`, `description`, `license`, `allowed-tools`, `metadata`, `compatibility`). This predates today's changes; it's been invalid the whole time, just never checked.

**Fixed:** moved it under `metadata:` (the field that exists specifically for custom key-value data like this) and bumped it to `2.1.0` to reflect today's real addition — the reuse-first gate.

```yaml
metadata:
  version: "2.1.0"
```

**Re-ran the validator:** `Skill is valid!`, exit 0.

## Checked against the rest of skill-creator's guidance

| Rule | Status |
|---|---|
| SKILL.md under 500 lines | 273 lines — clear margin |
| Reference files >300 lines need a table of contents | `reuse-first-checklist.md` is 79 lines — no TOC needed |
| Reference files clearly linked from SKILL.md with guidance on when to read them | Already done — it's #3 in the load order, the first line of Phase 0, and in the References table |
| Domain organization (multi-variant skills split by reference file) | Not applicable — this isn't a multi-framework skill |
| Description is "pushy" enough to avoid under-triggering | Already strong (explicit trigger phrases, "Load before line 1") — left as-is, the reuse gate is a phase within the existing trigger context, not a new one |

Nothing else needed changing — the new reference file and the SKILL.md wiring from earlier were already structured the way skill-creator recommends (progressive disclosure, clear cross-references). The only real finding was the frontmatter schema violation, now fixed.

Good addition — and it's genuinely new value, not a duplicate. Quick gap-check against what already governs this session: **ponytail** already runs the general "does this exist, reuse before building" ladder project-wide, and **design-to-production**'s Phase 0/Plan already has a reuse table for DC screens. What's missing is exactly what you're proposing — a *thorough*, screen-specific checklist (hooks, services, Mastra tools, CopilotKit, workflows — not just components) applied as a hard gate *before* any task exists, plus a standard research-report format. That's a real gap. Adding it as a new reference file in the skill that already owns this workflow, not a competing system.

Now wiring it into the skill so it's actually loaded, not just sitting unreferenced:

## Done — added as a real gate, not just a doc

**New file:** [`reuse-first-checklist.md`](.agents/skills/design-to-production/references/reuse-first-checklist.md) — your 9-question checklist plus the 10 reuse-search categories (I added hooks/services/API routes/Mastra tools/CopilotKit/workflows to your components-focused list, since a screen touches all of those) and your 10-section research-report format.

**Wired in, not orphaned:**
- Now #3 in the skill's mandatory load order (right after the skill itself, before reading the `.dc.html`)
- Added as the *first* line of Phase 0's gate checklist — the existing tables (production state, data-source) now get filled in *from* the checklist's findings, not from assumption
- Listed in the References table at the bottom

**Where it sits relative to what already existed:** `ponytail` runs this philosophy generally, project-wide. `design-to-production`'s Phase 0/Plan already had a *thin* version scoped to components. This fills the real gap — a thorough, screen-specific version that also checks hooks, services, RPCs, Mastra tools, and CopilotKit wiring, applied as a hard gate before any task exists, not just a table filled in alongside the code.

**It's not theoretical — it already worked once today.** The doc opens with the IPI-536/538 simplification as proof: grepping CRM's actual pattern before planning cut both tickets roughly in half. Next time this runs for real is whichever Planner screen or the Notification Center gets picked up next.

Both updated and live.

## What changed

**[IPI-536](https://linear.app/amo100/issue/IPI-536)** — Foundation
- Cut: the event bus, the state-machine library, the shared context/provider
- Kept: the 4 routes, the nav, a simple status-transition checklist, permission checks
- Size: Medium → Small · Estimate: 3-4 days → **2 days**

**[IPI-538](https://linear.app/amo100/issue/IPI-538)** — Data layer
- Cut: the 7 separate "repository" class files, the manual error-cleanup code for half-finished writes
- Replaced with: one file for reading data, one for writing it (same shape as CRM's), plus 2 small database functions — modeled directly on the one that already keeps Won/Lost safe — for the two places that genuinely need "all or nothing"
- Risk: Medium → Low (the tricky part now has the same proven fix CRM already uses) · Estimate: 5-6 days → **3-4 days**

**Combined: 8-10 days of setup work → 5-6 days**, and both tickets are now simpler to actually build, not just shorter on paper — every piece removed was solving a problem this app doesn't have yet, and every piece added has already shipped once in CRM.

Both tickets record *why* inline, so nobody re-argues plain-`useState`-vs-a-library or repository-classes-vs-functions screen by screen later.

One small thing to glance at: a couple of lines in IPI-536's saved text have odd stray backticks around `status-transitions` — cosmetic only, worth a 10-second look in the Linear UI, doesn't affect the actual scope.

## The simple version

I looked into three technical decisions the Planner setup was about to make, and checked them two ways: against what already works in this app (CRM), and against what the wider software industry recommends right now. All three point the same direction: **the plan was about to build something more complicated than it needs to be.**

### 1. Don't add a new "state" tool — just copy what CRM already does

Every screen needs a way to remember things like "which filter is selected" or "which tab is open." CRM does this the simple way — plain React, no extra library — and it's worked fine across all 6 screens with zero bugs from it.

The Planner plan wanted to add three new, more complicated pieces for this (a shared context, an event system, a state tracker) — before a single Planner screen even exists to prove they're needed.

**Simple fix:** copy CRM's approach. Add the fancier stuff later, only if we actually run into a problem that plain React can't solve.

### 2. For "do these 3 things together or none at all" — put that rule in the database, not in the app code

Example: when someone invites a teammate to a plan, three things need to happen — add them to the plan, log an event, and (eventually) send a notification. If step 2 fails after step 1 succeeded, you get a half-done, confusing state.

I found out the app's toolkit (Supabase) genuinely **can't** guarantee "all-or-nothing" from the website code itself — that's a real, confirmed limitation, not a guess.

But there's already a working example of the *correct* fix sitting right here in CRM: the "mark a deal Won or Lost" button uses one database function that does everything in one safe step — either all of it happens, or none of it does. It's called `crm_convert_deal`, and it's already tested and shipped.

**Simple fix:** build the invite feature the same way — one small database function that does the whole thing safely, instead of writing extra code to clean up after a half-finished action.

### 3. Don't build 7 separate "manager" files for talking to the database — just write plain functions, like CRM does

The plan wanted 7 separate class-style files (one for tasks, one for members, one for settings, etc.) as a formal system for reading/writing data.

CRM does the same job with a much simpler approach: one file of straightforward functions (`listCompanies()`, `updateDealStage()`, etc.). It's easier to read, easier to test, and it's already proven across 6 real screens.

**Simple fix:** use that same simple style for Planner instead of the more complex 7-file system.

---

## Bottom line
All three changes make the Planner setup **smaller and safer to build**, not bigger. Nothing here adds work — it removes work that wasn't needed, by copying what already works.

Want me to update the two setup tickets ([IPI-536](https://linear.app/amo100/issue/IPI-536) and [IPI-538](https://linear.app/amo100/issue/IPI-538)) to reflect this simpler plan?

Strong signal already in the codebase — let me confirm it and cross-check against current industry guidance.

## Research done — here's the verdict, and it's more decisive than expected

Two of the three architecture decisions Planner is about to make (state management, data-write atomicity) already have a **proven answer sitting in this exact codebase** — CRM shipped 6 screens without needing either of the more complex approaches Planner's tickets currently plan to build. External research confirms the simpler approach is also the current industry-standard one, not just "what we happened to do."

### 1. State management — use what CRM already proved, don't add anything new

**Evidence:**
- I grepped every CRM component (`pipeline-workspace.tsx`, `deal-detail-workspace.tsx`, etc.) — **zero state libraries installed** (`package.json` has no Zustand/Redux/Jotai/React Query). Every screen uses plain `useState` + Server Components. Zero state-management bugs anywhere in `lessons.md`.
- 2026 Next.js guidance is explicit: *"avoid using a global store... choose libraries based on actual data origin and update frequency rather than tradition."*

**The problem:** [IPI-536](https://linear.app/amo100/issue/IPI-536) currently plans a custom `PlannerContext`/`PlannerProvider`, a custom typed event bus, and a custom state machine — before a single screen exists to prove any of that's needed. Pipeline has comparable complexity (multiple filters, at-risk state, live data) and needed none of it.

**Recommendation:** Default to the CRM pattern — RSC fetch + `useState` per page. Cut the event bus and state machine from IPI-536's v1 scope entirely. If Timeline/Kanban/Calendar/List genuinely can't stay in sync without one once they're built, add it then, against a real, observed problem — not preemptively.

### 2. Multi-table writes — use a Postgres RPC, not hand-rolled error accumulation

**Evidence:**
- Confirmed directly from Supabase's own GitHub discussion: **`supabase-js` has no client-side transaction support at all** — it's built on PostgREST, which can't do it.
- Postgres functions (RPCs) *are* atomic by default — no `BEGIN`/`COMMIT` needed, any error rolls back automatically. This is exactly what `crm_convert_deal` already does in this repo, tested and shipped.

**The problem:** [IPI-538](https://linear.app/amo100/issue/IPI-538) plans to handle the invite flow's multi-table write (assignment + event + notification) with hand-rolled TypeScript: *"assignment succeeds, event failure is non-fatal (logged)"* — accepting silent partial failure as the design, because it assumes no transaction mechanism exists.

**Recommendation:** It exists — this codebase already built and proved it. Write a small `planner_invite_member` Postgres function modeled directly on `crm_convert_deal`, and the same for `createInstance()`'s task+dependency batch insert. This deletes IPI-538's entire "partial-failure handling strategy" section and closes off the exact bug class lessons #10-12 already found once in CRM (silent partial success, error-string fragility).

### 3. Repository pattern — match CRM's actual shape, not a new one

**Evidence:** Search results converge on: simple typed query functions are the standard recommendation; formal repository-class abstractions become worth it only once you need transactions — which, per #2 above, should live in Postgres anyway, not in a TypeScript repository layer.

**Recommendation:** Collapse IPI-538's 7 separate `XRepository.ts` class files into the CRM-proven shape — typed functions (can still be split across a few files by concern), not a formal Repository-per-table OOP pattern. One less new pattern for the team to learn; matches what's already shipped.

---

## Net effect if you apply this
IPI-536 and IPI-538 both get **smaller and lower-risk**, not larger — this cuts scope, it doesn't add process. Want me to rewrite both tickets' scope sections to reflect this before anyone starts building?

Sources:
- [React Server Components in 2026: Patterns, Pitfalls, and When to Actually Use Them](https://jsmanifest.com/react-server-components-patterns-pitfalls-2026)
- [React State Management in 2026: The Complete Practical Guide](https://www.devkantkumar.com/blog/react-state-management-2026)
- [Client-side database transactions · supabase · Discussion #526](https://github.com/orgs/supabase/discussions/526)
- [Supabase Data Integrity: Guarantee Atomicity Using PostgreSQL RPC](https://openillumi.com/en/en-supabase-transaction-rpc-atomicity/)
- [Data Integrity First: Mastering Transactions in Supabase SQL](https://dev.to/damasosanoja/data-integrity-first-mastering-transactions-in-supabase-sql-for-reliable-applications-2dbb)
- [How I Use Supabase RPCs in My Next.js Projects](https://blog.stackademic.com/how-i-use-supabase-rpcs-in-my-next-js-projects-9d91b0a2115c)
## Production Planner — Setup Task Plan

**What it is:** the screen where an operator sees every job in flight (shoots, campaigns, deals), what's theirs today, and what needs their approval — with an AI assistant that drafts moves but never executes without a human clicking approve.

**Where it stands today:** backend is solid (schema, engine, AI agent — 96/100, 1,180 tests passing). Frontend is at 0% — typing `/app/planner` gives a 404. Nothing is connected yet.

---

### The plan, in build order

| # | Ticket | What it does | Status | Blocked by |
|--:|---|---|---|---|
| 1 | [IPI-536](https://linear.app/amo100/issue/IPI-536) | Foundation — the 4 route pages, nav, state management, permissions | Backlog, not started | Nothing — **start here** |
| 2 | [IPI-538](https://linear.app/amo100/issue/IPI-538) | Data layer — 7 typed functions (like `listInstances()`, `updateTask()`) so every screen reads/writes the same safe way | Backlog, not started | IPI-536 (real relation, fixed today) |
| 3 | [IPI-479](https://linear.app/amo100/issue/IPI-479) | Dashboard + Settings screens | Backlog | IPI-536, IPI-538 |
| 4 | [IPI-526](https://linear.app/amo100/issue/IPI-526) | Hub — the plan-list homepage at `/app/planner` | Backlog (just reopened — was wrongly marked Done) | IPI-536, IPI-478 |
| 5 | [IPI-478](https://linear.app/amo100/issue/IPI-478) | Workspace — the actual working screen (Timeline/Kanban/Calendar/List). This is the one genuinely new, higher-risk piece | Backlog | IPI-536, IPI-538 |

All 5 now sit as direct children of the epic ([IPI-484](https://linear.app/amo100/issue/IPI-484)) — not nested inside each other, which was confusing the dependency picture until this session's fix.

### Why this order
1 and 2 are pure plumbing — no screen can load or save data without them. Once they land, the screens can build in parallel-ish, but the design doc's own frozen order is: **Dashboard first** (simplest, proves the shell works), **then Hub**, **then Workspace** (the hard one — do it once the pattern is proven), **then Settings**.

### Rough timeline
IPI-536: 3-4 days. IPI-538: 5-6 days — but its 7 data functions don't all need IPI-536's routes to exist, only the "invite a member" piece does, so there's room to run them partly in parallel rather than fully back-to-back. Call it ~1.5–2 weeks before the first real screen is clickable.

### The one thing to fix before starting
`scripts/verify-planner-scenario.mjs` — the script that actually runs a real scenario against the live database — is currently broken (`ERR_UNKNOWN_FILE_EXTENSION`). Fix this as part of IPI-538, not after. It's the only tool that would catch a bug like the one CRM shipped — a database function that looked fine in every test but had never actually worked (see `lessons.md` #10).

### Next action
Start [IPI-536](https://linear.app/amo100/issue/IPI-536). Want me to set up the worktree and begin?

.Good proposal — but before building any of this, I checked: **most of it already exists.** There's a mature `design-to-production` skill (v2.0.0) with a 6-phase workflow, Phase 0 gates, and a regression-guardrail table. Building your 8-stage process alongside it would mean two competing systems doing the same job. Better move: patch the real gaps into the skill that already runs, so it's one system, not two.

## What already covers your proposal

| Your stage | Already exists as |
|---|---|
| 1. Design extraction | Phase 0 + "1. Discover" — reads the `.dc.html`, fills a production-state table |
| 2. Data-readiness check | Phase 0's "Data-source table — Supabase MCP probe" |
| 3. Component reuse audit | "3. Plan" — Reuse/Create/Defer/Out-of-scope table |
| 4. Skeleton-first build order | "4. Implement" — RSC page → `loading.tsx` → CSS → wire data |
| 6. Verify every state | "5. Verify" — Playwright + browser QA + screenshot-per-state |
| 7. Release gates | "Checklist before merge" |

## 4 real gaps — found by diffing your proposal against what's live

1. **Reuse claims aren't required to be grep-verified.** The Plan phase lists a reuse table, but nothing forces proving the import actually landed — exactly lesson #2 (`CldImage` claimed reused, never actually called).
2. **No "one service layer" rule at the skill level.** CRM has `queries.ts`, Planner has `repositories/` — but that's per-feature discipline, not a rule the skill itself states for every future screen.
3. **No explicit rebase-before-merge gate.** Two of today's real bugs (lessons #4, #13) were exactly this — a stale branch silently reintroducing fixed code.
4. **The skill's own lessons table is disconnected from `lessons.md`.** The skill has a 10-item "Regression guardrails" table from IPI-383/372. `lessons.md` now has 16 entries + a Top 10. They don't reference each other — someone reading one has no idea the other exists.

Patching these into the skill now:

## What I changed (concrete, not a new process)

Three additions to the actual skill everyone already loads for this work:

1. **Reuse table → grep-proof requirement.** Added the exact `rg` command to the merge checklist. Closes lesson #2's gap directly.
2. **One typed data-access function per operation.** Added to Phase 3 (Plan) and the merge checklist — this is now a stated rule, not just something CRM/Planner happen to do independently.
3. **Rebase-before-review gate.** Added to the merge checklist, citing the two real bugs it would have caught today (lessons #4, #13).
4. **Linked `lessons.md` ↔ the skill's own guardrail table** so they reinforce each other instead of silently diverging (they'd drifted apart — 10 old items vs. 16 newer ones, no cross-reference).

## Where I'd push back on the proposal

Two pieces would add real process weight without matching how work has actually shipped here:

- **A separate `design-extraction.md` deliverable per screen** — the skill already gets this via inline tables in the Linear issue body (Phase 0's production-state table + data-source table). That pattern has shipped 24 CRM PRs. A new standalone doc per screen is a parallel format for the same information — skip it, keep using the issue body.
- **The screen-conversion task template file** — same reasoning. `screen-checklists.md` + Phase 0 tables already do this job; a second template risks becoming the thing nobody keeps in sync (exactly the "two divorced lesson lists" problem I just fixed).

Your **8-step build order** (Shell → shared components → Dashboard → Hub → Workspace → Settings) is good, but it's not new — it's the *same* order `planner-react-onboarding.md` §4 already froze, with reasoning per step. One risk to flag: your parallel-streams sketch put Members/Settings before Workspace; the frozen doc puts Hub before Workspace and Settings after. Don't merge a third ordering — the onboarding doc's order is the one to build against, since "frozen" there specifically means *don't redesign during implementation*.

## Net result
One skill, patched with your 4 real improvements, still the single thing to load before touching any `.dc.html` — instead of a second competing framework to keep in sync by hand.

First, re-parenting both under the epic:

Re-parented — both now sit directly under [IPI-484](https://linear.app/amo100/issue/IPI-484) as siblings of 478/479/526, not nested inside 478.

Now reviewing the audit doc itself for errors — I already read it in full earlier. Found two real inaccuracies plus one staleness issue. Let me verify the exact wording before fixing.

Confirmed both errors precisely. Fixing them now, plus updating the two things that have changed since this audit was written.

Now the two staleness items — SCR-35's "no Linear issue" claim and the matching action item.

Adding a status banner at the top for discoverability, matching the pattern used on the CRM audit doc.

## Summary

**Linear structure fixed:**
- [IPI-536](https://linear.app/amo100/issue/IPI-536) and [IPI-538](https://linear.app/amo100/issue/IPI-538) re-parented from under IPI-478 to directly under the epic ([IPI-484](https://linear.app/amo100/issue/IPI-484)) — they were nested inside one of the tickets they block, which read backwards

**Audit doc (`planner-audit.md`) — 4 real problems found and fixed:**
1. A citation error — the reasoning for why IPI-479 (Dashboard + Settings) "will succeed" cited "SCR-30" (CRM Pipeline) as a reuse source. That screen has nothing to do with Dashboard or Settings — looks like cross-contamination from the CRM audit written the same day. Corrected to the real sources.
2. An internal contradiction — the doc's own scoring legend says 0-39 = ⚫, but 4 scores in that exact range (Foundation, Data Layer, Frontend, Production Readiness) were colored 🔴 instead. Fixed to match the stated scale.
3. Stale — the doc still said SCR-35 "has no backing Linear issue." [IPI-526](https://linear.app/amo100/issue/IPI-526) was opened that same day (and its own status wrinkle is now noted inline).
4. Added a correction banner at the top so anyone opening the doc sees the fixes without hunting for them.

**Nothing here changes the actual verdict** — Planner is still not production ready, still 42/100, foundation (IPI-536/538) is still the real next step. These were accuracy fixes to the report, not new findings about the codebase.

Found something important while checking this — one of the tickets is actively lying about its status. Let me walk through what I found, worst issue first.

## 🔴 Critical: IPI-526 (Planner Hub) is marked Done, but it isn't

[IPI-526](https://linear.app/amo100/issue/IPI-526) shows **Done**, linked to PR #338. I checked that PR's actual file list — it's **100% AWS Bedrock provider fallback code in the Cloudflare Worker**, zero Planner files touched. The two tickets just happened to share the number "526" in their branch names, and Linear auto-linked the wrong PR to the wrong issue. The real Planner Hub route (`/app/planner`) still doesn't exist — confirmed by the audit doc *and* by this PR check. Reopening it now:

Both fixed and live. Here's the full picture on how to improve the plan:

## Fixed just now
1. **[IPI-526](https://linear.app/amo100/issue/IPI-526) reopened** — was falsely Done, linked to an unrelated Bedrock PR that happened to share its ticket number
2. **[IPI-538](https://linear.app/amo100/issue/IPI-538) → real "blocked by IPI-536" relation added** — text said it, the relation graph didn't (same bug class as [lesson #6](Universal-design-prompt-4/lessons.md))

## Still worth doing, in priority order

**1. Fix the confusing ticket hierarchy.** IPI-536 and IPI-538 are currently nested as *children* of IPI-478 in Linear — but both tickets block IPI-478, IPI-479, *and* IPI-526 equally. A child ticket "blocking" its own parent reads backwards to anyone browsing the epic. Re-parent 536 and 538 directly under the epic (IPI-484) as siblings of 478/479/526, and let the `blockedBy` relations (already correct on 538, needs the same on 478/479/526) carry the real dependency — not the parent/child nesting.

**2. Split the foundation work to unblock screens sooner.** IPI-538's repository classes (`TaskRepository`, `AssignmentRepository`, etc.) don't actually need IPI-536's routes to exist — only the *server actions* do. Right now the plan reads as a strict 3-4 days → then 5-6 days sequential (up to 10 days before any screen work starts). The 7 repository files could be written and unit-tested in parallel with IPI-536, cutting real wall-clock time.

**3. Fix the broken verification script before it's needed.** `scripts/verify-planner-scenario.mjs` is currently broken (`ERR_UNKNOWN_FILE_EXTENSION`). This is exactly the tool that would have caught the CRM bug from lesson #10 (an RPC that never actually worked, invisible to typecheck/lint/test). Fix it as part of IPI-538, not as an afterthought — it's the only thing that proves the repository layer actually talks to a live database correctly.

**4. Resolve the 5 open design questions before the tickets that need them start** (from `planner-react-onboarding.md` §2A) — right now they're just sitting in a doc, not written into any ticket's AC:
   - Calendar view: chips or status bars? → needs answering before IPI-478's `PlannerCalendar`
   - Exact per-role stat set on the Dashboard → needs answering before IPI-479
   - Nav active-state convention for Settings vs. Planner → needs answering before IPI-536's nav wiring
   
   This is lesson #5's guard — an undocumented scope decision left for the implementer to guess is exactly what caused silent divergence bugs before.

**5. Clean up ~10 old Planner worktrees before starting fresh** (`wt-ipi-476-*`, `wt-ipi-477-*` — I count 10 in the worktree list). Per lesson #13, a stale branch that's never been rebased since `main` moved on can silently reintroduce already-fixed bugs if someone accidentally works from one of these instead of a fresh worktree.

**One thing that's already good:** IPI-478 itself is well-hardened — it already has AC items F through I added from a design audit (component reuse, keyboard operability, mobile strategy, ApprovalCard props) that read like they were written *with* the lessons doc in mind. That's the bar the other tickets should match.

Now I have precise, PR-body-verified details (not relying on memory) for the genuinely new problems — none of which duplicate the 9 lessons already in the file. Appending 7 new entries.

Added 7 new lessons (#10–16) to `Universal-design-prompt-4/lessons.md`, all pulled from actual PR bodies, not memory — none duplicate the existing 9.

## What I found reviewing the 24 CRM PRs

| # | From PR | The real problem |
|---|---|---|
| 10 | #337 | `crm_convert_deal` had **never worked** since deployment — a `RETURNS TABLE` clause shadowed its own column names. Every automated check (typecheck/lint/test/build) stayed green the whole time because none of them execute SQL. Only found by actually running it against live Postgres — which itself needed Node 22, since Node 20 (the repo default) can't open the WebSocket supabase-js's realtime client needs |
| 11 | #337 | A plain foreign key (`crm_deals.company_id`) isn't an authorization guarantee — a mismatched cross-org company could silently create an orphaned brand record |
| 12 | #337 | Client code that string-matches a server error message broke silently the moment a migration changed the wording — a rejected user got a 500 instead of a 403 |
| 13 | #262→#265 | A stale, never-rebased branch would have **regressed already-shipped security hardening** if merged as-is |
| 14 | #265 | Seed script let a failed user lookup cascade `undefined` into every downstream foreign key instead of failing fast |
| 15 | #270 | The reduced-motion accessibility fix missed Tailwind's own `animate-pulse` utility — every loading skeleton **app-wide** ignored the user's motion preference, not just CRM's |
| 16 | #272 | A comment claiming "these two screens share behavior" was trusted and copy-pasted into the next screen without checking that screen's own design file — it was wrong |

Each entry follows the file's existing format: what happened, why it's a trap, and a concrete guard for next time.

Verified via `gh pr list` against the actual GitHub history — here's the real CRM PR set, in build order:

## Foundation
| PR | Ticket | What it shipped |
|---|---|---|
| [#212](https://github.com/amo-tech-ai/lumina-studio/pull/212) | IPI-362 | The 4 CRM database tables + security rules |
| [#259](https://github.com/amo-tech-ai/lumina-studio/pull/259), [#262](https://github.com/amo-tech-ai/lumina-studio/pull/262), [#265](https://github.com/amo-tech-ai/lumina-studio/pull/265) | IPI-451 | Test/seed data for the CRM tables (3 follow-up fixes) |

## Shared building blocks (used across all CRM screens)
| PR | Ticket | What it shipped |
|---|---|---|
| [#237](https://github.com/amo-tech-ai/lumina-studio/pull/237) | IPI-385 | Status badges + CRM color tokens |
| [#238](https://github.com/amo-tech-ai/lumina-studio/pull/238) | IPI-386 | Reusable empty/error state components |
| [#246](https://github.com/amo-tech-ai/lumina-studio/pull/246) | IPI-387 | Reusable list-screen template |
| [#268](https://github.com/amo-tech-ai/lumina-studio/pull/268) | — | Shared detail-page helpers + activity timeline |

## The 6 screens
| PR | Ticket | Screen |
|---|---|---|
| [#215](https://github.com/amo-tech-ai/lumina-studio/pull/215), [#253](https://github.com/amo-tech-ai/lumina-studio/pull/253), [#270](https://github.com/amo-tech-ai/lumina-studio/pull/270) | IPI-363/388/389 | Companies List |
| [#269](https://github.com/amo-tech-ai/lumina-studio/pull/269) | IPI-391 | Company Detail |
| [#218](https://github.com/amo-tech-ai/lumina-studio/pull/218), [#272](https://github.com/amo-tech-ai/lumina-studio/pull/272) | IPI-364/390 | Contacts List |
| [#274](https://github.com/amo-tech-ai/lumina-studio/pull/274) | IPI-392 | Contact Detail |
| [#275](https://github.com/amo-tech-ai/lumina-studio/pull/275) | IPI-395 | Pipeline (kanban board) |
| [#311](https://github.com/amo-tech-ai/lumina-studio/pull/311) | IPI-396 | Deal Detail |
| [#344](https://github.com/amo-tech-ai/lumina-studio/pull/344) + [#346](https://github.com/amo-tech-ai/lumina-studio/pull/346) | — | Deal Detail layout fix + its regression test |

## The AI assistant (wave 1) + the safety-critical Won/Lost feature
| PR | Ticket | What it shipped |
|---|---|---|
| [#220](https://github.com/amo-tech-ai/lumina-studio/pull/220), [#221](https://github.com/amo-tech-ai/lumina-studio/pull/221) | IPI-368 | The CRM chat assistant — search, log notes, move deals |
| [#337](https://github.com/amo-tech-ai/lumina-studio/pull/337) + [#341](https://github.com/amo-tech-ai/lumina-studio/pull/341) | IPI-367 | The human-approval gate for marking a deal Won/Lost, plus auto-creating a Brand record on Won |
| [#343](https://github.com/amo-tech-ai/lumina-studio/pull/343) | — | Doc fix from that work — always check the live database before trusting a migration file |

**24 PRs total.** Everything above is merged and live. What's *not* in this list — because it hasn't been built yet — is the AI "wave 2" (health scores, AI summaries, draft follow-ups) and the mobile layouts, which is exactly the work the tickets we fixed today ([IPI-369](https://linear.app/amo100/issue/IPI-369), [IPI-572](https://linear.app/amo100/issue/IPI-572), etc.) are scoped to cover.

I've been working directly in the main checkout — `/home/sk/ipix`, on branch `ipi/525-model-registry` — not in a separate worktree.

That's fine for what's actually happened this session: everything was either Linear ticket edits (via MCP, not local files) or local doc edits (`crm-linear-audit.md`, restoring `lessons.md`) — no app code was touched, so there was nothing requiring the worktree workflow.

**Worth flagging:** `ipi/525-model-registry` is an unrelated branch (model registry work) — none of today's CRM/Planner/Notification-Center work belongs there. If we start real code (like the Notification Center build), that needs its own worktree per the repo's rule, e.g.:
```bash
git worktree add ../wt-ipi-407-notification-center -b ipi/407-notification-center-inbox
```

Want me to set that up now, or hold off until we've picked the actual next task?

## Production Planner — Plain-English Summary

**What it is:** A workspace where an operator can see every job in flight (shoots, campaigns, deals), what's assigned to them today, and what needs their sign-off — with an AI assistant that drafts moves but never executes anything without a human clicking approve.

## The gap in one sentence
**The engine is built and tested. The screens are fully designed. Nothing connects them yet — there isn't a single working page.**

| Layer | Score | Plain meaning |
|---|---|---|
| Backend (database, scheduling logic, AI agent) | 96/100 🟢 | Solid. 1,180 tests pass. |
| Design (the 4 screens, pixel-exact) | 86/100 🟢 | Fully designed, ready to build from. |
| Frontend (actual working pages) | 5/100 🔴 | Typing `/app/planner` into the browser gives a 404. There is no Planner in the app today. |

## The 4 screens

| Screen | What it does | Status |
|---|---|---|
| **Hub** | The homepage — a grid of every plan, filterable, shows which ones need attention | Designed, not built |
| **Dashboard** | "What's mine today" — your approvals, at-risk items, this week's tasks | Designed, not built |
| **Workspace** | The actual working screen — Timeline/Kanban/Calendar/List views of one plan, where approvals happen | Designed, not built |
| **Settings** | Who has access to this plan, invite people | Designed, not built |

## Why nothing is built yet — 2 pieces are missing first
1. **No pages exist at all** — not even empty placeholder pages. Nobody has created the `/app/planner` route.
2. **No way to save or load data** — even if the pages existed, there's no code connecting them to the database yet.

Everything else (all 4 screens) is blocked behind these two. This is why the plan calls them out as step 1 and step 2 before any screen work starts.

## Recommended build order (from the design team's own onboarding doc)
1. **Basic pages + data connection** — the two blockers above (~1 week combined)
2. **Dashboard** — simplest screen, good confidence-builder
3. **Hub** — reuses the existing Shoots-list pattern, low risk
4. **Workspace** — the big one; only genuinely new piece of UI in the whole feature (the Timeline view)
5. **Settings** — isolated, low risk
6. Mobile versions, then wiring the AI assistant in last

## Bottom line
Planner is **not a "which screen next" decision** the way CRM was — every screen is equally blocked on the same two missing pieces. The real next step is building the plumbing (pages + data layer), not picking a screen.

**One open item:** the Hub screen didn't have a Linear ticket at all until this was audited — it's since been opened as [IPI-526](https://linear.app/amo100/issue/IPI-526).

Want me to start on the plumbing (IPI-536 + IPI-538), or would you rather stay on Notification Center since that one's fully unblocked today?
Reviewed all 37 files in that folder against the live route tree in `app/src/app/(operator)/app/`. Here's the real conversion status — not from doc claims, from actual `page.tsx` files found on disk.

## 🟢 Converted (15 screens)

| Screen | Route |
|---|---|
| Command Center | `/app` |
| Shoots List | `/app/shoots` |
| Shoot Detail | `/app/shoots/[shootId]` |
| Shoot Wizard | `/app/shoots/new` |
| Brand List | `/app/brand` |
| Brand Detail | `/app/brand/[id]` |
| Assets | `/app/assets` |
| Onboarding (brand) | `/app/onboarding` |
| Matching (talent tab only) | `/app/matching` — Creator/Asset/Product tabs still disabled shells |
| CRM Companies List | `/app/crm/companies` |
| CRM Company Detail | `/app/crm/companies/[id]` |
| CRM Contacts List | `/app/crm/contacts` |
| CRM Contact Detail | `/app/crm/contacts/[id]` |
| CRM Pipeline | `/app/crm/pipeline` |
| CRM Deal Detail | `/app/crm/pipeline/[id]` |

## 🟡 Route exists, but it's a placeholder, not a real conversion

| Screen | What's actually there |
|---|---|
| Campaigns | `/app/campaigns` just shows "Coming soon" — no real screen built yet |

## 🔴 Not converted (13 screens, zero route exists)

| Screen | Note |
|---|---|
| Notification Center (SCR-15) | What we're already scoped to build next |
| Analytics | No route |
| Campaign Performance | No route |
| Channel Preview | No route |
| Talent Profile (SCR-20) | Part of the Talent Booking feature, currently on hold |
| Availability Editor (SCR-23) | Same feature, on hold |
| Talent Onboarding (SCR-24) | Same feature, on hold — different from Brand Onboarding, which **is** built |
| Role Dashboards (SCR-25) | No route |
| Collaboration Audit (SCR-18) | No route |
| Planner Workspace (SCR-32) | Backend is done, zero screen built |
| Planner Dashboard (SCR-33) | Same — zero screen |
| Planner Instance Settings (SCR-34) | Same — zero screen |
| Planner Hub (SCR-35) | Same — zero screen |

## 📱 Separate category: mobile versions (5 spec files, 0 built)
None of the phone-sized layouts exist anywhere in the app yet — not CRM's, not Bookings', not Planner's, not general. This isn't "screens to convert," it's a whole responsive layer that's missing across the board.

---

**Bottom line:** 15 of 29 real screens are converted (52%). The single biggest missing *finished feature* is **Planner** — 4 screens, fully designed, backend already built and tested, zero UI. Want me to switch focus there instead of Notification Center, or stick with Notification Center since it's smaller and self-contained?


Graphify's index doesn't have clean hits on this — falling back to direct grep + live Supabase checks, per the ticket's own cited files.

Verified against the live database and codebase (not just the ticket text). Here's what's actually needed:

## Backend — already done, nothing to build

✅ Database table `notifications` exists live (confirmed via Supabase). ✅ Both database functions (`list_notifications`, `mark_notifications_read`) exist and work. ✅ The two API endpoints already exist: `app/src/app/api/notifications/route.ts` and `.../read/route.ts`. ✅ The typed service layer (`notification-service.ts`) already wraps both functions — and it already returns a `deep_link` for each notification, so "click → go to the right page" is free, no routing logic to invent.

**One gotcha I found that the ticket doesn't mention:** the `notifications` table has no title/message text column — just `kind`, `payload` (a JSON blob), and a few ids. Whatever renders each row has to build its display text from `kind` + `payload`, not read a ready-made sentence. Worth knowing before writing the row component.

## Frontend — this is the actual work (5 steps)

**1. Build the page** — `/app/inbox` doesn't exist yet (confirmed, zero files). New route: `app/src/app/(operator)/app/inbox/page.tsx`.

**2. Build 3 small components** — none exist yet:

- `inbox-workspace.tsx` — fetches notifications, groups them by date (Today/Yesterday/This Week), handles loading/empty/error
- `notification-row.tsx` — one row: icon, title (built from `kind`+`payload`), timestamp, unread dot
- Reuse existing `EmptyState`, `ErrorState`, `Skeleton` components (all three already exist in `app/src/components/ui/` — don't rebuild them)

**3. Wire "mark as read"** — clicking a row calls the existing `/api/notifications/read` endpoint, then follows that row's `deep_link`.

**4. Add the sidebar link** — `nav-sidebar.tsx` has a simple list of nav items (Home, Shoots, CRM, Brand...). Add "Inbox" to that list. Note: the sidebar has no unread-count badge today — that's a small new piece to add, not something to wire into existing code.

**5. Verify** — resize to 1280px and 390px, confirm all 5 states (populated/loading/empty/error/marking-read) look right, run `npm run typecheck && npm test`.

Want me to start on step 1?

Based on everything corrected and clarified this session, here's the recommended order:

## 0. Housekeeping first (uncommitted, on the wrong branch)
The `crm-linear-audit.md` edit is sitting **untracked** on `ipi/525-model-registry` — a branch about an unrelated Workers AI tool-calling feature. Per the repo's own hard rule (never mix concerns in one PR), this should move to its own docs-only branch/commit:
```bash
git worktree add ../wt-crm-audit-doc -b docs/crm-linear-audit-reconciliation
# copy the file change over, commit, PR — docs-only, --no-verify is fine here (no code to typecheck)
```

## 1. Start the highest-leverage ticket
**[IPI-369](https://linear.app/amo100/issue/IPI-369) — Smart deal insights.** Urgent priority, zero live blockers, and it unblocks IPI-370 (final QA gate) and IPI-375 downstream. This is the single biggest lever in the whole CRM backlog right now.

## 2. Two near-zero-cost closes (bookkeeping, not engineering)
| Ticket | What's left |
|---|---|
| [IPI-373](https://linear.app/amo100/issue/IPI-373) | Link the design artifact in IPI-396's comments, mark Done — code side is already shipped |
| [IPI-566](https://linear.app/amo100/issue/IPI-566) | One drift-scan check, then close — its only real AC item was already satisfied by PR #337 |

## 3. Ready-now frontend work (parallelizable, no blockers)
[IPI-571](https://linear.app/amo100/issue/IPI-571) (pipeline colors), [IPI-562](https://linear.app/amo100/issue/IPI-562) (New/Filter), [IPI-563](https://linear.app/amo100/issue/IPI-563) (owner filter + keyboard move + mobile accordion), [IPI-572](https://linear.app/amo100/issue/IPI-572) (mobile chrome), [IPI-374](https://linear.app/amo100/issue/IPI-374) (dynamic greetings) — none of these wait on IPI-369 and can run alongside it.

## 4. Correctly stays deferred, no action needed
IPI-403 (optional RPCs, Low priority) and the whole Post-MVP set (375/376/378/379/380/381/382) — all properly blocked by IPI-370, which itself waits on IPI-369.

Want me to spin up a worktree and start on IPI-369, or handle the doc-commit housekeeping first?

Now I have full content for all 19. Rather than touch every single one, I'll focus effort where it matters: titles that are genuinely jargon-heavy, and descriptions missing (or burying) a plain-English opener. Applying fixes now, starting with the worst offenders.

Finally, IPI-568 — add a plain-English executive summary at the top, and update its §10 note (which currently says title renames were "left as-is pending an actual product decision") since you've now made that decision.

All 19 tickets reviewed, 9 titles simplified, and 3 descriptions gained a proper plain-English opener.

## Summary

**Titles simplified (real-world language, jargon dropped):**

| Ticket | Old | New |
|---|---|---|
| [IPI-369](https://linear.app/amo100/issue/IPI-369) | "crm-assistant agent — wave 2 (health scoring, summarization, drafting) + IntelligencePanel sections" | **Smart deal insights — health scores, relationship summaries, follow-up drafts** |
| [IPI-373](https://linear.app/amo100/issue/IPI-373) | "Claude Design screen prompts — completion (WIP)" | **Finish design sign-off for the Deal Detail screen** |
| [IPI-374](https://linear.app/amo100/issue/IPI-374) | "Route welcome + suggestion chips for /app/crm/* — dynamic personalization + route-name fix" | **Make CRM chat greetings show real data, not generic text** |
| [IPI-379](https://linear.app/amo100/issue/IPI-379) | "AI Timeline & Memory (cross-entity history)" | **Full relationship history across every record** |
| [IPI-403](https://linear.app/amo100/issue/IPI-403) | "CRM convenience RPCs (optional P3)" | **Extra database shortcuts for common CRM actions (optional, low priority)** |
| [IPI-566](https://linear.app/amo100/issue/IPI-566) | "Regenerate types/supabase.ts for crm_convert_deal" | **Clean up leftover type-safety workaround for deal conversion** |
| [IPI-568](https://linear.app/amo100/issue/IPI-568) | "CRM Frontend, Backend, AI, and Production Readiness Tracker" | **CRM Project Tracker — what's built, what's left, what's next** |
| [IPI-571](https://linear.app/amo100/issue/IPI-571) | "Fix Pipeline stage color tokens + column total placement (SCR-30 parity)" | **Fix pipeline board colors and totals to match the design** |
| [IPI-572](https://linear.app/amo100/issue/IPI-572) | "Mobile responsive implementation — shared chrome + Companies/Contacts/Detail/Deal Detail" | **Make CRM work on phones — Companies, Contacts, and Deal Detail** |

**Descriptions gained a plain-English opener** (previously missing or buried under technical content): IPI-369 (moved above the Cloudflare provider-routing block), IPI-374, IPI-403. IPI-380's stale internal header ("AI Digital Twin") was also synced to match its already-renamed title.

**Left alone:** IPI-370, 375, 376, 378, 381, 382, 407, 562, 563 already opened with a clear "In plain terms" paragraph — not rewritten for its own sake.

**IPI-568** (the master tracker) got a new §11 documenting this whole pass, plus its §10 note was corrected — it previously said the naming decision was "left as-is pending an actual product decision"; that's now recorded as resolved by you.


Verified all 11 corrections live in Linear via fresh `get_issue` fetches — every one matches what was submitted.

| Ticket | Verified live |
|---|---|
| [IPI-373](https://linear.app/amo100/issue/IPI-373) | ✅ "third audit pass" correction present, IPI-396 shown Done (PR #311), table row 🟢 |
| [IPI-566](https://linear.app/amo100/issue/IPI-566) | ✅ Cast-removal AC items checked `[X]`, correction text present |
| [IPI-403](https://linear.app/amo100/issue/IPI-403) | ✅ Gap table shows `convert_deal` 🟢 live via IPI-367, removed from Proposed RPCs |
| [IPI-571](https://linear.app/amo100/issue/IPI-571) | ✅ Primitive-token corrections present in both color ACs |
| [IPI-563](https://linear.app/amo100/issue/IPI-563) | ✅ "owner filter is not net-new UI" correction present, scope bullet updated |
| [IPI-376](https://linear.app/amo100/issue/IPI-376) | ✅ Security correction present, AC A2/A3 rewritten, milestone = CRM-M5 |
| [IPI-369](https://linear.app/amo100/issue/IPI-369) | ✅ Correction present, live `blockedBy` confirmed empty as described |
| [IPI-379](https://linear.app/amo100/issue/IPI-379) | ✅ Ownership decision present — owns the fetch helper |
| [IPI-382](https://linear.app/amo100/issue/IPI-382) | ✅ Ownership decision present — reuses IPI-379's helper |
| [IPI-378](https://linear.app/amo100/issue/IPI-378) | ✅ Title live as "Daily Next Best Action Ranking" |
| [IPI-380](https://linear.app/amo100/issue/IPI-380) | ✅ Title live as "Entity Preference Profile" |

One thing worth flagging: for the two renames (IPI-378, IPI-380), only the Linear **title field** changed — each ticket's body still opens with the old H2 header (`## CRM-POST-009 · Predictive Next Best Action...` and `## CRM-ADV-007 · AI Digital Twin...`). Cosmetic, not misleading in context, but if you want full consistency I can update those two header lines too.

I'll fetch full current descriptions first (since `save_issue` fully replaces content — I got burned by that earlier this session on IPI-568), then make surgical, evidence-based edits to each.

Now applying each fix as a full, careful rewrite (preserving all original content, changing only what the audit found wrong).

First batch landed clean. Now the remaining five: IPI-563 (owner filter already exists), IPI-376 (RLS gap fix), IPI-379/IPI-382 (fetch-layer ownership), IPI-369 (cosmetic blocker cleanup).

Now the last two — IPI-379 and IPI-382, adding the shared-fetch-layer ownership decision.

All 9 corrections applied and confirmed live in Linear.

## Summary — fixes applied

| Ticket | Fix |
|---|---|
| [IPI-373](https://linear.app/amo100/issue/IPI-373) | Corrected: IPI-396 was marked "In Progress," it's actually **Done** (PR #311) — narrowed to bookkeeping-only (A1/B1 design-artifact linking) |
| [IPI-566](https://linear.app/amo100/issue/IPI-566) | Corrected: the type cast it targets never shipped (added+removed in same commit) — both cast-removal AC items checked off, scope narrowed to a drift-scan sanity check |
| [IPI-403](https://linear.app/amo100/issue/IPI-403) | Fixed stale gap-table row — `convert_deal` marked 🟢 live (shipped as `crm_convert_deal`, IPI-367), removed from "Proposed RPCs" |
| [IPI-563](https://linear.app/amo100/issue/IPI-563) | Corrected: owner filter is a **wire-up** of an existing disabled button (`pipeline-workspace.tsx:128`), not new UI |
| [IPI-571](https://linear.app/amo100/issue/IPI-571) | AC updated: purple/gray primitives already exist in `tokens.css` — alias + remap, don't add new hex |
| [IPI-376](https://linear.app/amo100/issue/IPI-376) | **Real security gap fixed**: added explicit AC requiring a server-only route that manually org-filters `traverse_brand_graph`'s output — the RPC is SECURITY DEFINER with no org_id column, so it can't self-enforce RLS |
| [IPI-379](https://linear.app/amo100/issue/IPI-379) / [IPI-382](https://linear.app/amo100/issue/IPI-382) | Added an explicit ownership decision for the shared cross-entity fetch layer both tickets needed — IPI-379 builds it, IPI-382 reuses it, so it doesn't get built twice |
| [IPI-369](https://linear.app/amo100/issue/IPI-369) | Cosmetic: clarified the live `blockedBy` relation is empty (IPI-368 shipped 2026-07-05, no longer an active blocker) |

The one substantive engineering risk in the whole batch — IPI-376's SECURITY DEFINER/no-org-filter gap — is now spelled out as a hard AC rather than something someone would've discovered mid-build. Everything else was documentation drift, now reconciled with live code/Linear state.


This is a full audit of 19 CRM tickets against live Linear state and actual code — I'll split it across three parallel research agents (grouped by theme) so each can fetch full ticket bodies, verify technical claims against the real codebase/schema, and check dependency relations, then I'll synthesize into one ordered, red/yellow/green audited table.

## CRM Linear Audit — 19 tickets, verified live against Linear + actual code (not ticket prose)

Ran 3 parallel research passes across all 19 tickets — each Linear description cross-checked against real grep/SQL results in the repo, not trusted at face value. Full findings below.

### Master table — recommended implementation order

| # | Ticket | Name | Dot | Order correct? | Key finding | Production-ready |
|--:|---|---|:--:|---|---|---|
| 1 | [IPI-373](https://linear.app/amo100/issue/IPI-373) | Claude Design screen-prompt signoff | 🔴 | **Do first, near-zero cost** | Still gates on IPI-396 as "in progress" — IPI-396 has been **Done since 2026-07-10**. This is a paperwork ticket that's actually unblocked and just needs closing. | n/a |
| 2 | [IPI-566](https://linear.app/amo100/issue/IPI-566) | Regenerate `types/supabase.ts` for `crm_convert_deal` | 🔴 | **Do first, near-zero cost** | Its entire remaining scope (removing a documented type cast) is already false — the cast was added and removed in the *same* commit (PR #337). Ships as a no-op if worked as written. | n/a |
| 3 | [IPI-403](https://linear.app/amo100/issue/IPI-403) | CRM convenience RPCs (P3/optional) | 🟡 | Fine, needs data fix first | Its gap-table lists `convert_deal` as 🔴 missing — it shipped today as `crm_convert_deal` (IPI-367). Drop that row before anyone reads this ticket. Other 3 proposed RPCs are still real gaps. | n/a |
| 4 | [IPI-571](https://linear.app/amo100/issue/IPI-571) | Pipeline color tokens + column-total fix | 🟢 | Correct, ready now | Bug airtight (proposal/qualified both `#2563EB`, confirmed byte-for-byte). Minor: purple/gray primitives it says to "add" already exist (`--primitive-purple-700`, `--primitive-grey-500`) — just alias them. | Yes |
| 5 | [IPI-562](https://linear.app/amo100/issue/IPI-562) | Enable New/Filter, Companies+Contacts | 🟢 | Correct, ready now | Spec matches code exactly (`ComingSoonButton` confirmed disabled on both lists). | Yes |
| 6 | [IPI-563](https://linear.app/amo100/issue/IPI-563) | Pipeline UX polish | 🟡 | Correct, ready now | Owner filter button already exists as a disabled placeholder (`pipeline-workspace.tsx:128`) — ticket describes it as new-build. It's a wire-up, cheaper than written. | Yes, after 1-line desc fix |
| 7 | [IPI-572](https://linear.app/amo100/issue/IPI-572) | Mobile responsive — shared chrome + 5 screens | 🟢 | Correct, ready now | Zero existing implementation confirmed by grep; design is 100% built. Largest lift in the batch, no spec risk. | Yes |
| 8 | [IPI-374](https://linear.app/amo100/issue/IPI-374) | Route welcome + suggestion chips | 🟢 | Correct, ready now | Every cited claim verified line-for-line (test-coverage gap on 4/6 routes confirmed real). | Yes |
| 9 | [IPI-407](https://linear.app/amo100/issue/IPI-407) | Notification Center inbox | 🟢 | Correct, ready now | Backend RPCs already live (`list_notifications`, `mark_notifications_read`), zero UI exists — fully accurate, no blockers. | Yes |
| 10 | [IPI-369](https://linear.app/amo100/issue/IPI-369) | crm-assistant wave 2 (AI) | 🟡 | **Critical path — unblocks 3 tickets below** | Wave-2 tools genuinely don't exist (verified zero hits). Cosmetic: description says "blocked by IPI-368" but the live relation is empty (IPI-368 is Done, so harmless). | n/a, ready |
| 11 | [IPI-370](https://linear.app/amo100/issue/IPI-370) | MVP acceptance verification | 🟢 | Correctly blocked by #10 | `verify-rls.mjs` has real CRM coverage; confirmed **zero** CRM Playwright specs exist among 15 e2e files — its own stated top blocker is real. | n/a, gated correctly |
| 12 | [IPI-375](https://linear.app/amo100/issue/IPI-375) | AI Concierge daily briefing | 🟢 | Correctly blocked by #10 | Self-corrected earlier today (stale blocker + milestone both fixed); verified accurate. | n/a, gated correctly |
| 13 | [IPI-376](https://linear.app/amo100/issue/IPI-376) | Relationship Graph explorer | 🟡 | Correctly deferred behind #11 | **Real production risk**: the backing RPC (`traverse_brand_graph`) is `SECURITY DEFINER` with **no org_id filter on its tables** — as written, AC "org-visible only" cannot be met by calling it directly. Needs an explicit server-route filtering AC. | n/a, needs AC fix pre-build |
| 14 | [IPI-378](https://linear.app/amo100/issue/IPI-378) | Predictive Next Best Action | 🟢 | Correctly deferred | Clean, no overlap with IPI-369's per-record NBA. | n/a |
| 15 | [IPI-381](https://linear.app/amo100/issue/IPI-381) | Market & Trend Intelligence | 🟢 | Correctly deferred | Reuse premise (Firecrawl, `brand-intelligence-tools.ts`) confirmed real, not aspirational. | n/a |
| 16 | [IPI-379](https://linear.app/amo100/issue/IPI-379) | AI Timeline & Memory | 🟡 | Correctly deferred | **Unowned scope overlap** with #17 — both explicitly flag needing the same cross-entity fetch layer, neither is designated owner. | n/a, needs a decision |
| 17 | [IPI-382](https://linear.app/amo100/issue/IPI-382) | Relationship Journey Replay | 🟡 | Correctly deferred | Same overlap as #16, acknowledged bidirectionally in both tickets' text. | n/a, needs a decision |
| 18 | [IPI-380](https://linear.app/amo100/issue/IPI-380) | AI Digital Twin | 🟡 | Correctly placed last (CRM-M6, 5pt, largest) | Description claims "blocked by IPI-370 · IPI-367" but the live relation graph only encodes IPI-370 — cosmetic (IPI-367 is Done anyway). | n/a |
| 19 | [IPI-568](https://linear.app/amo100/issue/IPI-568) | CRM-EPIC-001 tracker | ⚪ | n/a — it's the index, not a work item | Used as ground truth throughout; no separate action. | n/a |

**Is the order correct?** Yes, with one adjustment: move IPI-373/566 to the very front (they're not "later," they're already-done work sitting unclosed) and correct IPI-403's stale gap-table entry before anyone reads it — otherwise the implied sequence (frontend UX gaps in parallel → IPI-369 unblocks the AI wave → IPI-370 verification → post-MVP backlog) is sound and matches real dependencies, not just ticket priority labels.

---

### Critical fixes (do before implementation starts, near-zero cost)

| Ticket | Fix |
|---|---|
| 🔴 IPI-373 | Re-verify IPI-396 is Done (it is), do the quick A1/B1 artifact-linking steps, close ticket |
| 🔴 IPI-566 | Re-audit — the cast it targets never shipped (added+removed same commit). Close or narrow to "confirm no other type drift" |
| 🟡 IPI-403 | Delete the stale `convert_deal 🔴` row from its gap table — it shipped today as `crm_convert_deal` |
| 🟡 IPI-563 | Correct description: owner filter is an existing disabled button to wire up, not new UI |
| 🟡 IPI-376 | Add an explicit AC for a server-route that org-filters `traverse_brand_graph`'s output — the RPC itself bypasses RLS by design (SECURITY DEFINER) |
| 🟡 IPI-379/382 | Pick one owner for the shared cross-entity fetch layer before either is started — otherwise it gets built twice |

### What's missing overall

1. **No dedicated CRM Playwright/e2e ticket** — IPI-370 covers cross-org RLS + manual 6-screen sign-off, but confirmed zero CRM specs exist in the 15-file e2e suite. That gap is *known* (already called out inside IPI-568/IPI-370), not silently missing, but it's still not a standalone CI-enforced regression suite — worth a follow-up ticket if you want that codified rather than manually re-run.
2. **axe/Lighthouse pass** (flagged in `CRM-HANDOFF.md` Phase 5 as "not run") isn't explicitly named as an AC in IPI-563 or IPI-370 — confirm one of them owns it, or file a small ticket.
3. No ticket owns reconciling IPI-373/403's stale cross-references going forward — a recurring pattern (tickets referencing state that changed same-day) suggests these two should get a fresh look anytime a same-week dependency (IPI-367, IPI-396) completes.

### Will it succeed / production-ready

- **16 of 19 tickets are technically accurate and safe to implement as written** (🟢/clean 🟡 with a one-line fix).
- **2 tickets (IPI-373, IPI-566) are stale paperwork** — implementing them as literally written wastes a cycle; they need a 5-minute re-verify, not engineering work.
- **1 ticket (IPI-376) has a real security-shaped gap** — if built exactly as described, calling the RPC directly would leak cross-org graph data (SECURITY DEFINER, no org filter). This is the one finding in the whole audit that would actually fail a production RLS review; needs the AC fix before anyone starts.
- Everything else is honestly scoped, cross-referenced correctly, and none of the "shipped" claims (crm_convert_deal, wave-1 tools, notification RPCs) turned out to be fabricated — a good sign for how these tickets are being written.