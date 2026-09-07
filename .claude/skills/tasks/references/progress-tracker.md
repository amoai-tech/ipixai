# Progress tracker standard

Place the tracker at the top of every substantial executable task.

```markdown
# Progress Tracker — mandatory and continuously updated

**Overall completion: 0%**

| # | Section / workflow | Done | Evidence / status |
| -- | -- | -- | -- |
| 1 | Current-state audit | [ ] | |
| 2 | Pre-implementation gates | [ ] | |
| 3 | File/workflow group 1 | [ ] | |
| 4 | File/workflow group 2 | [ ] | |
| 5 | Targeted verification | [ ] | |
| 6 | PR + exact-head CI | [ ] | |
| 7 | Post-merge production proof | [ ] | |
```

Expand implementation into one row per real file or tightly coupled group before coding.

## File tracker

| Target file/group | Instruction | Implementation | Verification | Done |
| -- | -- | -- | -- | -- |
| `<file>` | `<explicit action>` | [ ] | [ ] | [ ] |

`Done [x]` requires both Implementation and Verification `[x]`.

## Rules

- Check a row only after its success criteria and verification checkpoint pass.
- Record concrete evidence: SHA, test result, Supabase audit, browser proof, PR, CI, or deployment.
- Use `IN PROGRESS` in status text; do not check early.
- If a completed item regresses, uncheck it and reduce progress.
- Verified `N/A` rows are excluded from the denominator.
- `100%` requires post-merge production verification.

Formula:

```text
verified completed applicable checkpoints
÷ total applicable checkpoints
× 100
```

After each completed checkpoint update the issue with:

```text
Progress: <old %> → <new %>
Completed: <file/workflow>
Verification: <exact proof>
Evidence: <SHA/test/CI/browser/Supabase>
Next: <next file/workflow>
Blocked: <none or blocker>
```
