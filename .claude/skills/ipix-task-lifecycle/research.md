# Phase 2 — Research

Coordinator for question → source → decision before non-trivial edits.

**Primary skill:** [`ai-research`](../ai-research/SKILL.md) · **Playbook:** [`docs/process/03-ai-research-playbook.md`](../../../docs/process/03-ai-research-playbook.md) · **Command:** `/research`
**Detailed checks:** [references/audit-checklist.md](references/audit-checklist.md) · **Rank approaches:** `/efficient`

For IPI work, run **`ai-research`** (or `/research IPI-NNN`) and paste the report into the issue `## Research notes` (or `docs/audits/`) before Phase 3.

---

## Entry / exit criteria

| | Criterion |
|---|---|
| **Entry** | Spec or issue exists AND ≥1 of: unfamiliar module, external API unknown, RLS/migration impact, dependency drift, security unclear. |
| **Exit** | Research evidence recorded in the live Linear task or an intentionally owned audit doc. Risks ranked. Decision: **green-light** / **blocked** / **replan**. |

Skip when **all** of: ≤3 file edits **and** known pattern **and** no Supabase/RLS/edge/Mastra/new vendor **and** concrete wiring plan exists.

---

## `/research` report → Phase 2 `## Research notes` adapter

The **`ai-research`** report (User outcome, MVP stage, Verdict, evidence table) is the primary artifact from `/research`. Before Phase 3, fold it into the issue spec under `## Research notes`:

| Report field | Research notes section |
|--------------|------------------------|
| User outcome | **Question** |
| Evidence column | **Sources** |
| Finding rows (table) | **Findings** |
| Risks and blockers + assumptions | **Risks** / **Assumptions** |
| Verdict + Next | **Decision** |

Do not duplicate prose — migrate once, then implement from the folded note.

---

## When to research

| Trigger | Insert before |
|---------|---------------|
| New Supabase table / RLS / migration | Phase 3 |
| New edge function + Gemini tool | Phase 3 |
| Auth / session / dashboard routing | Phase 3 |
| Unfamiliar `src/` module | Phase 3 |
| AI prompt / schema change | Phase 4 eval planning |
| Suspected regression since last touch | Phase 5 notes |

---

## Workflow checklist

```
[ ] 1.  State the question in one sentence.
[ ] 2.  List sources in priority order (below).
[ ] 3.  Capture URL/path + accessed date + takeaway.
[ ] 4.  Grep codebase; read ≥3 callsites for non-trivial symbols.
[ ] 5.  Run forensic checks (audit-checklist.md).
[ ] 6.  Rank risks: likelihood × blast radius.
[ ] 7.  Name assumptions explicitly.
[ ] 8.  Decide: green-light / blocked / replan.
[ ] 9.  Write audit note (format below).
```

---

## Source prioritization

1. **Official docs** — Supabase, Vite, React, Tailwind, Gemini API, Stripe (COM track).
2. **Project** — [CLAUDE.md](../../../CLAUDE.md), [prd.md](../../../prd.md), [mvp.md](../../../mvp.md), `.cursor/rules/`, live Linear issue.
3. **Repo code** — read files; do not infer.
4. **Recent git** — `git log -p -- <path>`.
5. **Web** — only when 1–4 silent; cite URL + date.
6. **LLM memory** — flag as unverified.

Never trust memory for: RLS defaults, API versions, env var names, deprecation timelines.

---

## Output format

```markdown
## Research notes — <topic> (YYYY-MM-DD)

**Question:** …

**Sources**
- <path or URL> (YYYY-MM-DD) — …

**Findings**
1. …

**Risks**
| Risk | Likelihood | Blast | Mitigation |
|------|------------|-------|------------|

**Assumptions**
- …

**Decision:** Green-light / Blocked / Replan — …
```

| Location | When |
|----------|------|
| Under `## Research notes` in live Linear issue | Default |
| `docs/audits/YYYY-MM-DD-<topic>.md` | Cross-cutting / multi-issue |

---

## Anti-patterns

| Anti-pattern | Fix |
|--------------|-----|
| Research without decision | Time-box 30m; escalate to user |
| LLM memory as source | Replace with doc URL or grep |
| One file → conclusion | Read ≥3 callsites |
| Generic best practice over CLAUDE.md | Project rules win |
| Research after coding started | Stop; replan Phase 3 |

---

## Routing

| Need | Route to |
|------|----------|
| Forensic checklist | [references/audit-checklist.md](references/audit-checklist.md) |
| Migration review | [references/migration-safety.md](references/migration-safety.md) |
| Supabase MCP audit | [references/mcp-cadence-ipix.md](references/mcp-cadence-ipix.md) |
| Task/PRD correction from findings | update the live Linear issue/owning source after verifying current repo/runtime evidence |

Hand off to [implementation.md](implementation.md) when decision = green-light.
