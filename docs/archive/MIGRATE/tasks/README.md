# MIGRATE · Task Linear patch specs

Specs for atomic Linear addenda. **Do not mutate Linear until approved.**
Companion: [`../plan-migrate.md`](../plan-migrate.md) · [`../04-linear-changes.md`](../04-linear-changes.md)

## Folders

| Lane | README | Specs |
| --- | --- | --- |
| **Marketing / ONBOARD** | [`marketing/README.md`](./marketing/README.md) | 7 |
| **Dash / backend / AI / launch** | [`dash-backend/README.md`](./dash-backend/README.md) | 20+ |

**Executable order:** [`todo.md`](../../../MIGRATE/tasks/todo-draft.md) · Full dual index: [`marketing/README.md`](./marketing/README.md)

---

| Task                              | File                                                                                         | Linear action | MIGRATEv2? | Dependency correction                                      | Ready to patch |
| --------------------------------- | -------------------------------------------------------------------------------------------- | ------------- | ---------- | ---------------------------------------------------------- | -------------- |
| **Marketing batch (audited 2026-09-03)** | [`marketing/README.md`](./marketing/README.md)                                           | —             | —          | Batch first-steps + ~97–99/100 after corrections           | YES (corrected) |
| IPI-1053 · MARKETING-NAV-001      | [`marketing/IPI-1053-MARKETING-NAV-001.md`](./marketing/IPI-1053-MARKETING-NAV-001.md)         | UPDATE        | Yes        | Soft NAV→LOGIN; NAV = merge gate HOME/SERVICES             | YES            |
| IPI-1058 · MARKETING-LOGIN-001    | [`marketing/IPI-1058-MARKETING-LOGIN-001.md`](./marketing/IPI-1058-MARKETING-LOGIN-001.md)     | UPDATE        | Already    | Remove NAV hard block; keep →ONBOARD; safe-redirect+lock   | YES            |
| IPI-1089 · ONBOARD-001            | [`marketing/IPI-1089-ONBOARD-001.md`](./marketing/IPI-1089-ONBOARD-001.md)                     | UPDATE        | Yes        | LOGIN hard only; **min tenancy first** (not 13-screen)     | YES            |
| IPI-1057 · MARKETING-HOME-001     | [`marketing/IPI-1057-MARKETING-HOME-001.md`](./marketing/IPI-1057-MARKETING-HOME-001.md)       | UPDATE        | Yes        | **Planner off `/` merge gate**                             | YES            |
| IPI-1060 · MARKETING-SERVICES-001 | [`marketing/IPI-1060-MARKETING-SERVICES-001.md`](./marketing/IPI-1060-MARKETING-SERVICES-001.md)| UPDATE        | Yes        | Route-local composition — not mega-template                | YES            |
| IPI-1064 · MARKETING-MEDIA-001    | [`marketing/IPI-1064-MARKETING-MEDIA-001.md`](./marketing/IPI-1064-MARKETING-MEDIA-001.md)     | UPDATE        | Already    | Keep HOME+SERVICES hard blockers; assets scanner           | YES            |
| IPI-1063 · MARKETING-SEO-001      | [`marketing/IPI-1063-MARKETING-SEO-001.md`](./marketing/IPI-1063-MARKETING-SEO-001.md)         | UPDATE        | Already    | Hard LOGIN+HOME+SERVICES; redirects+canonical host         | YES            |
| **Dash-backend batch**            | [`dash-backend/README.md`](./dash-backend/README.md)                                           | —             | —          | Wave A → AI → Wave B → M3                                  | YES            |
| IPI-1065 · APP-001                | [`dash-backend/IPI-1065-APP-001.md`](./dash-backend/IPI-1065-APP-001.md)                       | UPDATE        | Yes        | **Certify only** — shell merged PR #43                     | YES            |
| IPI-1066 · DASH-MAIN-001          | [`dash-backend/IPI-1066-Dash-main.md`](./dash-backend/IPI-1066-Dash-main.md)                   | UPDATE        | Yes        | Authenticated `/app`; not marketing home                   | YES            |
| IPI-1068 · BRAND-001              | [`dash-backend/IPI-1068-BRAND-001.md`](./dash-backend/IPI-1068-BRAND-001.md)                   | UPDATE        | Yes        | Data-first · Linear ✅                                     | YES            |
| IPI-1067 · SHOOT-001              | [`dash-backend/IPI-1067-SHOOT-001.md`](./dash-backend/IPI-1067-SHOOT-001.md)                   | UPDATE        | Yes        | —                                                          | YES            |
| INTELLIGENCE-RAIL-001 (NEW)       | [`dash-backend/INTELLIGENCE-RAIL-001.md`](../../../MIGRATE/tasks/dash-backend/INTELLIGENCE-RAIL-001.md) | CREATE → **IPI-1140** | Added | Soft after Brand/Shoot; not IPI-1024 | DONE 2026-09-03 |
| IPI-1069 · ASSETS-001             | [`dash-backend/IPI-1069-ASSETS-001.md`](./dash-backend/IPI-1069-ASSETS-001.md)     | UPDATE        | Yes        | —                                          | YES            |
| IPI-1070 · CRM-001                | [`dash-backend/IPI-1070-CRM-001.md`](./dash-backend/IPI-1070-CRM-001.md)           | UPDATE        | Yes        | —                                          | YES            |
| IPI-1072 · OPERATIONS-001         | [`dash-backend/IPI-1072-OPERATIONS-001.md`](./dash-backend/IPI-1072-OPERATIONS-001.md)| UPDATE      | Yes        | —                                          | YES            |
| IPI-1071 · TALENT-BOOKING-001     | [`dash-backend/IPI-1071-TALENT-BOOKING-001.md`](./dash-backend/IPI-1071-TALENT-BOOKING-001.md)| UPDATE | Yes        | —                                          | YES            |
| IPI-1074 · PLANS-001              | [`dash-backend/IPI-1074-PLANS-001.md`](./dash-backend/IPI-1074-PLANS-001.md)       | UPDATE        | Yes        | —                                          | YES            |
| IPI-1073 · ANALYTICS-001          | [`dash-backend/IPI-1073-ANALYTICS-001.md`](./dash-backend/IPI-1073-ANALYTICS-001.md)| UPDATE        | Yes        | —                                          | YES            |
| IPI-1048 · PLANNER-001            | [`dash-backend/IPI-1048-PLANNER-001.md`](./dash-backend/IPI-1048-PLANNER-001.md)   | UPDATE        | Yes        | After STREAM                               | YES            |
| IPI-1049 · TOOL-001               | [`dash-backend/IPI-1049-TOOL-001.md`](./dash-backend/IPI-1049-TOOL-001.md)         | UPDATE        | Yes        | After PLANNER                              | YES            |
| IPI-1093 · BRAND-INTEL-001        | [`dash-backend/IPI-1093-BRAND-INTEL-001.md`](./dash-backend/IPI-1093-BRAND-INTEL-001.md)| UPDATE    | Already    | No BRAND-001 hard block                    | YES            |
| IPI-1081 · PLAN-001               | [`dash-backend/IPI-1081-PLAN-001.md`](./dash-backend/IPI-1081-PLAN-001.md)         | UPDATE        | Yes        | Keep 4 upstream                            | YES            |
| IPI-1084 · APPROVAL-001           | [`dash-backend/IPI-1084-APPROVAL-001.md`](./dash-backend/IPI-1084-APPROVAL-001.md) | UPDATE        | Yes        | —                                          | YES            |
| IPI-1083 · SHOOT-SAVE-001         | [`dash-backend/IPI-1083-SHOOT-SAVE-001.md`](./dash-backend/IPI-1083-SHOOT-SAVE-001.md)| UPDATE      | Yes        | —                                          | YES            |
| IPI-1085 · SHOOT-WIZARD-001       | [`dash-backend/IPI-1085-SHOOT-WIZARD-001.md`](./dash-backend/IPI-1085-SHOOT-WIZARD-001.md)| UPDATE  | Yes        | —                                          | YES            |
| IPI-1087 · PLANNER-CONTEXT-001    | [`dash-backend/IPI-1087-PLANNER-CONTEXT-001.md`](./dash-backend/IPI-1087-PLANNER-CONTEXT-001.md)| UPDATE| Yes        | Remove SAVE blockedBy                      | YES            |
| IPI-172 · AI-EVIDENCE-001         | [`dash-backend/IPI-172-AI-EVIDENCE-001.md`](./dash-backend/IPI-172-AI-EVIDENCE-001.md)| UPDATE      | No         | External                                   | YES            |
| IPI-1051 · UI-001                 | [`dash-backend/IPI-1051-UI-001.md`](./dash-backend/IPI-1051-UI-001.md)             | UPDATE        | No         | External                                   | YES            |

## Recommended patch order

1. MIGRATEv2 label hygiene (remove 5 / add 4 labels) + CREATE Rail — **done 2026-09-03** (IPI-1140)
2. Relation fixes: soften NAV→LOGIN; remove SAVE→CONTEXT; confirm no BRAND→INTEL hard block
3. **`marketing/`** addenda — [`marketing/README.md`](./marketing/README.md)
4. **`dash-backend/`** Wave A — [`dash-backend/README.md`](./dash-backend/README.md)
5. AI: PLANNER, TOOL, BRAND-INTEL
6. Wave B/C dashboards
7. M3 launch chain + CONTEXT
8. External: AI-EVIDENCE, UI-001
9. **Separate:** Next.js ≥16.3.3 security upgrade (not a marketing PR)

**Total:** marketing 8 + dash-backend 19 = **27** specs (Rail CREATE already applied as IPI-1140).
