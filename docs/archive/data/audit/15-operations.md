# 15 — Operations (CRM, chatbot, notifications)

Status: Complete
Score: 72/100
Verification confidence: 86/100
Tables inspected: crm_* , chatbot_* , lead_intake_drafts, notifications*
Code paths inspected: none
Live queries: counts; no-policy list; advisors
Official references: linter 0008 rls_enabled_no_policy

## Verdict

CRM is **lightly used** (companies 4, contacts 8, deals 5, activities 11) with convert RPC. Chatbot tables have rows but **JWT fail-closed** (no policies) — advisors INFO are **expected**. Leads 10. Notifications 5 + reads 5. **Resolve warnings:** do **not** add JWT SELECT to chatbot; keep service-role. Document as accepted INFO (**IPI-664/872**).

## Current state

| Table | Rows | RLS policies |
| --- | ---: | --- |
| crm_* | 4/8/5/11 | present |
| chatbot_* | 7/8/8 | **none** (fail-closed) |
| lead_intake_drafts | 10 | present |
| processed_firecrawl_webhooks | 7 | none |
| media_size_specs | 0 | none (deprecated) |
| notifications | 5 | present |

`capture-lead` JWT off (public). `claim_lead_draft` DEFINER for authenticated.

## What is correct

- Fail-closed chatbot matches comments.
- CRM terminal stage guarded by trigger/RPC (comment on crm_deals).

## Errors / red flags

| Pri | Finding |
| --- | --- |
| P2 | Advisor noise if INFO treated as must-fix |
| P2 | capture-lead JWT off — must stay HMAC/rate-limited in function (16) |

## Fixes

- Keep no-policy; optionally dashboard “accepted” note.
- Do not enable anon table grants.

## Faster/better approach

Advisor + comments on tables.

## Production blockers

None if fail-closed is intentional. Misleading lints are a **process** issue.

## Existing Linear ownership

**IPI-367** CRM convert, **IPI-664/685/872**, **IPI-692** webhooks.

## Verification / success criteria

- [x] Warnings mapped to intent
- [ ] capture-lead abuse test (**not run**)

## ERD / data flow where useful

```text
Public chatbot → capture-lead (service) → chatbot_* + lead_intake_drafts
JWT → claim_lead_draft → owner
CRM deals → convert RPC only for won/lost
```

## Next step

**16 — Edge Functions**
