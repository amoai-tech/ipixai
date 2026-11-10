# iPix — Product Specification at a Glance (WHAT)

> **Purpose:** Define the observable behavior and non-negotiable boundaries behind the [product intent](./intent.md). This is a **navigation and acceptance summary**, not a competing specification: [docs/prd.md](./prd.md) is the master product requirements source; [docs/sitemap.md](./sitemap.md) owns route/phase definitions; each live [Linear issue](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues) owns its exact deliverable.
>
> **Status vocabulary:** **Intended** = product requirement; **Implemented** = supported by current code; **Verified** = supported by specific passing evidence; **Certified** = the required exact-version tests, runtime and user journey proved (including live release checks when required). A route, PRD paragraph, prototype, or scaffold alone does **not** establish certification.

## One complete customer journey

**A fashion producer signs in → selects an authorized Brand → reviews trusted Brand DNA → creates an editable shoot plan → obtains approval of the exact plan → saves and executes the shoot → reviews assets → approves and delivers only the correct media versions.**

Campaign strategy, publication, measurement, and learning extend this foundation in later milestones. They must never silently publish, manufacture KPIs, or overwrite approved Brand knowledge.

## Required behavior by product area

| Capability / phase | Required user-visible behavior | Evidence and ownership |
|---|---|---|
| **Identity and operator workspace** · Foundation | A signed-in operator lands in the correct `/app` workspace, can navigate Brands/Shoots, and sees only authorized information. Unverified users fail closed. | `src/app/app/page.tsx`; `src/lib/auth/app-shell.ts`; auth/tenant tests; [sitemap](./sitemap.md) |
| **First Brand onboarding** · parallel milestone | A new operator can complete a Brand draft and resume/retry safely. Duplicate submits cannot create duplicate organizations or Brands. Human choice still works without AI. | [Onboarding milestone in Linear](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues); Brand domain contracts |
| **Brand Intelligence** · Workspace & Intelligence | Website or manually provided evidence becomes a reviewable, attributable Brand DNA draft. The operator corrects and explicitly approves before promotion to trusted Brand knowledge. Crawl failures are recoverable. | `src/mastra/workflows/brand-intelligence.ts`; [Brand docs](./ipix-platform/10-brands/BRANDS.md); IPI-1093 |
| **Production Copilot** · Foundation/Workspace | One authenticated, in-process Production Planner accepts relevant Brand/Shoot context, streams helpful output, handles exact-run Stop, and preserves authorized conversation history when persistent storage is configured. | `src/app/api/copilotkit/[[...slug]]/route.ts`; `src/mastra/agents/production-planner.ts`; `src/mastra/pg-store.ts`; [AI runtime docs](./copilotkit-mastra/README.md) |
| **Shoot planning and review** · Production | A brief produces editable deliverables, shot list and budget. A human reviews an **exact** plan/revision before an authorized, once-only save. Refresh/retry/concurrent edits cannot turn a stale approval into a different saved shoot. | `src/lib/shoot/decide-shoot-plan-revision.ts`; `src/app/api/shoots/save/route.ts`; IPI-1084, IPI-1083, IPI-1085 |
| **Production, talent, booking and CRM** · Workspace/Production | Operators can work with relevant production records and propose talent/booking actions. Roles, availability and provider facts must be verified before an explicit human confirmation. | [Roadmap](./roadmap.md), [sitemap](./sitemap.md), current booking/CRM Linear tasks |
| **Media, asset QA and delivery** · Production | Signed uploads and trusted callbacks link the correct organization, asset and Cloudinary version. Review/QA and human approval control which version can be previewed or delivered. | `src/app/api/cloudinary/sign/route.ts`; `src/app/api/cloudinary/webhook/route.ts`; `src/app/api/assets/[assetId]/decision/route.ts`; [Cloudinary docs](./cloudinary/README.md) |
| **Campaign strategy and publishing** · Campaigns | Turn approved opportunities and assets into reviewable strategy/copy/previews. **Only explicitly approved** content may be handed to Postiz; record provider results and failures durably. | Linear M4; IPI-42, IPI-77, IPI-195; [roadmap](./roadmap.md) |
| **Measurement and analytics** · Measurement | Show deterministic, source-backed brand, shoot, asset, channel, and attributable commerce metrics with honest empty states. AI can interpret results only after metrics are proved. | Linear M5; IPI-1139; [roadmap](./roadmap.md) |
| **Brand Brain learning** · Learning | Real performance and approved evidence may generate a cited *proposal* to update Brand Brain. A human reviews a diff; the system records the decision and resulting audited version. | Linear M6; [roadmap](./roadmap.md) |
| **Model Agency / Model Search** · Separate expansion | Protect applicant/contact data, require human application decisions, and preserve one vote per eligible round without agent-controlled winners when these workflows ship. | IPI-1376 and IPI-1401 epics; not a dependency of the core shoot journey |

These are **requirements and destination owners**, not a claim that the entire table has shipped. Individual statuses, blockers, live dependencies, and release evidence live in [Linear](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues), never in this file.

## Cross-cutting system contracts

### S-01 — Identity and tenant isolation

- Derive operator and organization from a verified server session and authoritative membership, not from browser `orgId`, `user_metadata`, model text, or supplied thread identifiers.
- All exposed domain reads/writes must enforce tenant scope through server checks and Supabase RLS/authorized RPCs.
- A user from Org B cannot access, replay, stop, approve, deliver, or mutate Org A resources — even with guessed IDs.
- No secret/service-role key or privileged provider token appears in the browser, AI prompt, saved history, screenshot or trace.

**Proof:** Positive Org A journey **and** negative Org B access with real authenticated sessions for touched boundaries; see [AGENTS.md](../AGENTS.md).

### S-02 — Durable data and clear ownership

- Supabase/Postgres stores Brand, Shoot, organization, approval and other business truth; private `mastra.*` state stores agent conversation/workflow runtime, not a second business database.
- The backend validates inputs and the exact authorized action before mutations, handles retries idempotently, and reads back the durable result.
- Cloudinary holds media bytes/transformations; external commerce/publishing systems retain truth about their transactions/outcomes.
- An AI explanation or cached UI state is never proof that the operation committed.

**Proof:** Targeted DB/RPC/RLS test, refresh/readback, and an idempotency/concurrent-request test when relevant.

### S-03 — Human decision and exact-artifact approval

`AI proposal → editable preview → human approve / reject → server revalidate actor, org, artifact version/hash and action → authorized idempotent write → audited readback`

- Approval never means “allow whatever the agent generates next.”
- Rejection and stale revisions must not authorize a consequential write. A lost connection can leave the outcome **unknown** if an approved write already committed; retry must recover the **existing durable result** without creating another effect. Duplicate submissions must be idempotent.
- Publication, payment, booking confirmation, deletion and changing approved Brand Brain are gated actions.

**Proof:** Same-version success; mismatched-version rejection; repeated-click and cross-tenant rejection tests.

### S-04 — Dependable AI interaction

- Use the existing CopilotKit/AG-UI experience and Mastra agents/tools/workflows; avoid building another transport, agent registry, or independent run-state system without proven need.
- The operator can tell whether AI is streaming, stopped, failed, or requires review; AI failure must not prevent safe deterministic task completion.
- Persist history in approved storage where required; exact-run Stop cannot terminate someone else's or a newer run.
- AI suggestions that rely on brand or metric facts must use authorized and cited evidence, not fabricated details.

**Proof:** Authenticated browser journey, restart/replay/Stop proof when touched, and explicit failure/recovery test.

### S-05 — Honest product and release states

- Differentiate **Intended**, **Implemented**, **Verified**, and **Certified** using the definitions above; a built page is not automatically a complete workflow.
- No invented KPIs, readiness scores, sample revenue, booking availability, or “published” statuses.
- User-facing errors should be understandable, privacy-safe, and recoverable. Critical journeys must meet the product accessibility baseline.
- A merged PR does not prove production behavior. Only exact-main, deployed and user-journey evidence can close the applicable release gate.

## Example acceptance criteria — create an approved shoot

**Given** a signed-in producer authorized for Brand A and an editable shoot proposal:

1. They can view evidence, deliverables, shot list and budget before deciding.
2. Approving the displayed revision creates **one** shoot under Brand A; readback returns the saved result.
3. Double approval or network retry does not create a duplicate.
4. A stale revision is rejected with a way to reload and review the correct version.
5. An Org B actor cannot review or save Brand A's plan.
6. Planner failure preserves a safe manual/editable path; nothing is auto-approved.
7. Targeted tests, integration/RLS evidence, and real browser journey prove the accepted behavior.

The task-specific details and schema contracts belong to the relevant [Linear issue](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues), not here.

## Which file answers which question?

- **Why build it?** [intent.md](./intent.md).
- **What must users observe?** This document plus the [master PRD](./prd.md) and domain requirements.
- **Which page/route?** [sitemap.md](./sitemap.md).
- **How and when will we deliver it?** [plan.md](./plan.md), [roadmap.md](./roadmap.md), live Linear.
- **What is currently implemented?** Current `origin/main`, installed types, runtime and tests — **not** a dated document or pending PR.
- **How must engineers behave?** [AGENTS.md](../AGENTS.md), accepted [ADRs](./adr/README.md), and the existing task skill.
