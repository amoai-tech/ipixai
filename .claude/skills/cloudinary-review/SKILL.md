---
name: cloudinary-review
description: Review iPix Cloudinary upload, signing, webhook, transformation, and asset-mapping changes for security and media-integrity regressions.
metadata:
  owner: IPI-1246
  impact: HIGH
---

# iPix Cloudinary PR Review

Verify exact installed Cloudinary SDK behavior before API claims.

Material invariants:
- API secret never reaches browser/model/logs; client uploads use server-authorized signed parameters where required.
- Signature inputs, timestamp/expiry, folder/public_id ownership, transformations, and upload presets must not be caller-escalatable across tenants.
- Webhooks require provider authenticity verification before state changes and must tolerate replay/idempotent delivery.
- Supabase stores durable application metadata; Cloudinary owns media bytes. Mapping must not accept foreign asset IDs without authorization.
- Destructive media operations require server-side tenant authorization and deterministic proof.
- Transformation/delivery changes must not silently make private media public or bypass intended restrictions.

Require the cheapest decisive signature/webhook/tenant test; avoid generic media-style feedback.
