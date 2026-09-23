---
title: Cloudinary media
status: Canonical media layer
verified_against: PR #245 branch, 2026-09-21
parent: docs/prd.md
---

# Cloudinary media — product requirements

Cloudinary is the **media layer** for iPix. It owns image/video bytes, transformations, provider asset/version identity, and delivery. Supabase owns business truth around those files: organization, brand, shoot, campaign links, workflow state, approval, actor, and audit history.

## Current verified foundation

Current iPix already has:

- the `cloudinary` Node SDK (`^2.11.0`); `next-cloudinary` is **not** installed at the verified PR #245 baseline;
- a server signing route at `src/app/api/cloudinary/sign/route.ts`;
- a webhook route at `src/app/api/cloudinary/webhook/route.ts`;
- Supabase as durable business-data owner;
- a locked provider contract in [`CONTRACT-1110-1112.lock.md`](./CONTRACT-1110-1112.lock.md).

Live task status belongs to [Linear](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues), not this document.

## Ownership boundary

| System | Owns | Must not own |
|---|---|---|
| Cloudinary | Media bytes, transforms, CDN delivery, provider asset/version identifiers | Tenant membership, shoot/campaign ownership, approval truth |
| Supabase + RLS | Org/brand/shoot/campaign relationships, workflow state, approvals, audit | Image/video bytes |
| Next.js | Authenticated signing, webhook handling, delivery authorization | A second media database |
| CopilotKit / Mastra | Read/search/analyze/propose when useful | Silent upload/delete/approve/publish or tenant bypass |

## Product journey

```text
Shoot / campaign context
→ operator or photographer uploads
→ trusted server authorization
→ signed Cloudinary upload
→ verified webhook
→ Supabase asset record
→ QA + optional Brand DNA evidence
→ operator review
→ exact-version approval
→ protected derivative / campaign reuse
```
## Core — secure media foundation

Detailed requirements: [`cloudinary-core-prd.md`](./cloudinary-core-prd.md)

```text
operator
→ trusted org/shoot authorization
→ signed authenticated upload
→ Cloudinary stores media + required eager derivatives
→ verified webhook
→ durable Supabase asset state
→ protected preview
```

Core proves identity, signing, provider verification, tenant isolation, exact-version delivery, failure handling, and reconcile basics. It does **not** need QA/DNA agents or advanced search.

## MVP — operator media journey

Detailed requirements: [`cloudinary-mvp-prd.md`](./cloudinary-mvp-prd.md)

```text
photographer/operator upload
→ asset appears on saved Shoot
→ QA + Brand DNA evidence in parallel
→ human review
→ approve/reject exact provider version
→ campaign-ready protected derivative
```

The official Upload Widget/Next Cloudinary patterns are preferred over a custom uploader. Widget success is not durable Ready state; verified webhook persistence is.

## Advanced — reuse before reshoot

Detailed requirements: [`cloudinary-advanced-prd.md`](./cloudinary-advanced-prd.md)

Evaluate only after the secure MVP journey is proven:

- structured metadata for media-native attributes;
- optional provider analysis/AI enrichment;
- visual/semantic ranking where plan/entitlement supports it;
- video workflows;
- channel derivatives and export manifests;
- org-scoped `findAssets` / approved-media reuse;
- generative transformations only with new-version review and human approval.
## Required rules

- Secrets never reach the browser.
- The server derives/validates trusted org, brand, and shoot context before signing or delivering protected media.
- Webhook authenticity is verified before business state is persisted.
- Approval binds to the exact provider asset/version.
- A newer version never silently inherits approval.
- Cloudinary Search/Asset Management is not the iPix business database.
- Supabase remains the tenant/workflow source of truth.
- Provider analysis is evidence, not an approval decision.
- Destructive media actions and publishing remain human-controlled.

## Later / explicitly deferred until justified

```text
generic DAM replacement
custom multipart uploader
custom transformation engine
parallel media database
Cloudinary Search as business truth
autonomous approval/publishing/deletion
advanced visual search without proven plan/value
AI add-ons on the critical upload/approval path
```

## Success criteria

- Signed upload works for an authenticated operator in the correct org/shoot context.
- Invalid provider events are rejected.
- Successful provider events become durable Supabase state exactly once.
- Org B cannot obtain Org A protected media through iPix.
- QA/DNA failures do not fabricate success or bypass human review.
- Exact-version approval controls protected delivery.
- Failure paths do not mark incomplete media Ready.
- Targeted tests plus one authenticated end-to-end media journey prove the intended phase.

## Reuse and operations

- Exact external reuse plan: [`reuse.md`](./reuse.md)
- Production/recovery runbook: [`operations.md`](./operations.md)
- Provider contract lock: [`CONTRACT-1110-1112.lock.md`](./CONTRACT-1110-1112.lock.md)
- Historical corrected audit: [`https://github.com/amoai-tech/ipixai/blob/main/docs/archive/cloudinary/audit-2026-09-02.md`](https://github.com/amoai-tech/ipixai/blob/main/docs/archive/cloudinary/audit-2026-09-02.md)

## References

- [Master product requirements](../PRD.md)
- [Product roadmap](../ROADMAP.md)
- [Documentation inventory](../index-docs.md)
- [Linear v2-ipix](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues)
