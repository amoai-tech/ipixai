---
title: Cloudinary media — layer PRDs (ipixai)
status: Hub
checked: 2026-09-02
parent: docs/prd.md
epic: IPI-1102
---

# Cloudinary — product requirements (hub)

This file is the **cross-phase research SSOT**. Execution detail lives in four phase PRDs (do not implement from this hub alone):

| Phase | File | Job |
| --- | --- | --- |
| Core | [cloudinary-core-prd.md](./cloudinary-core-prd.md) | SDKs, secrets, public `CldImage`, signed upload, HMAC webhook, authenticated **eager** preview |
| MVP | [cloudinary-mvp-prd.md](./cloudinary-mvp-prd.md) | Widget → attach → QA ∥ DNA → exact-version approval → approved delivery |
| Advanced | [cloudinary-advanced-prd.md](./cloudinary-advanced-prd.md) | Reuse, video, SMD, Analyze — **do not mint** until **IPI-1120** |
| Production | [cloudinary-production-readiness-prd.md](./cloudinary-production-readiness-prd.md) | **IPI-1115** last; triggers **and** preset `notification_url` |

If this hub disagrees with a phase PRD on **live** names (presets, `t_asset-*`, trigger URIs), the phase PRD + MCP/Linear win. Host is **Vercel**. Pipe → widget → cutover.

# Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Research Basis and Verified Current State](#2-research-basis-and-verified-current-state)
3. [Problem Statement](#3-problem-statement)
4. [Goals, Non-Goals, and Product Principles](#4-goals-non-goals-and-product-principles)
5. [Target Users and Business Outcomes](#5-target-users-and-business-outcomes)
6. [Source-of-Truth Ownership](#6-source-of-truth-ownership)
7. [Product Scope by Phase](#7-product-scope-by-phase)
8. [Core User Journeys](#8-core-user-journeys)
9. [Routes, Screens, and Three-Panel UX](#9-routes-screens-and-three-panel-ux)
10. [Core Feature Requirements](#10-core-feature-requirements)
11. [Cloudinary Architecture](#11-cloudinary-architecture)
12. [Upload Architecture](#12-upload-architecture)
13. [Webhook and Synchronization Architecture](#13-webhook-and-synchronization-architecture)
14. [Private Delivery and Transformation Architecture](#14-private-delivery-and-transformation-architecture)
15. [Asset Identity and Lifecycle](#15-asset-identity-and-lifecycle)
16. [Asset QA and Brand DNA](#16-asset-qa-and-brand-dna)
17. [CopilotKit and Mastra Integration](#17-copilotkit-and-mastra-integration)
18. [Data Model](#18-data-model)
19. [Security and Threat Model](#19-security-and-threat-model)
20. [Failure, Recovery, and Reconciliation](#20-failure-recovery-and-reconciliation)
21. [Video Requirements](#21-video-requirements)
22. [Search, Metadata, and Reuse](#22-search-metadata-and-reuse)
23. [Campaign and Publishing Integration](#23-campaign-and-publishing-integration)
24. [Analytics and Operational Metrics](#24-analytics-and-operational-metrics)
25. [Pricing, Plan, and Product Constraints](#25-pricing-plan-and-product-constraints)
26. [Development Order and Dependencies](#26-development-order-and-dependencies)
27. [Linear Task Mapping](#27-linear-task-mapping)
28. [Testing and Verification Strategy](#28-testing-and-verification-strategy)
29. [Production Readiness](#29-production-readiness)
30. [Risks and Constraints](#30-risks-and-constraints)
31. [Advanced Features](#31-advanced-features)
32. [Deferred / Do-Not-Build](#32-deferred--do-not-build)
33. [Technical Research and Reference Pack](#33-technical-research-and-reference-pack)
34. [Success Criteria and KPIs](#34-success-criteria-and-kpis)
35. [Scores and Final Verdict](#35-scores-and-final-verdict)

---

# 1. Executive Summary

iPix needs a secure, version-aware media platform that supports the full fashion-production lifecycle:

```text
Brand
→ Shoot
→ Upload
→ Exact asset/version identity
→ Preview
→ Technical QA
→ Brand DNA analysis
→ Human approval
→ Campaign reuse
→ Channel transformation
→ Delivery
→ Publishing
→ Measurement
→ Learning
````

The smallest reliable architecture is:

- **Cloudinary** owns media bytes, immutable provider identity, versioning, transforms, CDN delivery, media metadata, and optional media analysis.
- **Supabase/Postgres** owns organization/brand/shoot relationships, approval state, campaign links, evidence, audit, and authorization truth.
- **Next.js on Vercel** owns authenticated server endpoints for upload signing, webhook verification, and private delivery URLs.
- **CopilotKit** owns the operator-facing AI experience.
- **Mastra** owns bounded AI tools/workflows and orchestration.
- **Humans approve consequential state changes.**

The implementation must **not** build a custom uploader, a second DAM, a custom transformation engine, a custom media search database, or a Cloudflare image-signing worker.

The fastest safe path is:

```
Cloudinary Console / Power Start
→ CLI
→ Cloudinary MCP
→ official Node SDK
→ next-cloudinary
→ official signed-upload examples
→ COPY+CLEAN prior iPix media UI where useful
→ smallest iPix authorization / RLS adapter
```

Cloudinary foundation belongs early because Home, Brand, Shoot, Assets, marketing, and campaign screens all need media. The complete private production-media workflow remains M3 because tenant-safe delivery, approval, and exact-version semantics depend on the media data/security contract.

---

# 2. Research Basis and Verified Current State

## 2.1 Verified iPix runtime

Current `amoai-tech/ipixai` `package.json` confirms:

- Next.js `16.1.2`
- React `19.2.1`
- CopilotKit `1.68.1`
- `@ag-ui/mastra` `1.1.2`
- Mastra core `1.63.2`
- Supabase JS `2.112.4`
- Vercel-oriented Next.js runtime
- **No `cloudinary` dependency**
- **No `next-cloudinary` dependency**

Therefore, Cloudinary application setup is not yet installed in the V2 package graph and **IPI-1108 · CLD-FOUNDATION-001 — Validate Cloudinary Tooling, SDKs, Environment, and Existing Configuration** remains the correct first implementation task.

## 2.2 Verified connected Cloudinary environment

Connected Cloudinary usage reported on 2026-09-02:

|Item|Verified current value|
|---|---|
|Plan|Free|
|Credits used|1.08 / 25|
|Credit use|4.32%|
|Resources|287|
|Derived resources|293|
|Requests|26,093|
|Transformations|87|
|Bandwidth|~1.10 GB|
|Storage|~94.5 MB|
|Cloudinary AI usage|0 / 200|
|Object detection usage|10 / 5,000|
|Max image|10 MB|
|Max video|100 MB|
|Max raw file|10 MB|
|Max image pixels|25 MP|

This means iPix can prove the Core integration against the existing Free environment without purchasing a new plan. Advanced DAM and AI features must remain plan-gated.

## 2.3 Verified Cloudinary product facts

Current official Cloudinary documentation confirms:

- The Upload Widget supports signed uploads and avoids building an in-house uploader.
- The Upload Widget includes drag/drop, cropping, upload progress, thumbnail preview, event hooks, and WCAG 2.1 AA-oriented accessibility.
- Authenticated assets and their derivatives require signed delivery.
- Authenticated assets do **not** support arbitrary on-the-fly transformations; required derivatives should be generated eagerly and then signed.
- Cloudinary backend SDKs generate delivery signatures.
- Notification signatures can be verified with Cloudinary SDK methods; timestamp validity should be enforced.
- Named transformations provide reusable transformation contracts.
- Analyze API is **Public Beta** and relevant analysis types require active add-ons.
- Analyze API includes AI Vision, image quality, fashion classification, tagging, moderation, captioning, shop classifier, OCR/text models, and other analysis endpoints.
- Visual / Natural Language Search is a premium Assets Enterprise capability.
- Media Library Widget is an Enterprise/Assets feature with per-user seat implications.
- Structured metadata exists on Free in limited form; complete DAM structured metadata capabilities are Assets Enterprise-oriented.
- MediaFlows provides low-code media automation and should be considered before custom automation.
- Automatic backup is off by default; backup should be explicitly enabled if recovery is required.

## 2.4 Source hierarchy

When sources disagree:

```
Current live runtime/config
→ live Linear
→ package.json + lockfile + current code
→ accepted iPix PRD / ADR
→ current official Cloudinary docs
→ current official GitHub source/examples
→ legacy iPix/Lumina code
→ old planning docs
```

---

# 3. Problem Statement

iPix has a mature fashion-production data model and prior media UI patterns, but V2 does not yet have the live Cloudinary application pipe.

Without the pipe:

- Operators cannot securely upload shoot selects into the new app.
- Screens may display temporary/static images rather than canonical provider assets.
- Supabase asset rows can drift from Cloudinary provider truth.
- Approval can accidentally apply to the wrong media version.
- Private DAM media may be exposed using public URLs.
- Campaign planning cannot reliably reuse existing approved assets.
- Brand DNA and QA can analyze media without a stable immutable asset/version contract.
- Delivery can serve “latest” rather than the exact version approved by a human.

The core product problem is therefore **not image rendering alone**. It is making every media operation version-aware, tenant-safe, auditable, reusable, and simple for operators.

---

# 4. Goals, Non-Goals, and Product Principles

## 4.1 Goals

1. Establish Cloudinary as the canonical media-byte layer.
2. Let authenticated operators upload securely without exposing API secrets.
3. Mirror provider events into Supabase only after verified webhooks.
4. Bind every iPix asset record to exact Cloudinary provider identity/version.
5. Render public imagery simply and private imagery through server-authorized delivery.
6. Run deterministic QA before expensive AI.
7. Compare assets against approved Brand Brain/Knowledge without autonomous approval.
8. Approve or reject the **exact immutable asset version**.
9. Deliver only approved named-transform derivatives.
10. Reuse approved existing assets before requesting new production.
11. Detect drift between Cloudinary and Supabase.
12. Make cutover reversible.

## 4.2 Non-goals

- Build a custom uploader.
- Store image/video bytes in Supabase as the V2 media path.
- Make Cloudinary Search the iPix business database.
- Make Cloudinary ACLs the iPix approval system.
- Allow browser-provided org IDs to authorize media.
- Build a custom transformation DSL.
- Build a custom image CDN.
- Create a permanent “Media Agent” before bounded tools prove value.
- Put Visual Search, Analyze API, Media Library Widget, or paid AI add-ons on the Core critical path.
- Retarget the production Cloudinary notification endpoint before the explicit cutover task.
- Add autonomous publish/delete/approval behavior.

## 4.3 Core principles

```
Cloudinary owns media.
Supabase owns business truth.
Server owns authorization.
Exact version owns approval identity.
AI proposes.
Humans decide.
Native/deterministic first.
Custom code last.
Cutover last.
```

---

# 5. Target Users and Business Outcomes

|User|Need|Product outcome|
|---|---|---|
|iPix operator|Upload/review/deliver shoot media|Faster production handoff with no manual file juggling|
|Creative director|Understand quality + brand fit|Review evidence and approve exact versions|
|Photographer|Deliver selects reliably|Signed upload into correct shoot|
|Brand/marketing lead|Reuse approved assets|Find campaign-ready media without reshooting|
|Campaign operator|Preview channel derivatives|Use exact approved media in publish plans|
|System admin|Diagnose media drift/errors|Reconcile Cloudinary and Supabase safely|
|Developer|Build media features quickly|Reuse SDK/widget/examples instead of custom infrastructure|

Business outcomes:

- lower reshoot rate
- shorter upload-to-approval cycle
- higher approved asset reuse
- fewer asset/version mistakes
- zero cross-tenant leaks
- fewer custom media services to maintain

---

# 6. Source-of-Truth Ownership

|Concern|Owner|Must not own|
|---|---|---|
|Original media bytes|Cloudinary|Supabase database|
|Provider asset identity|Cloudinary `asset_id`|browser-generated IDs|
|Provider version|Cloudinary `version`|“latest” implicit state|
|Transform definitions|Cloudinary named/eager transforms|component-specific crop strings|
|Media technical metadata|Cloudinary|duplicate app-specific copies beyond needed mirror|
|Org membership|Supabase|Cloudinary|
|Active-org authorization|Supabase + server|browser|
|Brand / shoot relationship|Supabase|Cloudinary folder names|
|Approval|Supabase|Cloudinary ACL|
|Approval audit|Supabase|client state|
|Campaign asset relationship|Supabase|Cloudinary Search|
|AI reasoning|Mastra/model provider|database|
|AI UI|CopilotKit|Cloudinary Console|
|Publish status|Postiz/provider|Cloudinary|
|Product behavior analytics|PostHog|Cloudinary|
|BI/reporting|Metabase|Cloudinary|
|Revenue|Stripe / commerce source|Cloudinary|

---

# 7. Product Scope by Phase

## 7.1 Core

Goal: prove the secure media pipe.

Must include:

- environment validation
- `cloudinary` Node SDK
- `next-cloudinary`
- env/secrets contract
- public Cloudinary rendering
- signed upload route foundation
- webhook signature verification
- provider identity/version mirror
- private authenticated delivery contract
- named/eager transformation proof
- reconciliation read path
- one disposable E2E upload proof

No advanced AI.

## 7.2 MVP

Goal: complete the operator production-media journey.

```
Shoot
→ Upload
→ Attach
→ Preview
→ QA ∥ Brand DNA
→ Human review
→ Approve exact version
→ Deliver exact derivative
```

Must include:

- Assets workspace
- Asset Detail
- Upload Widget
- shoot attachment
- technical/channel QA
- Brand DNA analysis
- human media approval
- approved delivery
- campaign-ready asset identity
- failure/recovery states

## 7.3 Advanced

Only after MVP proves real need:

- structured metadata expansion
- visual/natural-language search
- `findAssets`
- Media Library Widget
- video workflows
- AI moderation/tagging
- Analyze API
- MediaFlows
- generative transforms
- bulk operations
- campaign asset reuse scoring
- export/manifests
- advanced asset intelligence

## 7.4 Production-ready

Focus:

- production webhook cutover
- replay/idempotency
- monitoring
- quotas/cost controls
- backup/restore
- incident runbooks
- reconciliation
- performance/load
- browser/E2E
- rollback

---

# 8. Core User Journeys

## 8.1 Operator upload

## 8.2 Asset QA

```
Ready exact version
→ width/height/bytes/format/aspect checks
→ Cloudinary native quality/media signals
→ named-transform/channel checks
→ optional semantic vision
→ pass / warn / fail / unknown
→ operator review
```

## 8.3 Brand DNA

```
exact asset version
→ approved Brand Knowledge
→ bounded analysis
→ evidence + confidence
→ CopilotKit review
→ operator decision
```

## 8.4 Approval

```
QA + Brand DNA
→ review exact version
→ approve / reject
→ Supabase approval record
→ audit
→ approved delivery eligible
```

A newer Cloudinary version must **not** inherit prior approval.

## 8.5 Campaign reuse

```
campaign requirement
→ query approved assets in Supabase
→ enforce org/brand
→ deterministic metadata match
→ optional Cloudinary metadata/search enrichment
→ optional visual/semantic matching
→ operator selects
→ link exact approved version to campaign
```

---

# 9. Routes, Screens, and Three-Panel UX

> **Left = Context**  
> **Main = Work**  
> **Right = Intelligence**

|Screen|Purpose|Main work|Cloudinary use|AI / HITL|
|---|---|---|---|---|
|`/app` Home|work summary|recent brands/shoots/assets|public/safe thumbnails|next action suggestions|
|`/app/brands`|brand browse|brand cards/profile|logos/heroes|Brand intelligence|
|`/app/shoots`|shoot browse|cards/list|cover/reference images|production context|
|`/app/shoots/[id]`|shoot workspace|assets tab + review|private signed previews|QA/DNA/approval|
|Upload panel|upload|Upload Widget|signed upload|no AI required|
|`/app/assets`|asset workspace|gallery/filter|private signed thumbs|find/review suggestions|
|`/app/assets/[id]`|exact asset detail|version, metadata, QA, approval|exact provider version|DNA/QA/HITL|
|`/app/campaigns/[id]`|campaign planning|approved asset selection|exact approved media|reuse suggestions|
|Channel Preview|publishing preview|platform derivative preview|named transforms|publish HITL|
|Analytics|measurement|asset/campaign performance|identity join only|narrated insights|
|Marketing pages|public web|heroes/sliders|public CldImage|no private DAM|

### Left — Context

- organization
- active brand
- shoot
- campaign
- asset filters
- approval status
- channel

### Main — Work

- asset gallery
- upload panel
- asset detail
- version information
- metadata
- QA results
- named-transform previews
- delivery manifest
- approval controls

### Right — Intelligence

- Brand DNA explanation
- technical warnings
- channel readiness
- reuse suggestions
- missing asset requirements
- transformation recommendation
- evidence/citations
- explicit approval cards where consequential

---

# 10. Core Feature Requirements

## 10.1 Environment foundation

Owner: **IPI-1108 · CLD-FOUNDATION-001 — Validate Cloudinary Tooling, SDKs, Environment, and Existing Configuration**

Requirements:

- use existing connected Cloudinary environment unless audit proves otherwise
- install official server SDK
- install `next-cloudinary`
- keep API secret server-only
- validate via Console, CLI, MCP, SDK
- document plan and limits
- verify current named transforms/presets before assuming them

## 10.2 Public rendering

Use `CldImage` for public/marketing media and provider-safe public imagery. Do not use it as the private DAM authorization boundary.

## 10.3 Signed uploads

- authenticated operator
- server-derived active org
- server validates shoot
- Cloudinary SDK creates signature
- fresh timestamp/context
- API secret never reaches client
- format/size/resource restrictions
- widget progress/error/cancel states
- business readiness confirmed by webhook, not browser callback alone

## 10.4 Webhook mirror

- preserve raw body
- verify signature and timestamp
- reject spoof/stale events
- normalize exact provider identity/version
- idempotent persistence
- return success only after durable commit
- DB failure returns retryable failure

## 10.5 Private delivery

- authorize user/org before URL generation
- lookup Supabase asset relationship
- exact Cloudinary version
- allowlisted named transforms
- server-signed URL
- no arbitrary transformation strings
- unapproved asset cannot use approved-delivery path

## 10.6 Reconciliation

Detect without destructive repair:

- provider asset without DB row
- DB row without provider asset
- version mismatch
- missing derivative
- approval to superseded version
- webhook gaps

---

# 11. Cloudinary Architecture

---

# 12. Upload Architecture

Rules:

- signed production uploads
- no secret in browser
- no custom multipart stack
- incoming transformations only when they safely constrain originals
- eager private derivatives where required
- callback ≠ durable business truth

---

# 13. Webhook and Synchronization Architecture

```
request.text()
→ verify Cloudinary notification signature
→ validate timestamp window
→ parse
→ classify event
→ dedupe
→ normalize asset/version
→ persist mirror + event atomically
→ 2xx
```

Database failure:

```
valid provider event
→ DB fails
→ retryable HTTP failure
→ provider retry / reconcile
```

No catch-all 200.

Production cutover stays with:

**IPI-1115 · CLD-CUTOVER-001 — Cut Cloudinary Notifications Over to V2 Safely**

---

# 14. Private Delivery and Transformation Architecture

|Media|Delivery|
|---|---|
|public marketing|`CldImage` / public URL|
|private shoot asset|server-authorized signed URL|
|approved campaign derivative|exact approved version + allowlisted named transform|
|unapproved original|no anonymous delivery|

**Official constraint (must drive IPI-1112):** for `type=authenticated`, Cloudinary does **not** create on-the-fly derivatives. Derived assets must already exist from **eager** (upload/update) or an explicit generate; delivery still needs a **signed** URL. See [control access to media](https://cloudinary.com/documentation/control_access_to_media).

Live product environment (MCP 2026-09-02) — **reuse, do not rename in Core:**

| Name | Role |
| --- | --- |
| `t_asset-masonry` | grid thumbs |
| `t_asset-review` | review |
| `t_asset-detail` | detail |
| Preset eager `c_limit,w_600\|1200\|1600,f_auto,q_auto` | already on `ipix-signed-upload` |

**IPI-1112** must prove each preview is an **eager (or explicit) derived** + signed URL. Do not invent `ipix_*` names until those live `t_asset-*` names are mapped or extended as eager. Unused Console names (`t_Banner 9:16`, `t_Banner 16:9`) stay Advanced/channel work.

---

# 15. Asset Identity and Lifecycle

Mirror at minimum when needed:

- `asset_id`
- `public_id`
- `version`
- `resource_type`
- delivery type
- format
- width / height
- bytes
- duration
- created timestamp

Approval identity is **asset ID + exact version**.

---

# 16. Asset QA and Brand DNA

Deterministic-first:

```
dimensions/aspect/format/bytes
→ channel specs
→ Cloudinary native metadata/quality
→ optional Cloudinary add-on analysis
→ multimodal model only for semantic ambiguity
```

QA result:

```
type AssetQaResult = {
  status: 'pass' | 'warn' | 'fail' | 'unknown';
  assetId: string;
  version: number;
  checks: Array<{
    code: string;
    status: 'pass' | 'warn' | 'fail' | 'unknown';
    message: string;
    evidence?: unknown;
  }>;
};
```

DNA:

```
exact version
→ approved Brand Knowledge
→ semantic comparison
→ evidence/confidence
→ operator review
```

DNA and QA run in parallel after attachment.

---

# 17. CopilotKit and Mastra Integration

Do not create one agent per media feature.

Prefer typed tools:

|Tool|Job|Write|HITL|
|---|---|---|---|
|`getAsset`|read authorized asset/version|No|No|
|`findAssets`|search approved iPix records|No|No|
|`checkAssetQuality`|QA|No|No|
|`checkBrandAlignment`|Brand DNA|No|No|
|`suggestChannelTransforms`|recommend allowlisted transform|No|No|
|`prepareMediaApproval`|review payload|No|No|
|`commitMediaApproval`|commit explicit decision|Yes|Yes|

---

# 18. Data Model

Audit existing schema before adding tables.

Likely existing concepts:

- `assets`
- `cloudinary_assets`
- `asset_events`
- `asset_variants`
- `asset_links`
- shoot-asset relationships
- campaigns / campaign assets
- evidence/audit structures

Do not mirror the full Cloudinary object unless needed.

---

# 19. Security and Threat Model

|Risk|Prevention|Detection / proof|
|---|---|---|
|unsigned upload|signed widget only|route tests|
|stale signature|short timestamp window|stale-sign test|
|Org A targets Org B|server-derived org + shoot authorization|cross-org test|
|secret in browser|server-only env|bundle scan|
|webhook spoof|SDK signature verification|invalid signature test|
|replay|timestamp + idempotency|duplicate test|
|DB fail after upload|retryable failure + reconcile|fault injection|
|private asset public|authenticated/signed delivery|anonymous fetch test|
|wrong version approved|version-scoped approval|regression test|
|new version inherits approval|never inherit|N→N+1 test|
|arbitrary transform|named-transform allowlist|rejection test|
|malicious/oversized upload|format/size constraints + optional moderation|validation tests|
|runaway credits|quotas/monitoring|usage dashboard|

---

# 20. Failure, Recovery, and Reconciliation

- Upload fails → no Ready row; retry UI.
- Cloudinary succeeds / webhook fails → processing state; retry/reconcile.
- DB unavailable → webhook returns retryable failure.
- Duplicate webhook → idempotent.
- Older event arrives late → never regress newer version.
- Transform unavailable → visible error, no arbitrary fallback.
- AI analysis unavailable → deterministic QA still usable; semantic result `unknown`.
- Cloudinary outage → graceful unavailable state; no fake deletion.
- Supabase outage → provider upload can exist but app approval/readiness waits for durable truth.
- Approved provider asset deleted → reconciliation raises blocking issue.

---

# 21. Video Requirements

Core image path ships first.

When video is needed:

- exact provider identity/version
- Cloudinary transformations
- poster/thumbnail generation
- responsive delivery

Use Cloudinary Video Player when adaptive streaming, analytics, captions, playlists, or richer player behavior provides value. Use plain HTML5 `<video>` for simple, performance-sensitive preview surfaces.

Advanced:

- HLS/DASH
- transcription/captions
- clipping
- player analytics
- moderation
- automated previews

---

# 22. Search, Metadata, and Reuse

Core library search:

```
Supabase authorization + business filters first
→ optional Cloudinary provider enrichment
```

Cloudinary Search must not replace Supabase business truth.

Metadata options:

- tags
- contextual metadata
- structured metadata

Potential advanced structured fields:

- photographer
- rights expiry
- season
- product category
- style
- usage channel

Cloudinary currently limits product environments to 100 structured metadata fields.

Visual/Natural Language Search is Assets Enterprise premium: Advanced only.

---

# 23. Campaign and Publishing Integration

Campaigns never link unapproved versions.

---

# 24. Analytics and Operational Metrics

**Cloudinary:** storage, bandwidth, requests, transformations, resources, video/player analytics.  
**Supabase/Metabase:** workflow cycle times, approvals, asset reuse, campaign relations.  
**PostHog:** operator behavior/funnels.  
**Postiz:** publishing/channel metrics.  
**Stripe/commerce:** revenue.

Do not replicate all provider analytics into Supabase.

---

# 25. Pricing, Plan, and Product Constraints

Verified live environment: Free, 25 credits, low current usage.

Current public plan comparison:

|Plan|Image max|Video max|Admin API hourly|
|---|---|---|---|
|Free|10 MB|100 MB|500|
|Plus|20 MB|2 GB|2,000|
|Advanced|40 MB|4 GB|2,000|
|Enterprise|Custom|Custom|Custom|

At research time, public Plus pricing lists roughly `$99/month` monthly or `$89/month` billed yearly. Recheck before purchase.

Plan gates:

- Analyze API: Public Beta + add-ons
- Visual Search: Assets Enterprise premium
- Media Library Widget: Assets/Enterprise + user seat implications
- full DAM structured metadata features: Enterprise-oriented
- external backup storage: paid plans
- dedicated webhook verification key: Enterprise on request

Do not hide paid requirements in Core acceptance.

---

# 26. Development Order and Dependencies

Parallel after hardening:

```
IPI-1110 Sign ∥ IPI-1111 Webhook ∥ IPI-1112 Private Delivery
```

Parallel after attachment:

```
IPI-1136 Asset DNA ∥ IPI-1138 Asset QA
```

---

# 27. Linear Task Mapping

|Task|Role|Recommendation|
|---|---|---|
|**IPI-1108 · CLD-FOUNDATION-001 — Validate Cloudinary Tooling, SDKs, Environment, and Existing Configuration**|packages/env|M1 — correct|
|**IPI-1109 · MEDIA-DATA-001 — Prove Asset Tables Stay Org-Safe for V2**|schema/RLS|M3|
|**IPI-1122 · SB-MEDIA-HARDEN-001 — Harden Supabase Media Grants and Canonical Shoot Links for Cloudinary V2**|DDL/security|M3|
|**IPI-1110 · CLD-SIGN-001 — Sign Cloudinary Uploads for the Trusted Organization**|signing|M3|
|**IPI-1111 · CLD-WEBHOOK-001 — Mirror Cloudinary Uploads and Deletes into Supabase**|mirror|M3|
|**IPI-1112 · CLD-DELIVERY-001 — Serve Org-Safe Cloudinary Previews with Named Transforms**|private delivery|M3|
|**IPI-1113 · CLD-E2E-001 — Prove One Disposable Upload Reaches Supabase Ready**|pipe proof|M3|
|**IPI-1114 · CLD-RECONCILE-001 — Detect Cloudinary and Supabase Drift Without Mutating Production**|drift|M3|
|**IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records**|UI|UI can port early; private completion waits for delivery|
|**IPI-1116 · CLD-UPLOAD-001 — Let Operators Upload Shoot Selects with the Cloudinary Widget**|upload UX|M3|
|**IPI-1118 · SHOOT-ASSETS-001 — Attach Uploaded Assets to the Correct Saved Shoot**|domain link|M3|
|**IPI-1136 · ASSET-DNA-001 — Analyze Uploaded Shoot Assets Against the Approved Brand Brain**|semantic analysis|M3|
|**IPI-1138 · ASSET-QA-001 — Check Asset Quality and Channel Readiness Before Approval**|QA|M3|
|**IPI-1119 · MEDIA-APPROVAL-001 — Approve or Reject the Exact Cloudinary Asset Version**|human approval|M3|
|**IPI-1120 · MEDIA-DELIVERY-001 — Deliver Only Approved Named-Transform Asset Versions**|final delivery|M3|
|**IPI-1115 · CLD-CUTOVER-001 — Cut Cloudinary Notifications Over to V2 Safely**|cutover|last|

No new Foundation Cloudinary task is required.

---

# 28. Testing and Verification Strategy

```
static inspection
→ unit/pure
→ targeted integration
→ RLS/security
→ webhook signature/idempotency
→ typecheck
→ build
→ browser/E2E
→ Vercel preview
→ production proof only at approved cutover
```

Required:

- Org A signs for Org A shoot
- Org A cannot sign for Org B shoot
- stale signature rejected
- secret absent from browser
- valid webhook accepted
- bad signature rejected
- duplicate event idempotent
- DB failure returns retryable failure
- old event cannot regress new version
- private asset anonymous fetch fails
- unsupported transform rejected
- exact approved version delivered
- N approval does not cover N+1
- rejected asset cannot be delivered
- drift cases detected

---

# 29. Production Readiness

- [ ]  official SDKs installed/verified
- [ ]  env/secrets documented
- [ ]  API secret server-only
- [ ]  signed upload proven
- [ ]  trusted active-org authorization proven
- [ ]  raw-body webhook verification proven
- [ ]  idempotency proven
- [ ]  retry behavior proven
- [ ]  private authenticated delivery proven
- [ ]  named/eager transforms verified live
- [ ]  exact provider identity/version mirrored
- [ ]  cross-org tests pass
- [ ]  exact-version approval passes
- [ ]  unapproved media blocked from delivery
- [ ]  reconciliation works
- [ ]  logs/metrics available
- [ ]  quotas visible
- [ ]  rollback documented/tested
- [ ]  previous production webhook recorded
- [ ]  disposable E2E passes
- [ ]  browser proof passes
- [ ]  typecheck/tests/build/CI pass
- [ ]  only then execute **IPI-1115 · CLD-CUTOVER-001 — Cut Cloudinary Notifications Over to V2 Safely**

---

# 30. Risks and Constraints

1. **Authenticated transform constraint:** private authenticated derivatives may need eager generation.
2. **Free plan file limits:** high-resolution fashion originals may exceed 10 MB.
3. **Analyze API:** Beta + add-on; never Core blocker.
4. **Enterprise DAM:** Visual Search/Media Library Widget plan-gated.
5. **Metadata duplication:** provider metadata cannot become tenant/approval truth.
6. **Overwrite/version behavior:** approval remains exact-version scoped.
7. **Backup:** explicitly enable; off by default.

---

# 31. Advanced Features

## Structured metadata

Useful after library scale justifies it: rights expiry, photographer, season, category, style, usage channel.

## Analyze API

Potential: quality, fashion detection, moderation, captioning, object recognition, visual questions. Advanced because Public Beta + add-ons.

## Visual search

Advanced Assets Enterprise only. Authorize candidate set/business state through Supabase; do not trust global provider search as tenant authorization.

## Media Library Widget

Advanced/internal selection only. Consider plan/seat/SSO/cookie constraints.

## MediaFlows

Evaluate before custom media automation.

## Generative transformations

Useful for controlled creative adaptation; every campaign-facing generated derivative still requires review and lineage.

---

# 32. Deferred / Do-Not-Build

**Defer:** visual search, ML Widget, structured metadata expansion, video player, AI tagging/moderation, MediaFlows, bulk export, smart collections, permanent media agent.

**Do not build:** custom uploader, unsigned tenant uploads, Cloudflare signer, custom CDN, custom transform engine, custom webhook crypto when SDK suffices, Cloudinary-as-business-DB, autonomous approve/delete/publish.

---

# 33. Technical Research and Reference Pack

|Reference|Exact iPix use|What it avoids|Limits|
|---|---|---|---|
|[https://cloudinary.com/documentation/ai_powerstart](https://cloudinary.com/documentation/ai_powerstart)|IPI-1108 setup|setup guesswork|dev aid|
|[https://github.com/cloudinary/cloudinary_npm](https://github.com/cloudinary/cloudinary_npm)|server signing/webhooks/URLs|hand-rolled crypto/API|server only|
|[https://github.com/cloudinary-community/next-cloudinary](https://github.com/cloudinary-community/next-cloudinary)|image/upload UI|custom components|not private ACL|
|[https://cloudinary.com/documentation/upload_widget](https://cloudinary.com/documentation/upload_widget)|signed upload|custom uploader|sign required|
|[https://cloudinary.com/documentation/control_access_to_media](https://cloudinary.com/documentation/control_access_to_media)|private delivery|wrong ACL design|**authenticated = eager + signed**|
|[https://cloudinary.com/documentation/delivery_url_signatures](https://cloudinary.com/documentation/delivery_url_signatures)|signed URLs|manual signing|secret server-side|
|[https://cloudinary.com/documentation/notification_signatures](https://cloudinary.com/documentation/notification_signatures)|webhook verification|custom HMAC|key/timestamp handling|
|[https://cloudinary.com/documentation/named_transformations](https://cloudinary.com/documentation/named_transformations)|channel transforms|scattered crop strings|must also be **eager** for authenticated|
|[https://cloudinary.com/documentation/eager_and_incoming_transformations](https://cloudinary.com/documentation/eager_and_incoming_transformations)|private derivatives|on-the-fly DAM|credits/processing|
|[https://cloudinary.com/documentation/analyze_api_guide](https://cloudinary.com/documentation/analyze_api_guide)|advanced AI analysis|custom CV infrastructure|Beta/add-ons|
|[https://cloudinary.com/documentation/structured_metadata](https://cloudinary.com/documentation/structured_metadata)|media classification|custom provider metadata|plan/100 fields|
|[https://cloudinary.com/documentation/dam_visual_search](https://cloudinary.com/documentation/dam_visual_search)|advanced reuse search|custom visual index|Enterprise premium|
|[https://cloudinary.com/documentation/media_library_widget](https://cloudinary.com/documentation/media_library_widget)|embedded DAM UI|custom media browser|Enterprise/seats|
|[https://cloudinary.com/documentation/mediaflows](https://cloudinary.com/documentation/mediaflows)|media automation|custom job runner|plan/capability|
|[https://cloudinary.com/documentation/cloudinary_video_player](https://cloudinary.com/documentation/cloudinary_video_player)|video|custom player stack|bundle/plan|
|[https://cloudinary.com/documentation/backups_and_version_management](https://cloudinary.com/documentation/backups_and_version_management)|recovery|custom backup workflow|**off by default**|
|[https://github.com/cloudinary/mcp-servers](https://github.com/cloudinary/mcp-servers)|inspect/config/analyze|admin scripts|paid feature exposure|
|[https://github.com/cloudinary/asset-management-js](https://github.com/cloudinary/asset-management-js)|reconcile/ops|custom Admin API wrapper|server operations|
|[https://cloudinary.com/pricing/compare-plans](https://cloudinary.com/pricing/compare-plans)|limits|guessed capacity|changes|
|[https://cloudinary.com/pricing](https://cloudinary.com/pricing)|price|stale pricing|recheck|

---

# 34. Success Criteria and KPIs

Reliability:

- upload success %
- webhook durable persistence %
- duplicate side effects = 0
- drift count/rate
- signed delivery failure %
- upload → Ready time

Security:

- cross-tenant leak = **0**
- secret exposure = **0**
- anonymous private access = **0**
- wrong-version approval = **0**
- unapproved delivery = **0**

Efficiency:

- Ready → reviewed
- reviewed → approved
- assets reviewed/operator hour
- approved asset reuse %
- QA resolution without reshoot
- reshoot reduction

Business:

- approved assets/shoot
- campaigns reusing existing assets
- cost per approved asset
- deterministic revenue attribution where available

---

# 35. Scores and Final Verdict

|Area|Score /100|
|---|---|
|Product architecture|90|
|Cloudinary fit|92|
|Security design|88|
|Data ownership|90|
|Reuse efficiency|93|
|AI design|86|
|Cost efficiency|88|
|Testing strategy|85|
|Production readiness definition|90|
|**Overall PRD (research, not shipped)**|**88**|

Scores above are for **this research**, not a live pipe. Implementation confidence stays below 100 until preview E2E and **IPI-1115** smoke. Phase scores live in the four PRDs.

### Will this architecture succeed in real production?

**🟡 YES AFTER IMPLEMENTATION + VERIFICATION.**

Immediate execution:

1. **IPI-1108 · CLD-FOUNDATION-001 — Validate Cloudinary Tooling, SDKs, Environment, and Existing Configuration**
2. **IPI-1109 · MEDIA-DATA-001 — Prove Asset Tables Stay Org-Safe for V2**
3. **IPI-1122 · SB-MEDIA-HARDEN-001 — Harden Supabase Media Grants and Canonical Shoot Links for Cloudinary V2**
4. **IPI-1110 · CLD-SIGN-001 — Sign Cloudinary Uploads for the Trusted Organization** ∥ **IPI-1111 · CLD-WEBHOOK-001 — Mirror Cloudinary Uploads and Deletes into Supabase** ∥ **IPI-1112 · CLD-DELIVERY-001 — Serve Org-Safe Cloudinary Previews with Named Transforms**
5. **IPI-1113 · CLD-E2E-001 — Prove One Disposable Upload Reaches Supabase Ready**
6. product workflow through upload → attach → DNA ∥ QA → approval → delivery
7. **IPI-1115 · CLD-CUTOVER-001 — Cut Cloudinary Notifications Over to V2 Safely** last