# 20 — Production readiness

Status: Complete (synthesis of 01–19; hosted journeys not browser-proven)
Score: 63/100 overall
Verification confidence: 78/100
Tables inspected: 191 table-like objects (via 01)
Code paths inspected: CopilotKit + Mastra store + AUTH-002
Live queries: MCP inventory, advisors, identity RLS, shoot/mastra grants
Official references: as cited in prior steps

## Verdict

The **database is a large, RLS-on, multi-product ledger**. The **ipixai app is a thin authenticated CopilotKit/Mastra client**. Together they are **not** a finished fashion OS. Core chat can become production **with conditions**: hosted persist, Org B deny, HIBP, planner grants, no secret leaks.

**Will this architecture succeed?** **Yes with conditions** — confidence **72/100**.

## Current state

Rolling scores from steps 01–19 (audit quality, not “feature done”):

| Area | /100 |
| --- | ---: |
| Architecture | 70 |
| Schema | 78 |
| Relationships | 71 |
| RLS | 74 |
| Auth | 78 |
| Tenant isolation | 62 |
| Functions/RPCs | 70 |
| Indexes | 68 |
| Mastra | 72 |
| Planner | 76 |
| Brand | 64 |
| Campaign | 73 |
| Shoot | 69 |
| Talent | 70 |
| Assets | 77 |
| Frontend/backend wiring | 60 |
| Migration safety | 62 |
| Testing | 55 |
| Production verification | 40 |

Overall **63/100** (mean of the 20 rows, production verification pulling down).

## What is correct

- Shared project `nvdlhrodvevgwdsneplk` is the approved Mastra cabinet.
- RLS on 145/145; mastra hidden from JWT schema.
- Shoot JWT SELECT-only; Cloudinary bytes; membership-only org.
- Hosted store refuses LibSQL and wrong project.

## Errors / red flags

See Critical errors table.

## Fixes

Now → Next → Later below.

## Faster/better approach

One live inventory + advisors + occupancy + thin-repo grep beat 191 policy dumps.

## Production blockers

Listed as P0/P1 in the table. No P0 “RLS off.” P1 hosted proofs and dual SoT/process.

## Existing Linear ownership

Mapped per row. **0 new issues minted.**

## Verification / success criteria

- [ ] Hosted recycle same thread (**IPI-1124**)
- [ ] Org B 403 (**IPI-1125**, PR #23)
- [ ] HIBP on (**IPI-863**)
- [ ] IPI-897 live
- [ ] Shoot reject = 0 writes
- [ ] Brand approve → scores

### Critical errors

| Priority | Finding | Failure mode | Fix | Existing Linear owner | Verification |
| --- | --- | --- | --- | --- | --- |
| P1 | Hosted persist unproven | Operator refresh loses chat | Recycle proof, pooler 6543 first | **IPI-1124**, **IPI-1042** | Insert → recycle → read |
| P1 | Org B deny unproven / ACL on PR #23 | Cross-tenant thread | Merge ACCESS ACL; QA orgs | PR #23, **IPI-1125** | 403 `thread_forbidden` |
| P1 | Dual `public.shoots` vs `shoot.shoots` | Wrong ledger | Freeze public; code uses shoot schema | **IPI-1067** | Grep + row owners |
| P1 | 309 vs 1 migration files | Accidental push/divergence | IPI-1040 runbook only | **IPI-1040** | Never db push from audit |
| P1 | HIBP off | Weak passwords | Dashboard enable | **IPI-863** | Advisor clear |
| P1 | JWT-off lead/webhook HMAC unproven | Public write abuse | Confirm HMAC in function source | IPI-685 / IPI-692 | Negative invoke |
| P2 | Brand DNA/graph empty | “Brain” not real | Brand tickets | IPI-1093 / 1128 | scores > 0 |
| P2 | DEFINER EXECUTE surface | Mis-classified revoke or missed hole | Classify | **IPI-1039** | Per-RPC sheet |
| P2 | Planner grants pending 897 | Extra table access | Apply after review | **IPI-897** | Advisor + probe |
| P2 | This repo has no domain UI | Operators cannot run OS here | Port with tickets; don’t copy old tree | convert plan | Pages exist |

### Production checklist

- [ ] `MASTRA_DATABASE_URL` hosted fail-closed (code yes; **env on Vercel UNVERIFIED**)
- [ ] Restart persistence proven
- [ ] Org B cannot read Org A thread
- [ ] HIBP enabled
- [ ] IPI-897 applied or waived
- [ ] No service role in browser
- [ ] Shoot writes only via RPC; reject is dry
- [ ] Chatbot stays fail-closed
- [ ] No `db push` / `mastra migrate` to prod from Core
- [ ] Forward migrations only (**IPI-1040**)

### Is anything missing?

Evidence-backed only:

- Brand scores/graph/intake drafts **empty**
- Gate approvals **empty**
- Talent bookings **empty**
- Commerce/social **empty**
- Cloudinary sign **edge not deployed**
- Domain operator UI **absent from ipixai `src/`**
- Hosted Org B / recycle **not observed this audit**

### Will this architecture succeed?

**Yes with conditions.** Confidence **72/100**.

Conditions: prove persist + tenant deny; keep RLS/RPC pattern; do not rebuild 191 tables; port UI per ticket; leave FashionOS frozen.

### Fastest path to production

**Now:** IPI-1042 fingerprint → IPI-1009 stream/stop if open → **IPI-1124** recycle → **IPI-1125** QA orgs → merge **PR #23** → IPI-863 HIBP.

**Next:** IPI-897 live; IPI-1039 classify; IPI-1040 forward files; shoot reject QA.

**Later:** Brand DNA; talent bookings; publishing; FashionOS retirement; domain UI ports.

## ERD / data flow where useful

See 01 and 07.

## Next step

Execute **Now** list. Audit documents stay under `docs/data/audit/`. Do not mutate production from this work.
