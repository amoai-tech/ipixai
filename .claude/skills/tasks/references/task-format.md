# iPix executable Linear task format

Use this order unless a task-specific reason requires otherwise.

1. **Agent Start Here** — how to use the issue and update it.
2. **Progress Tracker** — overall %, workflow tracker, file tracker.
3. **Summary** — current setup → exact outcome.
4. **Definition of Done** — observable operator/business journey.
5. **Architecture connections** — Mermaid + source of truth + ownership.
6. **Dependencies** — blocked by / blocks / related using full Linear names.
7. **Source → instruction → target matrix** — exact URLs and destinations.
8. **Pre-implementation gate** — worktree, skills, Graphify, code, live contracts.
9. **STOP conditions** — facts that invalidate the plan.
10. **Implementation order** — one file or tightly coupled group at a time.
11. **Performance/query contract** when data access is involved.
12. **Test-data strategy** — deterministic fixtures vs runtime proof.
13. **Production-ready acceptance checklist**.
14. **PR evidence contract**.
15. **Post-merge verification**.
16. **Final implementation report**.

## Per-file/group section

Every implementation group must state: goal, current iPix pattern, external/Lumina source when used, explicit action, exact implementation, Mermaid when helpful, COPY/REWRITE/DROP decisions, success criteria, and verification checkpoint.

**Rule:** do not continue to the next group until the current checkpoint passes, unless the task explicitly documents safe parallel work.
