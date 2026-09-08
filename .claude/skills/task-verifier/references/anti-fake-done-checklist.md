# Anti-fake-Done checklist

Use during **Full** verification. Every applicable row requires current evidence.

| Gate | Required proof |
|---|---|
| Outcome | observable user/business outcome is actually achieved |
| ACs | every applicable AC is VERIFIED; no FAILED/UNVERIFIED required AC |
| Exact head | evidence applies to the current PR/merged SHA, not an older commit |
| Tests | risk-matched targeted/integration/browser/SQL tests pass |
| Security | auth/tenant/HITL/secrets/destructive-write boundaries proved when applicable |
| Journey | complete business journey proved for user-facing work |
| AI | system correctness + AI correctness proved when AI participates |
| Reviews/CI | substantive review findings resolved and required exact-head CI green |
| Post-merge | `tasks/references/post-merge.md` evidence passed when claiming Done |
| Linear | live issue state/progress matches verified reality |

## Hard rule

```text
code exists != Done
tests pass != automatically Done
PR merged != Done
required observable outcome + applicable post-merge evidence = Done
```

Failure output:

> 🛑 Not Done. Required evidence is missing or failed: <exact gate + proof>. Smallest next action: <action>.
