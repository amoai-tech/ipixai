---
title: Cloudinary media
status: Canonical media layer
parent: docs/prd.md
---

# Cloudinary media — product requirements

Cloudinary is the **media layer** for iPix. It owns image/video bytes, transformations, and delivery. Supabase owns the business truth around those files: organization, brand, shoot, asset status, approval, and audit history.

## Current verified foundation

Current `main` includes:

- `cloudinary` and `next-cloudinary` dependencies;
- a server signing route at `src/app/api/cloudinary/sign/route.ts`;
- a webhook route at `src/app/api/cloudinary/webhook/route.ts`;
- Supabase remains the durable business-data owner.

Live task status belongs to [Linear](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues), not this document.

## Outcome

A signed-in operator can move a shoot asset through this safe path:

```text
operator selects file
→ server authorizes org/shoot context
→ signed Cloudinary upload
→ Cloudinary stores media
→ verified webhook
→ Supabase records business metadata
→ operator reviews
→ human approval
→ approved private delivery
```

## Ownership boundary

| System | Owns | Must not own |
|---|---|---|
| Cloudinary | Media bytes, transforms, CDN delivery, provider asset/version identifiers | Tenant membership, shoot ownership, approval truth |
| Supabase + RLS | Org/brand/shoot relationships, asset workflow state, approvals, audit | Image/video bytes |
| Next.js | Authenticated signing, webhook handling, server-side delivery authorization | A second media database |
| CopilotKit / Mastra | Read/search/propose workflows when useful | Silent upload/delete/publish or tenant bypass |

## Required rules

- Upload credentials and API secrets never reach the browser.
- Prefer official Cloudinary SDKs/components/examples before custom upload or URL logic.
- The server validates trusted organization/shoot context before granting upload or delivery access.
- Webhook authenticity is verified before business state is persisted.
- Approval is tied to the correct durable asset/version; a newer version is not silently inherited as approved.
- Private operator media is not treated like public marketing media.
- Cloudinary Search / Asset Management is not the iPix business database.
- Destructive media actions and publishing remain human-controlled where approval is consequential.

## MVP acceptance

- Signed upload path works for an authenticated operator.
- Webhook verification rejects invalid provider events.
- A successful upload is represented in Supabase under the correct organization.
- Org B cannot load Org A private media through the iPix application.
- Review/approval state is durable and auditable.
- Approved delivery uses the intended server-controlled delivery policy.
- Failure paths do not mark incomplete media as ready.
- Targeted tests and one authenticated end-to-end journey prove the flow.

## Reuse order

```text
existing iPix implementation
→ Cloudinary dashboard / CLI / MCP
→ official Node SDK
→ next-cloudinary
→ official maintained examples
→ smallest remaining custom adapter
```

## References

- [Official Cloudinary repositories and examples](./official-repos.md)
- [Master product requirements](../prd.md)
- [Product roadmap](../roadmap.md)
- [Documentation inventory](../index-docs.md)
