# PR review-comment investigation and resolution

Classify before editing.

| Class | Meaning | Action |
| -- | -- | -- |
| `VALID-BLOCKER` | correctness/security/AC failure | fix now, test, reply, resolve |
| `VALID-IN-SCOPE` | useful improvement required by task | smallest fix + proof |
| `ALREADY-FIXED` | current head already addresses it | prove with SHA/test |
| `STALE` | comment targets outdated diff/assumption | explain evidence, resolve |
| `INCORRECT` | contradicted by stronger evidence | reply with proof, resolve |
| `OUT-OF-SCOPE` | valid but owned elsewhere | reference exact Linear owner |
| `TEST/NOISE` | non-actionable reviewer/test comment | no code change; resolve |
| `NEEDS-RESEARCH` | evidence insufficient | load domain skill/MCP/docs first |

## Evidence required before resolution

For a valid finding:

```text
fix → targeted proof → commit/head evidence → reply → resolve
```

For an invalid/stale finding:

```text
current code/runtime/official contract proves why → reply → resolve
```

For out-of-scope work:

```text
verify it is not required by this Definition of Done
→ search for existing Linear owner
→ reference IPI-XXX · TASK-ID — Full Task Name
→ create a new task only if no owner exists
```

## Efficient review-fix loop

Inventory and classify all comments before editing. Group valid comments by shared root cause/domain, fix the root cause once, rerun the failing/affected tests, then push a focused correction commit. Avoid one tiny commit per bot comment when several comments share one cause.

After substantial fixes, re-read current threads and rerun automated review/checks on the new head. New feedback is evaluated from scratch; old resolved evidence does not automatically prove the new head.

## Agent prompt

```text
Inventory every substantive PR review thread before editing. Classify each as VALID-BLOCKER, VALID-IN-SCOPE, ALREADY-FIXED, STALE, INCORRECT, OUT-OF-SCOPE, TEST/NOISE, or NEEDS-RESEARCH. Group related comments by root cause, verify uncertain claims with the owning domain skill/MCP/current source, and apply the smallest fix that resolves the root cause rather than one patch per comment. Rerun the smallest relevant test, reply with exact evidence and current SHA, and resolve only after proof. For valid out-of-scope findings, attach the exact existing Linear owner or create one only if none exists.
```
