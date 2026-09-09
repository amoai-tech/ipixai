---
name: fastest
description: Find the fastest verified implementation path for an iPix task before coding. Use when the user asks for the best, fastest, simpler, or more efficient approach, wants to avoid unnecessary custom code, or wants official/native options compared against current iPix reuse.
argument-hint: "<IPI-XXX|task name|description>"
metadata:
  version: "1.0.0"
---

# /fastest — fastest verified path

Analyze `$ARGUMENTS` without editing code or committing changes.

## Order

1. Read the live task and use the full format: `IPI-NNN · TASK-ID — Full Task Name`.
2. Run Graphify first when the graph exists, then inspect only the load-bearing current iPix paths.
3. Reuse current iPix implementation before adding new code.
4. Prefer, in order: existing iPix implementation → installed official capability → official feature/module → official CLI/scaffold → official SDK → official starter/example → smallest necessary custom implementation.
5. Verify changing vendor/library behavior against installed source/types first, then current official docs/repositories when needed.
6. Identify blockers, stale assumptions, duplicate work, security/reliability risks, and the cheapest decisive tests.
7. Stop at the first solution that fully satisfies the task without weakening evidence.

Do not edit, commit, open a PR, mutate production Supabase, or perform consequential writes from this skill.

## Output

| Area | Finding |
|---|---|
| Current approach | |
| Faster/better approach | |
| Existing iPix reuse | |
| Official/native option | |
| Custom code still required | |
| Blockers / failure points | |
| Verification | |
| Effort saved | |
| Confidence | |

Finish with:

```text
Recommended path:
1.
2.
3.

Avoid:
-

Verdict: Proceed / Rewrite task / Split task / Park / Duplicate / Cancel
```
