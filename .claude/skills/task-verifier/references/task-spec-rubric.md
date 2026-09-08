# Full verification scoring

Use only for **Full** verification. Scores summarize evidence; they never override a blocker.

| Dimension | Weight | What is proved |
|---|---:|---|
| Outcome / AC proof | 30 | each applicable acceptance criterion maps to current evidence |
| Implementation correctness | 20 | current code/architecture matches the required behavior |
| Test / verification evidence | 20 | risk-matched automated/runtime proof is current and reproducible |
| Security / tenant / safety | 15 | authz, tenant, HITL, secrets, destructive-write boundaries when applicable |
| Architecture / SSOT alignment | 10 | current runtime/code/Linear/task standards agree |
| Process / skill compliance | 5 | applicable task/domain rules were followed without ritual overhead |

## Interpretation

| Overall | Meaning |
|---:|---|
| 95–100 | Verified production-ready for the stated scope |
| 90–94 | Ready; only minor non-blocking observations |
| 80–89 | Needs fixes/evidence before Done |
| <80 | Not ready |

Any unresolved critical blocker = **Not ready regardless of score**.

Do not invent precision. If evidence is incomplete, mark the score **provisional** and lower verification confidence.
