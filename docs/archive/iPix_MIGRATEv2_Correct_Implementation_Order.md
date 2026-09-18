# iPix MIGRATEv2 — Correct Implementation Order

**Project:** https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues  
**MIGRATEv2 view:** https://linear.app/amo100/view/migratev2-6e501438c58a  
**Live Linear snapshot:** 2026-09-03

> Numbers are execution priority only. Linear `blockedBy` / `blocks` remain the real start lock.
>
> Completed work belongs in `changelog.md`, not the active TODO list.

## Status key

| Symbol | Meaning |
|---|---|
| 🟢 | Done |
| 🟡 | In Progress |
| 🔵 | Todo / Backlog |
| 🔴 | Blocked by an unmet hard dependency |
| ∥ | Safe parallel lane |

---

## Completed — remove from TODO

| Task | Status | Why it leaves TODO |
|---|---:|---|
| **IPI-1065 · APP-001 — Give Operators One Consistent iPix Workspace Across the App** | 🟢 Done | Shared `/app/*` shell is complete. Downstream workspace tasks should reuse it, not rebuild it. |

---

# Recommended implementation order

## Lane A — Operator workspace / product screens

This is the shortest path to a useful operator product.

| # | Status | Task | Start condition | Why this order |
|---:|:---:|---|---|---|
| 1 | 🟡 | **IPI-1066 · DASH-MAIN-001 — Reuse the Proven iPix Command Center as the Main Dashboard Page** | APP-001 done | Current active task. Establishes real `/app` landing page and trusted-org dashboard reads. |
| 2 | 🔵 | **IPI-1068 · BRAND-001 — Let Operators Browse Brands and Open Complete Brand Profiles** | APP-001 done | Brand is the core parent context for planning, shoots, assets, and Brand Intelligence. |
| 3 | 🔵 | **IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records** | APP-001 done | Canonical Shoot read model is required before structured PLAN-001. |
| 4 | 🔵 | **IPI-1140 · INTELLIGENCE-RAIL-001 — Bring the Proven iPix Intelligence Panel Into the New Operator Workspace** | APP shell + core Brand/Shoot surfaces | Reuse the shared AI insight surface after the main entity routes exist; do not create a second AI system. |
| 5 | 🔵 | **IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records** | APP-001 done; safe placeholder allowed until signed media delivery is ready | Establish Supabase-backed asset workspace without making M3 Cloudinary delivery a start blocker. |
| 6 | 🔵 | **IPI-1070 · CRM-001 — Bring the Proven iPix CRM Workspace Into the New App** | APP-001 done | Adds relationship workspace after core production entities. |
| 7 | 🔵 | **IPI-1072 · OPERATIONS-001 — Bring the Operator Inbox and Coordination Workflow Into the New App** | Active-org notification contract verified | Coordination depends on correct tenant-scoped operational data. |
| 8 | 🔵 | **IPI-1071 · TALENT-BOOKING-001 — Let Operators Find Talent and Manage Bookings** | Current booking authorization/RPC contract verified | Booking is useful after Brand/Shoot context is established; security review before reuse. |
| 9 | 🔵 | **IPI-1074 · PLANS-001 — Bring the Existing Production Planning Workspace Into /app/plans** | APP-001 + current planner schema | Saved plan workspace comes after the main entity surfaces; do not create a second Planner. |
| 10 | 🔵 | **IPI-1073 · ANALYTICS-001 — Bring the Existing Analytics Workspace Into the New App Without Fake Metrics** | Proven metric sources available | Last in the operator-screen lane because analytics should display only verified data provenance. |

---

## Lane B — Planner / AI production path

**External start gate:** `IPI-1045 · STREAM-001 — Let Authenticated iPix Users Stream Planner Responses Safely` must be green before PLANNER-001. It is a dependency of this lane even though it is not currently returned by the MIGRATEv2 label query.

| # | Status | Task | Hard start condition | Why this order |
|---:|:---:|---|---|---|
| 11 | 🔴 | **IPI-1048 · PLANNER-001 — Make the Production Planner the Main iPix AI Assistant** | STREAM-001 green | Promote the secure runtime from weather/demo to one canonical Production Planner. |
| 12 | 🔵 | **IPI-1049 · TOOL-001 — Let the Planner Build Shoot Type, Deliverables, Shot List, and Budget Safely** | PLANNER-001 done | Four compute-only tools attach to the real Planner; no writes/HITL. |
| 13 | 🔵 | **IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan** | BRAND-001 + SHOOT-001 + PLANNER-001 + TOOL-001 done | Compose trusted Brand/Shoot context + four tools into one canonical versioned `ShootPlanSchema`. |
| 14 | 🔵 | **IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved** | PLAN-001 done | Human review owns the consequential decision boundary. |
| 15 | 🔵 | **IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization** | APPROVAL-001 done | Persist only the exact approved plan with trusted org/actor + idempotency. |
| 16 | 🔵 | **IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot** | SHOOT-SAVE-001 done | Thin UI orchestration over PLAN → APPROVAL → SAVE; do not port the old workflow wholesale. |
| 17 | 🔵 | **IPI-1087 · PLANNER-CONTEXT-001 — Keep the Active Brand and Shoot Brief Available During Planning** | SHOOT-SAVE-001 + SHOOT-WIZARD-001 done | Live Linear blocks this on SAVE/WIZARD so it can reuse the final wizard/shared-state contract. |

### Correct AI dependency chain

```text
IPI-1045 STREAM-001  [external gate]
        ↓
IPI-1048 PLANNER-001
        ↓
IPI-1049 TOOL-001
        ↓
IPI-1081 PLAN-001
        ↓
IPI-1084 APPROVAL-001
        ↓
IPI-1083 SHOOT-SAVE-001
        ↓
IPI-1085 SHOOT-WIZARD-001
        ↓
IPI-1087 PLANNER-CONTEXT-001
```

`PLAN-001` also waits for `BRAND-001` and `SHOOT-001`.

---

## Lane C — Brand Intelligence

This can start after the Brand browse/detail contract is stable.

| # | Status | Task | Start condition | Why |
|---:|:---:|---|---|---|
| 18 | 🔵 | **IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile** | BRAND-001 done | Generate draft Brand DNA only after approved-vs-draft Brand display/data ownership is clear. |

Target journey:

```text
Brand URL
→ safe bounded research
→ draft Brand DNA
→ operator review/edit
→ approval
→ brands.ai_profile
```

---

## Lane D — Marketing / first-user journey

Run in parallel with the operator and Planner lanes where file ownership does not collide.

| # | Status | Task | Start condition | Why |
|---:|:---:|---|---|---|
| 19 | 🟡 | **IPI-1053 · MARKETING-NAV-001 — Reuse the Existing iPix Marketing Header, Footer, and Shared Layout** | None beyond current route/design contract | Already In Progress. Establish public-site chrome first. |
| 20 | 🔵 | **IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup** | MARKETING-NAV stable enough for auth route | Required before first-user onboarding. |
| 21 | 🔵 | **IPI-1089 · ONBOARD-001 — Let a New iPix User Sign Up, Create Their First Brand, and Reach the Operator Workspace** | MARKETING-LOGIN done | Completes first-user → first org/brand → `/app` journey. |
| 22 | 🔵 | **IPI-1057 · MARKETING-HOME-001 — Reuse the Existing iPix Marketing Homepage in the New App** | MARKETING-NAV | Public homepage can proceed in parallel after shared chrome. |
| 23 | 🔵 | **IPI-1060 · MARKETING-SERVICES-001 — Reuse the Existing iPix Photography Service Pages** | MARKETING-NAV | Restore service content without blocking operator MVP. |
| 24 | 🔵 | **IPI-1064 · MARKETING-MEDIA-001 — Reuse and Optimize the Existing iPix Marketing Images, Sliders, and Visual Content** | Public page structure stable | Optimize media after page ownership is stable. |
| 25 | 🔵 | **IPI-1063 · MARKETING-SEO-001 — Keep the New iPix Marketing Site Searchable and Correctly Indexed** | Public routes/metadata stable | SEO should certify final route/canonical structure rather than precede it. |

---

# Execution waves

Use these waves for multi-agent scheduling.

| Wave | Main lane | Parallel-safe work |
|---|---|---|
| **Now** | DASH-MAIN-001 | MARKETING-NAV-001 |
| **Next** | BRAND-001 → SHOOT-001 | Marketing Login/Home; STREAM certification outside MIGRATEv2 |
| **Then** | INTELLIGENCE-RAIL → ASSETS | PLANNER after STREAM; BRAND-INTEL after BRAND |
| **Production planning** | PLANNER → TOOL → PLAN → APPROVAL → SAVE → WIZARD → CONTEXT | CRM / Operations / Talent where file ownership does not collide |
| **Expansion** | PLANS → ANALYTICS | Marketing Services/Media/SEO |

---

# Important corrections from the old working catalog

1. **Remove `IPI-1065 · APP-001` from TODO.** It is Done.
2. **Rename `IPI-1066` correctly:** `DASH-MAIN-001`, not `HOME-001`.
3. **Do not put PLANNER-CONTEXT before PLAN.** Live Linear blocks PLANNER-CONTEXT on SHOOT-SAVE and SHOOT-WIZARD.
4. **Do not make M3 Cloudinary delivery a hard blocker for ASSETS-001.** M2 may ship org-safe metadata/placeholder state and wire signed previews later.
5. **Do not mix the full project catalog with the MIGRATEv2 execution queue.** The live MIGRATEv2 label currently returns 28 tasks including APP-001; after moving APP-001 to changelog, 27 remain active.
6. **Epics are organization only.** They do not receive execution numbers.
7. **Status does not define dependency order.** Linear `blockedBy` / `blocks` and verified architecture do.
8. **Numbers are presentation only.** Never use them as a substitute for live dependency checks.

---

# Compact master queue

| Priority | Lane | Status | Task |
|---:|---|:---:|---|
| 1 | Operator | 🟡 | **IPI-1066 · DASH-MAIN-001 — Reuse the Proven iPix Command Center as the Main Dashboard Page** |
| 2 | Operator | 🔵 | **IPI-1068 · BRAND-001 — Let Operators Browse Brands and Open Complete Brand Profiles** |
| 3 | Operator | 🔵 | **IPI-1067 · SHOOT-001 — Let Operators Browse Shoots and Open Complete Shoot Records** |
| 4 | Operator | 🔵 | **IPI-1140 · INTELLIGENCE-RAIL-001 — Bring the Proven iPix Intelligence Panel Into the New Operator Workspace** |
| 5 | Operator | 🔵 | **IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records** |
| 6 | Operator | 🔵 | **IPI-1070 · CRM-001 — Bring the Proven iPix CRM Workspace Into the New App** |
| 7 | Operator | 🔵 | **IPI-1072 · OPERATIONS-001 — Bring the Operator Inbox and Coordination Workflow Into the New App** |
| 8 | Operator | 🔵 | **IPI-1071 · TALENT-BOOKING-001 — Let Operators Find Talent and Manage Bookings** |
| 9 | Operator | 🔵 | **IPI-1074 · PLANS-001 — Bring the Existing Production Planning Workspace Into /app/plans** |
| 10 | Operator | 🔵 | **IPI-1073 · ANALYTICS-001 — Bring the Existing Analytics Workspace Into the New App Without Fake Metrics** |
| 11 | AI | 🔴 | **IPI-1048 · PLANNER-001 — Make the Production Planner the Main iPix AI Assistant** |
| 12 | AI | 🔵 | **IPI-1049 · TOOL-001 — Let the Planner Build Shoot Type, Deliverables, Shot List, and Budget Safely** |
| 13 | AI | 🔵 | **IPI-1081 · PLAN-001 — Make the Planner Return a Complete Structured Shoot Plan** |
| 14 | AI | 🔵 | **IPI-1084 · APPROVAL-001 — Let Operators Review, Edit, Approve, or Reject AI Plans Before Anything Is Saved** |
| 15 | AI | 🔵 | **IPI-1083 · SHOOT-SAVE-001 — Save an Approved Shoot Once and Under the Correct Organization** |
| 16 | AI | 🔵 | **IPI-1085 · SHOOT-WIZARD-001 — Let Operators Build and Review a Complete Production-Ready Shoot** |
| 17 | AI | 🔵 | **IPI-1087 · PLANNER-CONTEXT-001 — Keep the Active Brand and Shoot Brief Available During Planning** |
| 18 | Brand AI | 🔵 | **IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile** |
| 19 | Marketing | 🟡 | **IPI-1053 · MARKETING-NAV-001 — Reuse the Existing iPix Marketing Header, Footer, and Shared Layout** |
| 20 | Marketing | 🔵 | **IPI-1058 · MARKETING-LOGIN-001 — Reuse the Proven iPix Login Experience With the New Supabase Auth Setup** |
| 21 | Marketing | 🔵 | **IPI-1089 · ONBOARD-001 — Let a New iPix User Sign Up, Create Their First Brand, and Reach the Operator Workspace** |
| 22 | Marketing | 🔵 | **IPI-1057 · MARKETING-HOME-001 — Reuse the Existing iPix Marketing Homepage in the New App** |
| 23 | Marketing | 🔵 | **IPI-1060 · MARKETING-SERVICES-001 — Reuse the Existing iPix Photography Service Pages** |
| 24 | Marketing | 🔵 | **IPI-1064 · MARKETING-MEDIA-001 — Reuse and Optimize the Existing iPix Marketing Images, Sliders, and Visual Content** |
| 25 | Marketing | 🔵 | **IPI-1063 · MARKETING-SEO-001 — Keep the New iPix Marketing Site Searchable and Correctly Indexed** |

---

## Summary

- **Best decision:** keep one compact MIGRATEv2 execution catalog instead of mixing it with the much larger project backlog.
- **Primary product path:** `DASH → BRAND → SHOOT → INTELLIGENCE RAIL → ASSETS → CRM → OPERATIONS → TALENT → PLANS → ANALYTICS`.
- **AI path:** `STREAM gate → PLANNER → TOOL → PLAN → APPROVAL → SHOOT-SAVE → SHOOT-WIZARD → PLANNER-CONTEXT`.
- **Brand AI:** starts after BRAND.
- **Marketing:** runs as a parallel lane; `NAV → LOGIN → ONBOARD` is the first-user critical chain.
