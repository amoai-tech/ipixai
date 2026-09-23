---
title: Cloudinary operations and production safety
status: Current runbook
parent: docs/cloudinary/prd.md
---

# Cloudinary operations

## Purpose

Operate the iPix media pipeline safely in preview and production. This document owns webhook behavior, delivery/access policy, retries, recovery, rollout, rollback, and production certification.

## Operating rule

```text
AI/operator proposes configuration change
→ human reviews
→ capture current provider state
→ make one bounded change
→ smoke test
→ read back durable result
→ rollback immediately if a gate fails
```

Cloudinary owns provider/media state. Supabase owns tenant/business state. Production provider configuration must never be mutated silently by an agent.

## Production configuration to verify

Before any release or cutover, read the live environment and record:

- upload preset used by iPix;
- delivery type and overwrite policy;
- named transforms required by current UI;
- notification/webhook endpoints and event types;
- webhook authentication scheme;
- preset-level `notification_url` values;
- backup/version settings;
- relevant account/plan limits.
## Webhook contract

```text
Cloudinary event
→ read raw request body
→ verify provider signature/timestamp
→ normalize event
→ apply idempotently in one durable Supabase transaction
→ return 2xx only after durable commit
```

| Result | Response principle |
|---|---|
| Invalid/spoofed/stale signature | reject; never persist |
| Valid event + durable commit | 2xx |
| Valid event + temporary DB failure | retryable server error |
| Duplicate event | idempotent success; no duplicate mutation |

The provider event may identify an asset/version; it does **not** establish iPix organization membership or business authorization.

## Delivery and access

- Authorize the user/org against Supabase before minting a protected delivery URL.
- Bind approval to the exact provider asset/version used for delivery.
- Never fall back to a public URL when protected delivery fails.
- Reuse provider-native named/eager transforms; do not build a transformation engine in iPix.
- A newly uploaded version does not inherit approval from an older version.

## Failure and recovery

| Failure | Required behavior |
|---|---|
| Upload fails | no Ready state; operator can retry |
| Provider upload succeeds but webhook persistence fails | remain Processing; retry/reconcile; never fake Ready from widget callback |
| Duplicate webhook | no duplicate business mutation |
| Transform missing | visible failure; no unsigned fallback |
| Supabase unavailable | provider event remains retryable; fail closed |
| Provider unavailable | upload/delivery fails closed; preserve existing business state |
| Approved provider asset missing/deleted | delivery fails; reconcile and surface incident |
| Analysis/add-on unavailable | deterministic/manual path remains usable |
## Rollout / cutover

Production notification changes are a release operation, not a feature toggle hidden inside a normal PR.

```text
1. Capture current trigger + preset notification configuration
2. Verify preview sign/webhook/delivery journey
3. Verify tenant-isolation and idempotency tests
4. Verify reconcile/drift report
5. Choose a quiet change window and named rollback owner
6. Make one provider configuration change
7. Run disposable upload + delete smoke
8. Observe logs and durable Supabase state
9. Roll back immediately if gates fail
```

Avoid an accidental V1+V2 dual-write window. If overlap is ever required, design and prove idempotency explicitly first.

## Rollback

Rollback must restore **all** provider notification paths changed during cutover, including preset-level notification configuration where applicable.

Record before mutation:

- previous URL(s);
- event/filter configuration;
- auth scheme;
- preset notification settings;
- actor and timestamp.

A rollback is complete only after provider configuration is read back and a disposable smoke proves the restored path.

## Production smoke test

Use disposable media only:

```text
authenticated operator
→ signed upload
→ verified webhook
→ correct org/brand/shoot Supabase row
→ protected preview
→ delete/reconcile cleanup
```

Never use customer production media as a certification fixture.
## Verification gates

Before calling a media release production-ready:

- signed upload works for the intended operator role;
- invalid webhook signatures are rejected;
- duplicate events are idempotent;
- Org B cannot obtain Org A protected media;
- exact-version approval is enforced;
- provider configuration is read back after change;
- rollback steps are tested on preview/staging-equivalent state;
- targeted tests, typecheck/build where relevant, and one authenticated end-to-end journey pass;
- logs distinguish authorization failures from persistence failures;
- failure paths never silently mark incomplete media Ready.

## Re-verification triggers

Re-run the contract/operations audit when any of these change:

- `cloudinary` or `next-cloudinary` package family;
- upload preset or context schema;
- named transformations;
- delivery type/access policy;
- webhook auth scheme or notification endpoint;
- asset/version identity model;
- Supabase media tables/RLS/RPCs;
- production hosting/runtime boundary.

## Official references

- Notifications: https://cloudinary.com/documentation/notifications
- Notification signatures: https://cloudinary.com/documentation/notification_signatures
- Access-controlled media: https://cloudinary.com/documentation/control_access_to_media
- Delivery URL signatures: https://cloudinary.com/documentation/delivery_url_signatures
- Backups/version management: https://cloudinary.com/documentation/backups_and_version_management
- MCP/environment tooling: https://github.com/cloudinary/mcp-servers

## Historical evidence

The corrected 2026-09-02 environment/security audit remains at [`https://github.com/amoai-tech/ipixai/blob/main/docs/archive/cloudinary/audit-2026-09-02.md`](https://github.com/amoai-tech/ipixai/blob/main/docs/archive/cloudinary/audit-2026-09-02.md). Treat captured endpoints, plan limits, counts, and provider state in that audit as historical until re-verified live.
