# PRD Template (iPix)

Use when a new initiative needs a full PRD before Linear issue breakdown. Keep the PRD in its owning product doc; once issues exist, live Linear owns task execution/progress.

For epic → feature PRDs, use [`breakdown-feature-prd`](../../archive/brainstorming/breakdown-feature-prd/SKILL.md).

## Structure

### 1. Executive Summary
- Problem statement (what breaks today — concrete examples)
- Target audience (operator, brand admin, engineer)
- Success metrics (MVP proof # if applicable)

### 2. User Stories
- Role-based: "As a [user], I want [goal] so that [reason]"
- Acceptance criteria per story (observable, testable)
- Priority (P0/P1/P2)

### 3. Technical Specifications
- Architecture overview (Next.js `app/`, Supabase, edge fn, Mastra)
- Data model / schema changes (migration path)
- API routes (`withOperatorAuth` pattern)
- UI component tree (operator route group)
- Integration points (Mercur, Cloudinary, Firecrawl)

### 4. AI Feature Specs (if applicable)
- Model selection rationale (Gemini via Mastra or edge fn — server-only)
- Prompt design / structured output schemas
- Fallback behavior
- Latency and cost budgets

### 5. Risk Analysis
- Technical risks (RLS, auth, migration rollback)
- Privacy / security considerations
- Mitigation strategies

### 6. Out of Scope
- At least 2 explicit exclusions

### 7. Timeline
- Phases, milestones, dependencies vs live Linear project/dependency state

## Save location

| Artifact | Path |
|----------|------|
| Initiative PRD section | `docs/prd/<topic>.md` or extend `prd.md` |
| Linear task | live Linear issue using `IPI-NNN · TASK-ID — Title` |
| Design spec (pre-plan) | `docs/plan/tasks/YYYY-MM-DD-<topic>-design.md` |

## Handoff

After PRD approval → [`writing-plans`](../../writing-plans/SKILL.md) or Phase 1 of
[`ipix-task-lifecycle`](../SKILL.md) for Linear A–E + wiring.
