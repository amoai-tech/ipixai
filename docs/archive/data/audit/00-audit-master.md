# Audit master

Live project: `nvdlhrodvevgwdsneplk` (read-only). Spec: [../100-prompt-audit.md](../100-prompt-audit.md). Date: 2026-09-01.

## Current phase

**01–20 complete.** Recheck verdict **23** complete. **24** / **25** started. Hosted browser proofs still UNVERIFIED. PR #23 **CONFLICTING**.

## Completed audits

| # | File | Score | Confidence |
| --- | --- | ---: | ---: |
| 01 | [01-live-inventory.md](./01-live-inventory.md) | 82 | 92 |
| 02 | [02-identity-organizations.md](./02-identity-organizations.md) | 78 | 88 |
| 03 | [03-rls-security.md](./03-rls-security.md) | 74 | 86 |
| 04 | [04-schema-relationships.md](./04-schema-relationships.md) | 71 | 84 |
| 05 | [05-indexes-performance.md](./05-indexes-performance.md) | 68 | 80 |
| 06 | [06-functions-rpcs-triggers.md](./06-functions-rpcs-triggers.md) | 70 | 75 |
| 07 | [07-mastra-runtime.md](./07-mastra-runtime.md) | 72 | 82 |
| 08 | [08-planner.md](./08-planner.md) | 76 | 80 |
| 09 | [09-brand-intelligence.md](./09-brand-intelligence.md) | 64 | 78 |
| 10 | [10-campaign.md](./10-campaign.md) | 73 | 80 |
| 11 | [11-shoot.md](./11-shoot.md) | 69 | 81 |
| 12 | [12-talent-booking.md](./12-talent-booking.md) | 70 | 80 |
| 13 | [13-assets-cloudinary.md](./13-assets-cloudinary.md) | 77 | 85 |
| 14 | [14-commerce-publishing.md](./14-commerce-publishing.md) | 55 | 88 |
| 15 | [15-operations.md](./15-operations.md) | 72 | 86 |
| 16 | [16-edge-functions.md](./16-edge-functions.md) | 68 | 72 |
| 17 | [17-frontend-backend-wiring.md](./17-frontend-backend-wiring.md) | 60 | 84 |
| 18 | [18-user-journeys.md](./18-user-journeys.md) | 58 | 80 |
| 19 | [19-migrations-legacy.md](./19-migrations-legacy.md) | 62 | 90 |
| 20 | [20-production-readiness.md](./20-production-readiness.md) | 63 | 78 |
| 23 | [23-audit-supa.md](./23-audit-supa.md) (verdict recheck) | **67** ready / **87** arch | 90 |
| 24 | [24-security-definer-deep-audit.md](./24-security-definer-deep-audit.md) | bodies started | 82 |
| 25 | [25-code-database-dependency-map.md](./25-code-database-dependency-map.md) | V2 src no shoot queries | 88 |

## Scores (rolling)

See [23-audit-supa.md](./23-audit-supa.md). **Overall production readiness: 67/100.** Architecture **87/100**. Security **73/100**. Step 20 was 63; earlier 23 write was 64.

## P0 / P1 blockers

| Pri | Finding | Owner |
| --- | --- | --- |
| P0 | None: no RLS-off app tables, no advisor ERROR | — |
| P1 | Hosted persist / recycle unproven | **IPI-1124**, **IPI-1042** |
| P1 | Org B deny / PR #23 **CONFLICTING** | PR #23 rebase, **IPI-1125** |
| P1 | Atomic first-create unproven | **IPI-1127** |
| P1 | 309 live migrations vs 1 repo file | **IPI-1040** |
| P1 | DEFINER bodies / negative tests | **IPI-1039** + audit **24** |
| P1 | HIBP off | **IPI-863** (P2 vs Core chat; still do this week) |
| P2 | Dual shoot **tables** (8 vs 4) | Not an automatic Core blocker. Schema-aware V2 using `public.shoots` would be. FKs from `assets` / CRM / commerce block DROP. |

## Key findings

- 191 table-like objects; 145 app tables; all RLS on. RLS-on ≠ secure (grants + policies).
- `mastra_messages` moved 117 → **119** (snapshots drift).
- `shoot.*` JWT SELECT-only; `mastra` USAGE only runtime role; `schemaName` + `disableInit` in code.
- Brand DNA/graph empty; planner gates 0; commerce 0.
- 7 Edge Functions; 0 Storage buckets; 2 cron jobs.
- Security advisors: 43 (0 ERROR). Performance: 328 (do not bulk-index).

## Next audit

**24 DEFINER bodies started** (negatives still due) · **25** schema-aware map started · **27** hosted Core cert. Verdict: [23-audit-supa.md](./23-audit-supa.md).

## Overall production readiness

**Yes with conditions** (**87/100** architecture). **Not** production-verified for hosted operator chat (**49/100**). Do not rebuild the schema or Mastra store. Execute **A6 Preview before A5 ACL**.
