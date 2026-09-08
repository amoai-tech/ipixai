---
name: ipix-task-lifecycle
description: >
  Five-phase orchestrator for iPix / FashionOS Linear team IPI — plan, research, implement,
  test, ship (worktrees, verify matrix, PR workflow, Linear state). Use whenever implementing
  or shipping IPI-NNN, forensic verify before Done,
  multi-file platform work across src/mastra, CopilotKit, Next, Supabase,
  or user says "implement IPI-", "ship IPI-", "/task IPI", "close out Linear", "next P0 task",
  "forensic verify", "wiring plan", "open PR with verify". Always use for multi-step iPix
  delivery. Do NOT use for one-line typo fixes, explain-only questions, isolated copilotkit/
  supabase/migration/lean/release-notes tasks without full lifecycle, or non-iPix repos.
version: "1.9.1"
---

# ipix-task-lifecycle

**BLUF:** Five-phase execution orchestrator for **iPixai** (team **IPI**). Live Linear is the execution/progress contract; [tasks](../tasks/SKILL.md) owns the task specification standard. Do not create a local issue/todo mirror unless a separate task explicitly adopts one.

**iPixai gates:** `docs/mastra/10-mastra-convert.md` · split `dev:ui` / `dev:agent` · no prod Supabase writes · no wholesale old-Mastra copy. Graphify is available at `graphify-out/graph.json`; use it before broad multi-file discovery.

**Hub index:** [README.md](README.md) · v1.9.1 — Linear SSOT alignment, tasks-skill gate, current repo paths, phase orchestration

---

## `/task IPI-NNN` — default flow

```
Read Linear issue + current task source
  → Read .claude/skills/tasks/SKILL.md and validate task structure/progress tracker
  → **Skills:** line → Read each .claude/skills/<slug>/SKILL.md
  → worktree:audit → worktree:add OR worktree:health (existing wt)
  → Phase 1 skip? only if the live Linear task already satisfies the tasks-format gate + required skills/context
  → Phase 2 skip? ≤3 files, no Supabase/RLS/edge/Mastra
  → Multi-file / unfamiliar? graphify query|path before reading source
  → Phase 3: Step 1b pre-edit gate → implement one A–E step at a time
  → Phase 4 verify matrix ([pr-workflow](../pr-workflow/references/verify-matrix.md))
  → pr-workflow: PR open · Bugbot · resolve threads
  → task-verifier (mandatory before Done on ship gates)
  → Phase 5: post-merge proof → Linear evidence/progress → Done
```

---

## When to invoke

| Trigger | Action |
|---------|--------|
| "Work on IPI-###" / `/task IPI-NNN` | Flow above · mark In Progress → phases 2–5 |
| "Add Linear steps to IPI-###" | Phase 1 + [domain-skill-routing.md](references/domain-skill-routing.md) + [linear-issue-steps.md](references/linear-issue-steps.md) + [linear-prompt-engineering.md](references/linear-prompt-engineering.md) |
| "Enrich Linear prompt" / tighten AC | [linear-prompt-engineering.md](references/linear-prompt-engineering.md) → verify facts → update live Linear |
| "Process platform backlog" / "Next task" | Use the live Linear project/backlog and dependency state |
| "Ship IPI-###" / "Sync Linear" | Phase 5 · [pr-workflow](../pr-workflow/SKILL.md) · mark Done via Linear MCP |
| "Build feature" / greenfield / wiring plan | Phase 1 → child skills → Phase 3 |
| "Forensic verify" before Done | [task-verifier](../task-verifier/SKILL.md) |

### Don't invoke for

- One-off questions or trivial single-file edits
- Commit-only with no Linear traceability

---

## iPix context

| Topic | Rule |
|-------|------|
| **Linear** | [linear.app/amo100](https://linear.app/amo100) · team **IPI** · `LINEAR_API_KEY` in `.env.local` |
| **Linear read** | Linear MCP/API when connected; do not substitute a nonexistent local issue mirror |
| **Linear status** | Use the available Linear connector/API for `In Progress` / `Done`; verify the current tool contract before writes |
| **Supabase** | Remote linked · project `nvdlhrodvevgwdsneplk` · service role via API routes only |
| **App** | Next.js UI `:3000` · current App Router under `src/app/` |
| **Tracker** | Live Linear progress tracker defined by [tasks](../tasks/SKILL.md); no mandatory local todo mirror |
| **Issue IDs** | `IPI-NNN` (Linear) — old `PLT-`/`AI-`/`DNA-`/`COM-`/`UI-` spec IDs are retired |

---

## Worktree contract

Before any multi-step implementation — full detail: [worktrees](../worktrees/SKILL.md).

| When | Command |
|------|---------|
| Before add | `npm run worktree:audit` |
| Create | `npm run worktree:add -- IPI-NNN short-slug` |
| Existing wt, before code | `npm run worktree:health` |
| Before remove | `npm run worktree:pre-delete` |

Never push to `main`. Branch: `ipi/<id>-<slug>`.

---

## Child skills (load on demand)

### Process skills (how to plan/ship)

| Intent | Child |
|--------|-------|
| Task structure / progress / migration prompt | [tasks](../tasks/SKILL.md) |
| Explore intent | [brainstorming](../archive/brainstorming/SKILL.md) |
| Idea → design + spec dialogue | [feature-design-assistant](references/feature-design-assistant.md) |
| Implementation plan | [writing-plans](../writing-plans/SKILL.md) |
| MVP cuts | [mvp](../mvp/SKILL.md) |
| Full PRD | [prd-template](references/prd-template.md) |
| Epic → feature PRD | [breakdown-feature-prd](../archive/brainstorming/breakdown-feature-prd/SKILL.md) |
| Repo / docs hygiene | [lean](../lean/SKILL.md) |
| Multi-file / architecture | [feature-dev](../archive/feature-dev/SKILL.md) |
| Blast radius / orientation | [graphify](../graphify/SKILL.md) |
| Per-task test contract | [per-task-testing](references/per-task-testing.md) |
| Vitest authoring | [gen-test](../gen-test/SKILL.md) |

### Domain skills (what to build — **mandatory in Phase 1**)

When creating or enriching a task, **Read** each domain skill from `.claude/skills/<slug>/SKILL.md` before writing AC.

**Router:** [references/domain-skill-routing.md](references/domain-skill-routing.md) · task inventory: [`tasks/intelligence/ai/skill-map.md`](../../../tasks/intelligence/ai/skill-map.md)

| Domain | Skill |
|--------|-------|
| Mastra agents / tools / workflows | [mastra](../mastra/SKILL.md) |
| CopilotKit runtime / UI | [copilotkit](../copilotkit/SKILL.md) |
| Supabase schema / RLS / edge | [ipix-supabase](../ipix-supabase/SKILL.md) |
| Gemini / structured AI output | [gemini](../gemini/SKILL.md) |
| Next.js App Router / routes | [nextjs-developer](../nextjs-developer/SKILL.md) |
| Operator UI / tokens | [frontend-design](../frontend-design/SKILL.md) · [design-md](../design-md/SKILL.md) |
| Cloudinary media | [cloudinary](../cloudinary/SKILL.md) |
| Mercur commerce | [mercur](../mercur/SKILL.md) |
| Shoot production | [fashion-production](../fashion-production/SKILL.md) |
| Worktrees / isolation | [worktrees](../worktrees/SKILL.md) |
| PR + verify matrix | [pr-workflow](../pr-workflow/SKILL.md) |
| Done forensic gate | [task-verifier](../task-verifier/SKILL.md) |

Full path-heuristic table → [domain-skill-routing.md](references/domain-skill-routing.md).

### Sibling skills (not symlinked)

| Intent | Skill |
|--------|-------|
| CLAUDE.md / project memory | [claude-md-improver](../archive/claude-md-improver/SKILL.md) |
| Mermaid in Linear | [mermaid-diagrams](../mermaid-diagrams/SKILL.md) |

### Routing tree

```
New / ambiguous → brainstorming → writing-plans → Phase 3
Linear issue already satisfying tasks-format gate + Skills → phases 2–5
Large / architecture → feature-dev → graphify → writing-plans → Phase 3
MVP cut → mvp
New PRD → prd-template → Linear spec + writing-plans
```

Phase modules: [planning.md](planning.md) · [research.md](research.md) · [implementation.md](implementation.md) · [testing.md](testing.md) · [shipping.md](shipping.md)

---

## Per-task testing (mandatory)

Every task in `docs/plan/tasks/*.md` and every Linear step A–E must include a **Test** block
before the next task starts. No batching tests to the end of Phase 3.

| Phase | Testing duty |
|-------|----------------|
| 1 Plan | Each AC → test type; each Linear step → proof command |
| 3 Implement | After each task: run its Vitest/smoke/verify command → PASS → next task |
| 4 Test | Full matrix + aggregate gates ([testing-matrix](references/testing-matrix.md)) |

Contract: [references/per-task-testing.md](references/per-task-testing.md) · authoring: [gen-test](../gen-test/SKILL.md)

---

## Five phases

| # | Phase | Output |
|---|-------|--------|
| 1 | [planning.md](planning.md) | Live Linear task contract + **Skills** + diagrams/wireframes when useful |
| 2 | [research.md](research.md) | Audit note + green-light + **API route inventory** |
| 3 | [implementation.md](implementation.md) | Code + **Step 1b gate** + per-step proofs green |
| 4 | [testing.md](testing.md) | [verify-matrix](../pr-workflow/references/verify-matrix.md) green |
| 5 | [shipping.md](shipping.md) · [tasks post-merge](../tasks/references/post-merge.md) | PR merged · threads resolved · post-merge proof recorded · Linear Done |

---

## Task-format gate before Phase 1

Before Phase 1 planning or any task enrichment, read [tasks](../tasks/SKILL.md). Ensure the live Linear issue has the required structure, progress tracker, file/workflow checkpoints, and explicit source-action-target decisions when migration/reuse is involved.

`tasks` defines **what the issue must contain**. This lifecycle defines **how to execute it**. Do not duplicate the task-format standard here.

---

## Linear issues as agent prompts

Treat every executable issue as a **prompt** to Cursor/Claude: role, context, constraints, examples, ordered A–E execution steps, and eval (proof commands).

**Full guide:** [references/linear-prompt-engineering.md](references/linear-prompt-engineering.md) · wireframes/wiring detail: [planning.md](planning.md)

| Must have | Why |
|-----------|-----|
| Problem statement + user story | Context — most-skipped, highest agent failure rate |
| **Skills:** line + domain SKILL.md read | Best practices per stack (mastra, supabase, …) |
| Good/bad **Examples** (security/AI) or wireframe + states (UI) | Multishot — reduces wrong-path implementations |
| **Do NOT** + out of scope | Negative prompting — stops scope creep and antipatterns |
| `proof:` on every A–E step | Eval hook — done vs not done is measurable |
| No **OR** in security AC | Clarity — agents pick the easier (wrong) path |
| `blockedBy` matches cross-issue AC | Relations mirror dependencies |

SSOT: edit the live Linear issue directly. A local mirror is optional only when a separate task explicitly creates and owns one; if such a mirror exists, define its synchronization direction before use.

---

## Slash commands (use these first)

| Command | When |
|---------|------|
| `/task IPI-NNN` | Full lifecycle — see flow at top |
| `/worktree` | Audit / add / clean worktrees |
| `/audit [scope]` | Forensic audit before shipping |
| `/supa [scope]` | Supabase schema, RLS, migration, type-drift |
| `/pr [new\|open\|fix\|ship\|ready\|status\|resolve] [PR#]` | One PR command (`.claude/commands/pr.md`) — auto-detect; fix/ship/ready/resolve |

## Linear tooling fallback

Prefer the connected Linear MCP/API. If the required Linear write tool is unavailable, stop and report the update as blocked rather than creating a local authoritative mirror. Verify current connector action names before writing.

---

## Verification gates

Route verification through [tasks pre-merge tests](../tasks/references/pre-merge-tests.md) and the owning domain skill. Re-read root `package.json` and `.github/workflows/ci.yml` before naming commands. The lifecycle orchestrates phases; it does not maintain a second test-command matrix.

Current root baseline includes `npm test`, `npm run typecheck`, `npm run build`, and the Playwright `e2e*` scripts; use the smallest risk-matched subset and escalate only when the task requires it.

---

## Done gate

**Never mark Done unless** all applicable conditions are proved:

```
[ ] Live Linear acceptance criteria/progress reflect verified current state
[ ] Risk-matched verification is green ([tasks pre-merge](../tasks/references/pre-merge-tests.md))
[ ] task-verifier report exists or is explicitly waived for truly trivial work
[ ] PR merged (or user waived PR) and [tasks post-merge](../tasks/references/post-merge.md) proved the observable outcome
[ ] GitHub review threads are classified/resolved when a PR exists
[ ] Linear is marked Done only after post-merge proof
```

---

## Phase sequencing

| Skip | When |
|------|------|
| Phase 1 | Live Linear task already satisfies the `tasks` structure/Agent Contract, required skills/context, and measurable proof gates |
| Phase 2 | ≤3 files, no Supabase/RLS/edge/Mastra |
| Phase 4 | Never on auth/RLS/edge/Mastra/AI |
| Phase 5 | Never |

Check the live Linear issue/project for blocked-by dependencies before starting an IPI task.

---

## Quick links

| Resource | Path |
|----------|------|
| Linear steps | [references/linear-issue-steps.md](references/linear-issue-steps.md) |
| Linear prompt engineering | [references/linear-prompt-engineering.md](references/linear-prompt-engineering.md) |
| Domain skill routing | [references/domain-skill-routing.md](references/domain-skill-routing.md) |
| Skill map (task inventory) | [`tasks/intelligence/ai/skill-map.md`](../../../tasks/intelligence/ai/skill-map.md) |
| Verify matrix | [pr-workflow/references/verify-matrix.md](../pr-workflow/references/verify-matrix.md) |
| Spec template | [references/linear-spec-template.md](references/linear-spec-template.md) |
| Migration safety | [references/migration-safety.md](references/migration-safety.md) |
| Live task/progress SSOT | Linear issue + [tasks](../tasks/SKILL.md) |
| Post-merge standard | [tasks post-merge](../tasks/references/post-merge.md) |
| Supabase hub | [ipix-supabase/SKILL.md](../ipix-supabase/SKILL.md) |
| MCP cadence | [references/mcp-cadence-ipix.md](references/mcp-cadence-ipix.md) |

---

## Contract

- **One concern per PR and per commit** — never mix docs+code or two IPI issues ([pr-workflow](../pr-workflow/SKILL.md))
- Remote Supabase only · no client secrets
- Traceability: full Linear task reference ↔ code/PR ↔ verification evidence
- No push without user ask · never push to `main`
