# Domain best-practice violation scan

Parent: [`../SKILL.md`](../SKILL.md). Load the owning domain skill first; this file is a verifier checklist, not a substitute for current domain guidance.

Only apply rows relevant to changed paths/ACs.

## Supabase / Postgres / Auth

Load [`../../ipix-supabase/SKILL.md`](../../ipix-supabase/SKILL.md) and its [`references/verification-matrix.md`](../../ipix-supabase/references/verification-matrix.md). This verifier checks **WHAT evidence exists**; `ipix-supabase` owns the SQL/catalog/testing HOW.

- RLS/authorization is server-side for every tenant-owned durable object, with intended allow **and deny** role/tenant cases.
- Grants and RLS are checked independently; function/RPC exposure is intentional and least-privilege.
- UPDATE ownership/reparenting considers both the existing row (`USING`) and resulting row (`WITH CHECK`), plus required SELECT visibility.
- Existing functions/triggers/policies/views are compared with their authoritative installed definitions before modification; no reconstruction from memory/task/reviewer prose.
- `SECURITY DEFINER` use is justified and proves safe search path, qualified object references, ACL intent, and tenant/self-authorization behavior.
- API-facing views either prove `security_invoker` behavior or are unexposed/revoked.
- Migrations fresh-replay from version-controlled history and account for existing rows, nullability, backfill order, locks, forward compatibility, and index/query impact.
- New/repeated write paths prove uniqueness/idempotency/concurrency safety where duplicate execution is possible.
- Service-role/admin credentials never enter client code or untrusted logs.
- Advisors are triaged as evidence; INFO/WARN findings are not blindly fixed or ignored.

## Next.js / UI

- Server/client boundaries match the current Next.js architecture; do not add `'use client'` without need.
- Authorization is not trusted from client state alone.
- Loading, empty, error, forbidden/not-found, retry, and pending/double-submit behavior exist when relevant.
- Back/refresh/navigation preserve or safely reconstruct required durable state.
- User-visible routes work on required desktop/mobile sizes and keyboard/focus behavior when UI changed.
- Mutations fail safely and surface actionable errors instead of silently swallowing partial failure.

## Mastra / CopilotKit / AG-UI

- Agent/tool authority is the minimum required; tools validate arguments and tenant context.
- Wrong agent/tool cannot perform a consequential write merely because the model requests it.
- HITL/interrupt/approval cannot be bypassed by retry, refresh, alternate tool path, or malformed arguments.
- Durable state is not written before required approval.
- Retries/resume/suspend do not duplicate side effects.
- Thread/memory/persistence ownership cannot cross tenants.
- Streaming/runtime errors produce a recoverable user-visible state where applicable.

## AI-native behavior

When behavior is nondeterministic, verify both positive and negative cases and use repeated trials when one run cannot establish reliability:
- should act / should not act
- should use tool / should not use tool
- correct tool / plausible wrong tool
- correct/invalid/malicious arguments
- approval granted / rejected / absent
- normal / ambiguous / adversarial prompt
- prompt-injection/system-prompt/sensitive-data extraction attempts where relevant
- hallucination/unsupported claim does not trigger a durable action

Explorbot may supplement exploratory browser discovery but is not a mandatory merge gate.

## Cloudinary / media

- Upload/signature/auth path cannot associate media with the wrong org/shoot/product.
- Media-success + DB-failure and DB-success + media-failure states reconcile safely.
- Webhook/callback replay is idempotent and authenticated where supported.
- Transformation/delivery failure has an operator-visible recovery path when business-critical.
- Secrets/signatures remain server-side; timestamps/nonces/validation follow current SDK/vendor contract.

## GitHub Actions / dependencies

- Changed workflows use least permissions and do not expose secrets to untrusted PR code.
- `pull_request_target` does not execute untrusted checkout/code with write tokens/secrets.
- Dependency changes are intentional; lockfile scope is explainable and compatible with installed runtime.
- Third-party actions/dependencies follow repository pinning/provenance policy.
- Caches/artifacts do not contain auth state/secrets.
- Required checks actually ran on the exact head; skipped/missing checks are not treated as pass.

## Operations / reliability

- External calls have defined timeout/error behavior where the user journey depends on them.
- Retry is safe/idempotent for any side effect.
- Partial failure leaves recoverable, explainable state.
- Logs/health/metrics expose failures without leaking secrets.
- Production-affecting changes define rollback/containment and the signal that triggers it.

## Finding rule

A best-practice violation is a blocker only when it creates a concrete correctness/security/data-loss/required-AC risk. Otherwise classify HIGH/MEDIUM/IMPROVEMENT with evidence. Do not fail tasks for ritual compliance alone.

## Agent prompt

```text
For each changed domain, load the current owning skill and use this checklist to search specifically for correctness, security, tenant, reliability, data-integrity, operational, performance, and maintainability violations. Apply only relevant rules. Tie every finding to a concrete failure mode or evidence gap; do not produce generic best-practice noise.
```
