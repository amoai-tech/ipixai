---
title: Cloudinary reuse plan
status: Current reference
parent: docs/cloudinary/prd.md
---

# Cloudinary reuse plan

## Purpose

Use proven Cloudinary capabilities before writing iPix-specific media infrastructure. This document answers: **what exists, what iPix reuses, what must stay custom, and what must not be copied.**

## Reuse order

```text
existing iPix implementation
→ installed package source/types
→ Cloudinary SDK / Next Cloudinary
→ Cloudinary CLI / MCP
→ official maintained examples
→ smallest iPix adapter
→ custom implementation only for the remaining domain gap
```

## Exact reuse matrix

| Capability | iPix current state | Source | Reuse | Do not copy | Verification |
|---|---|---|---|---|---|
| Signed upload | `src/app/api/cloudinary/sign/route.ts` | Next Cloudinary + official signed upload example | Widget/signature request shape | Demo auth or caller-trusted org | targeted integration test |
| Signing | Next.js server boundary | `cloudinary_npm` | `api_sign_request` | Custom crypto | unit + negative auth test |
| Webhook | `src/app/api/cloudinary/webhook/route.ts` | Cloudinary notification signatures | Official signature verification | Provider event as tenant authority | invalid-signature + retry test |
| Private delivery | authenticated media | access-control + delivery-signature docs | Signed exact-version delivery | Public URL shortcuts | cross-org negative test |
| Transformations | named `t_asset-*` contract | Cloudinary transforms/eager processing | Provider-native derivatives | Custom transform engine | exact-version preview test |
| Metadata | context today | structured metadata | Typed media attributes where useful | Duplicate Supabase business truth | schema/ownership review |
| Search | Supabase owns library truth | Asset Management/Search | Ops/reconcile or optional ranking | Cloudinary as tenant/business DB | org-scoped result proof |
| Analysis | later/optional | Analyze / AI capabilities | QA/tagging enrichment candidate | Critical-path dependency without fallback | spike + human review |
| Environment | configured Cloudinary | CLI / MCP | Inspect presets, transforms, assets | Autonomous production mutation | human-reviewed drift check |
## Official repositories

| Priority | Source | iPix use |
|---:|---|---|
| 1 | https://github.com/cloudinary/cloudinary_npm | Node SDK signing, verification, upload, delivery URL primitives |
| 2 | https://github.com/cloudinary-community/next-cloudinary | `CldUploadWidget` / Next.js integration patterns |
| 3 | https://github.com/cloudinary-community/cloudinary-examples | Runnable signed-upload and Route Handler examples |
| 4 | https://github.com/cloudinary/cloudinary-cli | Inspect/configure Cloudinary without new scripts |
| 5 | https://github.com/cloudinary/mcp-servers | Agent-accessible asset/environment inspection |
| 6 | https://github.com/cloudinary/asset-management-js | Administrative asset operations and reconcile patterns |
| 7 | https://github.com/cloudinary/api-schemas | Provider API contract reference |
| 8 | https://github.com/cloudinary/structured-metadata-mcp | Structured-metadata patterns if/when adopted |
| 9 | https://github.com/cloudinary-devs/product-launch-agent-single-tool | Later pattern for finding launch assets; never copy tenant/auth assumptions |
| 10 | https://github.com/cloudinary-devs/product-launch-agent | Later campaign-agent pattern; adapt only after approved media reuse is proven |

## P0 official documentation

### Security and delivery

- Access-controlled media: https://cloudinary.com/documentation/control_access_to_media
- Notification/webhook signatures: https://cloudinary.com/documentation/notification_signatures
- Notifications and retries: https://cloudinary.com/documentation/notifications
- Delivery URL signatures: https://cloudinary.com/documentation/delivery_url_signatures
- Backups/version management: https://cloudinary.com/documentation/backups_and_version_management

### Upload and transformations

- Upload Widget: https://cloudinary.com/documentation/upload_widget
- Image Upload API: https://cloudinary.com/documentation/image_upload_api_reference
- Eager/incoming transforms: https://cloudinary.com/documentation/eager_and_incoming_transformations
- Named transformations: https://cloudinary.com/documentation/named_transformations

### Metadata, search, and AI

- Structured metadata: https://cloudinary.com/documentation/structured_metadata
- Asset management: https://cloudinary.com/documentation/asset_management
- Analyze API guide: https://cloudinary.com/documentation/analyze_api_guide
- Analyze API reference: https://cloudinary.com/documentation/analyze_api_reference
## Real iPix adaptations

### Signed upload

```text
CldUploadWidget
+ existing iPix session/org authorization
+ trusted shoot/brand lookup
+ CONTRACT-1110-1112 preset/context rules
→ signed authenticated upload
```

Do not build a custom multipart uploader unless the official widget demonstrably cannot satisfy the operator journey.

### Structured metadata

Use Cloudinary metadata only for **media-native attributes** such as orientation, technical classification, derivative class, provider tags, or optional AI labels.

Keep **business truth** in Supabase: organization, brand, shoot, campaign, approval, workflow state, actor, and audit trail.

### Analysis / AI

Treat Analyze/AI capabilities as optional enrichment. Before implementation, re-verify current product status, plan entitlement, pricing, and API stability.

```text
uploaded fashion image
→ optional provider analysis
→ candidate garment/scene/QA attributes
→ Mastra combines with approved Brand Brain when useful
→ operator reviews
→ no automatic approval/publishing
```

### Cloudinary MCP / CLI

Use for developer and operations inspection:

```text
inspect presets / transforms / asset metadata
→ detect drift
→ report proposed correction
→ human approves consequential configuration change
```

Do not make production configuration mutation an autonomous agent action.

## Related iPix docs

- [Cloudinary media requirements](./prd.md)
- [Core PRD](./cloudinary-core-prd.md)
- [MVP PRD](./cloudinary-mvp-prd.md)
- [Advanced PRD](./cloudinary-advanced-prd.md)
- [Operations](./operations.md)
- [Locked provider contract](./CONTRACT-1110-1112.lock.md)
- [Master product requirements](../PRD.md)

Live task state remains in [Linear](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues).
