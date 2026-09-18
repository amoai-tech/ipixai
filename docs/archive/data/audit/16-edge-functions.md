# 16 — Edge Functions

Status: Complete (platform inventory; source bodies **not** opened — functions live on hosted project, not fully vendored in this repo)
Score: 68/100
Verification confidence: 72/100
Tables inspected: n/a (functions)
Code paths inspected: none in `supabase/functions` of **this** repo (single migration file only)
Live queries: `list_edge_functions`
Official references: [Edge Functions](https://supabase.com/docs/guides/functions)

## Verdict

**Seven ACTIVE** functions. JWT off: `health`, `capture-lead`, `firecrawl-webhook`. JWT on: `edge-test`, `brand-intelligence`, `audit-asset-dna`, `start-brand-crawl`. Skill inventory claiming `cloudinary-sign` / `register-asset` is **stale**. Bodies, HMAC, idempotency, org checks: **UNVERIFIED** without fetching function source.

## Current state

| Function | JWT | Likely purpose | Likely tables | Caller (assumed) | Orphaned? |
| --- | --- | --- | --- | --- | --- |
| health | off | liveness | none | probes | active |
| edge-test | on | Gemini smoke | none | ops | active |
| brand-intelligence | on | URL → profile | brands / drafts? | operator | active |
| audit-asset-dna | on | image DNA | assets | operator | active |
| capture-lead | off | public chatbot | chatbot_*, lead_intake_drafts | marketing | active |
| start-brand-crawl | on | Firecrawl job | brand_crawls | operator | active |
| firecrawl-webhook | off | signed webhook | crawl results, processed_* | Firecrawl | active |

Secrets: **not listed** (would leak). Service role: typical for webhook/lead — **assumed**, not dumped.

## What is correct

- No Medellín leftover slugs in this list.
- JWT off only on public/webhook/health.

## Errors / red flags

| Pri | Finding |
| --- | --- |
| P1 | Function source not in ipixai tree — drift vs dashboard |
| P1 | capture-lead + firecrawl-webhook JWT off — auth must be non-JWT (HMAC/secret) |
| P2 | Missing Cloudinary sign function on project |

## Fixes

- Vendor or pin function SHAs in a named task (not this audit’s writes).
- Confirm HMAC on webhook/lead without printing secrets.

## Faster/better approach

MCP list vs cloning Deno sources.

## Production blockers

Public functions without verified HMAC are a **security** blocker for those two slugs. Health JWT off is fine.

## Existing Linear ownership

WEB-015 capture-lead, IPI-24 crawl, DNA audit tickets.

## Verification / success criteria

- [x] 7 ACTIVE listed
- [ ] Invoke with/without JWT; HMAC negative tests

## ERD / data flow where useful

```text
Browser JWT → brand-intelligence / start-brand-crawl / audit-asset-dna
Anonymous → capture-lead
Firecrawl → firecrawl-webhook
Mastra agents → NOT these edges (Gateway path)
```

## Next step

**17 — Frontend/backend wiring**
