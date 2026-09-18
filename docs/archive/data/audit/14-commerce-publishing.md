# 14 — Commerce + publishing

Status: Complete
Score: 55/100
Verification confidence: 88/100
Tables inspected: shopify_*, amazon_*, instagram_*, facebook_*, commerce_product_links
Code paths inspected: none
Live queries: all those tables **0 rows**
Official references: Mercur is commerce SoT per skill (not in this DB)

## Verdict

Supabase holds **empty OAuth/product-link shells**. External SoT is **not** this database (Shopify/Amazon/social APIs; Mercur for catalog per iPix policy). **No live publishing, no stored tokens in row counts** (0). Token security of empty tables is RLS-on; **token-at-rest** not inspected (would be secrets — skipped).

## Current state

All commerce/social connection and post tables: **0**. `commerce_product_links` 0. `platforms` 7 / `image_specs` 9 / `recommendation_rules` 9 are **spec catalogs**, not live shop data.

## What is correct

- Did not duplicate Mercur product/order tables.
- Spec tables exist for deliverable sizes.

## Errors / red flags

| Pri | Finding |
| --- | --- |
| P2 | Publishing approval workflow **not evidenced** (no posts) |
| P3 | OAuth tables exist — future token leakage surface when filled |

## Fixes

- Treat as Later. Do not build a second catalog.

## Faster/better approach

Zero-row proof.

## Production blockers

Not required for Core planner chat. Publishing is **not production-live** here.

## Existing Linear ownership

Historical create_*_shopify migrations; no new mint.

## Verification / success criteria

- [x] Empty integration tables
- [ ] Token encryption at rest — **not inspected** (secrets)

## ERD / data flow where useful

```text
External shop/social  ← SoT
Supabase *_connections  ← empty links
```

## Next step

**15 — CRM + chatbot + notifications**
