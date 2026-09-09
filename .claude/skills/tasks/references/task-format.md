# iPix executable Linear task format

Use this order unless a task-specific reason requires otherwise.

1. **Agent Contract** — goal, user outcome, do/do-not, source of truth, successful stop, invalid-assumption stop.
2. **Progress + Handoff State** — overall %, current checkpoint, next action, blocker, do-not-redo evidence.
3. **Summary** — current setup → exact outcome.
4. **Known Context** — verified starting files/contracts/tests to re-check, not blindly trust.
5. **Definition of Done** — observable operator/business journey.
6. **Requirement vs Recommended Implementation** — preserve outcome/invariants while allowing a better verified path.
7. **Architecture connections** — Mermaid + source of truth + ownership when useful.
8. **Dependencies** — blocked by / blocks / related using full Linear names.
9. **Source → instruction → target matrix** — exact URLs and destinations.
10. **Pre-implementation gate** — worktree, skills, Graphify, code, live contracts.
11. **Decision branches + STOP conditions** — explicit IF → THEN edge cases and facts that invalidate the plan.
12. **Implementation order** — one file or tightly coupled group at a time.
13. **Performance/query contract** when data access is involved.
14. **Test-data strategy + checkpoint self-check**.
15. **User Journey / AI Journey Certification** when applicable — actor, starting state, business outcome, systems crossed, negative paths, system correctness, and AI correctness.
16. **Pre-commit defect-prevention gate**.
17. **PR creation + review-comment resolution + exact-head CI**.
18. **Production-ready acceptance checklist**.
19. **Post-merge verification + residual-risk routing**.
20. **Final implementation report**.

## Minimum substance rule (no empty-box sections)

Filling in a section heading is not the same as satisfying it. Twenty sections give a lot of surface to technically "complete" with one-line filler that adds no real information. At minimum:

- **Definition of Done** must name an observable operator/business outcome ("operator sees the saved Brand Brain after refresh"), not a restated task title ("implement Brand DNA save").
- **Decision branches + STOP conditions** must name at least one concrete IF → THEN, not "handle edge cases appropriately."
- **Dependencies** must use full `IPI-NNN · TASK-ID — Full Task Name` references or explicitly say "none," not be left blank.
- A section genuinely not applicable is marked `N/A — <reason>`, not silently omitted or filled with a placeholder sentence.

If a section reads as generic enough to paste into any other task unchanged, it has not met this rule.

## Per-file/group section

Every implementation group must state: goal, current iPix pattern, external/Lumina source when used, explicit action, exact implementation, Mermaid when helpful, COPY/REWRITE/DROP decisions, success criteria, and verification checkpoint.

**Rule:** do not continue to the next group until the current checkpoint passes, unless the task explicitly documents safe parallel work.


## Agent prompting rules

Use [agent-instructions.md](agent-instructions.md). Give clear sequential gates when order matters, but specify outcomes rather than micromanaging every shell command. Include examples for ambiguous actions and explicit IF → THEN behavior for likely edge cases.

Use [ui-review.md](ui-review.md) for Mermaid/wireframe/state-matrix requirements when diagrams materially reduce implementation ambiguity.

Before commit/PR use [pre-commit.md](pre-commit.md) and [github-pr.md](github-pr.md). Review comments follow [review-comments.md](review-comments.md), [domain-routing.md](domain-routing.md), and [research-evidence.md](research-evidence.md). After merge use [post-merge.md](post-merge.md).


## Agent prompt

```text
Structure the substantial Linear task in this file's execution order. Keep the Agent Contract and progress/handoff state near the top, define the observable business outcome and Definition of Done before implementation detail, and include architecture/dependencies, source-action-target mapping, STOP conditions, ordered file/workflow groups, risk-matched tests, user/AI journey certification when applicable, PR/exact-head CI, and post-merge proof. Every section must meet the minimum substance rule — no generic filler, no silently blank sections. Omit only sections that are genuinely N/A and record why. Do not duplicate stale repository facts; link to the owning task reference or live source of truth.
```
