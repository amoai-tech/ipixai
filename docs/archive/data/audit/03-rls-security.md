# 03 — RLS + database security

Status: Complete (read-only, 2026-09-01)
Score: 74/100
Verification confidence: 86/100
Tables inspected: all 145 app tables (RLS on/off + no-policy); policy command coverage for `shoot.*` and `mastra.*`; identity policies in 02
Code paths inspected: none beyond 02 CopilotKit JWT
Live queries: `relrowsecurity`, no-policy list, `nspacl`, `get_advisors` security
Official references: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database Linter](https://supabase.com/docs/guides/database/database-linter)

## Verdict

RLS is **enabled everywhere** that matters. The five no-policy tables are **intentional fail-closed** (or deprecated). `shoot.*` is **SELECT-only** for JWT — writes must go through DEFINER RPCs (correct pattern if grants match). `mastra` schema is **not** on `authenticated` USAGE (runtime role only). Residual risk is **34 advisor WARNs** that authenticated can EXECUTE DEFINER functions (the product RPC surface) plus **HIBP off**. Do not mass-revoke.

## Current state

### Batches

| Batch | RLS | Policies | Org predicate | Notes |
| --- | --- | --- | --- | --- |
| Identity | on | 4+4+3 | `is_org_*` / own profile | See 02 |
| Chatbot / webhook / deprecated spec | on | **0** | N/A | Fail-closed JWT |
| Brand / CRM / campaigns / assets | on | many | typically org/brand | Not every USING re-read in this step |
| `planner.*` | on | 38 | via instance/workflow `org_id` | Child tables lack `org_id` column — join parent |
| `shoot.*` | on | 8 (1 each) | via `brands` (`shoot.shoots.brand_id`) | **SELECT only** |
| `talent.*` | on | 26 | `owner_org_id` on shortlists | Bookings 0 rows |
| `mastra.*` | on | 34 ALL | no org FK | Schema USAGE: `postgres` + `hyperdrive_mastra_runtime` only |

### Grants / exposed schemas

- `public`: USAGE to anon, authenticated, service_role, `hyperdrive_mastra_runtime` (typical Supabase + extra runtime).
- `planner` / `shoot` / `talent`: USAGE authenticated + service_role.
- `mastra`: **no authenticated USAGE**.
- `graphql_public`: still USAGE anon/authenticated; pg_graphql extension dropped (migration `ipi680`).

### SECURITY DEFINER

public 48 + planner 11 + talent 1 DEFINER functions. Advisors: 34 `authenticated_security_definer_function_executable` WARNs — includes org helpers and planner/booking/CRM RPCs. **Expected until IPI-1039 classifies each.**

### Advisors (security)

43 lints, **0 ERROR**: 5 no-policy INFO, 3 extension-in-public WARN, 1 HIBP WARN, 34 DEFINER EXECUTE WARN.

## What is correct

- Zero RLS-off tables in app schemas.
- Fail-closed chatbot/webhook (JWT cannot SELECT).
- Shoot JWT cannot INSERT/UPDATE/DELETE directly.
- Mastra hidden from PostgREST JWT schema list.

## Errors / red flags

| Pri | Finding |
| --- | --- |
| P1 | HIBP leaked-password protection **off** |
| P1 | DEFINER RPC surface is large; a single missing `auth.uid()` check is a tenant bug — classify, don’t revoke blindly |
| P2 | 124 performance `auth_rls_initplan` WARNs (mostly FashionOS) — wrap `auth.uid()` |
| P2 | `public` still granted to `anon` at schema level — table grants must stay tight (**IPI-896** family) |
| P3 | vector/pg_trgm/btree_gist in `public` |

## Fixes

- Enable HIBP in Auth dashboard (**IPI-863**).
- Per-RPC review (**IPI-1039**).
- Planner default privileges forward file (**IPI-897**) not live yet.

## Faster/better approach

Advisors + RLS-on query + policy command aggregation beat opening 285 public policies. Per-table USING for Brand/CRM deferred to domain steps 08–15.

## Production blockers

JWT shoot writes without RPC would fail (good). Production Auth without HIBP is a **policy** blocker, not a schema hole. Tenant isolation still needs hosted Org B proof.

## Existing Linear ownership

**IPI-863**, **IPI-897**, **IPI-1039**, **IPI-664/872** chatbot grants, **IPI-680** graphql.

## Verification / success criteria

- [x] RLS on 145/145
- [x] Advisors pulled
- [ ] `verify-rls` suite in this repo (script may live only in old operator repo — **NOT VERIFIED** here)

## ERD / data flow where useful

```text
JWT authenticated
  → public/planner/shoot/talent USAGE
  → shoot.* SELECT only → writes via DEFINER RPC
  → mastra: no USAGE → Node PostgresStore role only
```

## Next step

**04 — Relationships + schema integrity**
