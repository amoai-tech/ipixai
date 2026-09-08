# REVIEW.md

Short briefing for AI and human reviewers. It does **not** replace the source of truth.

## Source of truth

If this file disagrees with another doc, follow the other doc:

| Topic | Authority |
|---|---|
| Agent behavior, verify-before-Done, security | [`AGENTS.md`](AGENTS.md) |
| Human PR / local-dev steps | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Combined `npm run dev` / scripts | [`README.md`](README.md) (**DEV-STAB-001**) |

Keep this file a calibration sheet: severity and what to check. Do not copy full rules here.

## What matters in this repository

- Tenant isolation when auth or tenant data is in scope: queries, CopilotKit threads, and Mastra memory keys stay org-scoped. Org B must never read Org A. The starter `resourceId: "default"` is allowed until auth exists — do not flag that as a Critical leak.
- Treat auth, JWT/RPC writes, deletion, and anything that talks to production Supabase as high-risk.
- Smallest explicit fix. PR/commit rules and “do not copy old iPix Mastra wholesale” live in `CONTRIBUTING.md` / `AGENTS.md`.
- Canonical full Linear task references use `IPI-NNN · TASK-ID — Full Task Name`, where `TASK-ID` is the actual identifier such as `BRAND-001` or `MIGRATE-TEMPLATE`; do not require the literal word `SPEC`.

## Severity calibration

- Critical: tenant leak (when tenant data is in scope), privilege escalation, token/key exposure, production database writes, data loss.
- Warning: missing validation, unsafe defaults, tools that write domain data without SECURITY DEFINER + user JWT, untested edge cases.
- Do not flag formatting-only differences when tooling already enforces them.
- Combined `npm run dev` is disabled until **DEV-STAB-001** is fixed (watcher/fork storm). Do not treat the current block as a regression. Do not treat a PR that *re-enables* combined `dev` as “ignore” — that needs its own review.

## Verification expectations

- New business rules need tests that assert the observable result (deny Org B, fail closed when unsigned).
- Database changes need migration coverage and rollback-aware review. Never `supabase db push` to production in a review “fix.”
- UI / chat changes should preserve keyboard and screen reader behavior, and keep history after refresh when that is the contract.
- Do not call work Done, complete, or production-ready unless **every applicable** [`AGENTS.md`](AGENTS.md) check has evidence. Those checks are cumulative, not alternatives: targeted tests when they exist for the path, `npx tsc --noEmit`, `npm run build` when ports 3000 and 4111 are free (required before merge), plus browser/runtime and Org A vs Org B when those claims are in scope. Merge is not Done.
