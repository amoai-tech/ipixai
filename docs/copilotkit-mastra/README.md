# CopilotKit × Mastra

CopilotKit is the operator-facing AI interface. Mastra owns agents, tools, workflows, memory orchestration, and resumable AI execution.

**Code source of truth:** `src/app/api/copilotkit/[[...slug]]/route.ts`, `src/mastra/`, and `package.json`.

## Current runtime family

The one maintained version table is [Runtime compatibility family](../mastra/runtime-family.md).
It follows the exact `package.json` and `package-lock.json` pins. Do not copy
retired versions from historical conversion documents.

## Current contracts

- Next.js / Vercel is the application host.
- The server derives the trusted operator, organization, and memory scope.
- Memory resource IDs use `org:{orgId}::user:{userId}` in current code.
- The Production Planner runs Mastra in-process inside the authenticated Next.js route; its approved PostgreSQL storage is explicitly configured with `disableInit: true` and must fail closed if unavailable.
- Supabase/Postgres owns durable application truth; Mastra does not bypass tenant authorization.
- Consequential domain writes require human review/approval.

## Local Mastra Studio (developer-only)

- Run `npm run dev:agent` separately from `npm run dev:ui`. The CLI serves Studio on `http://127.0.0.1:4111`; the app's production Copilot uses the existing authenticated in-process Mastra runtime, not Studio.
- `src/mastra/runtime.ts` installs `localStudioAuth` **only** for `mastra dev` on `127.0.0.1`, with CLI-controlled development markers and hosted mode disabled. The normal `server.auth` allowlist stays unchanged in every environment.
- The Studio login screen needs a **fresh** user-scoped `Authorization: Bearer <Supabase access token>` header. Use a verified authenticated operator session; save the value in Studio's header form, never in source control, logs, screenshots or a shared documentation example. A token can expire; refresh the operator session instead of disabling authentication.
- Local Studio permits only the metadata GET routes listed in `src/mastra/server-auth.ts`. It does **not** authorize workflow execution, tool POSTs, arbitrary stored resources, or run-count/observability reads. A separate, scoped, audited development change is required before testing those through Studio.
- Do not expose Studio beyond loopback, add `studio.auth` to the hosted runtime, or copy the docs' demo auth provider. Missing `MASTRA_DATABASE_URL` uses **ephemeral in-memory storage in local dev only**, not durability proof. Keep real suspend/resume/persistence tests on the approved isolated testing path.
- Official references: [Studio overview](https://mastra.ai/docs/studio/overview), [Studio auth](https://mastra.ai/docs/studio/auth), and [Studio deployment](https://mastra.ai/docs/studio/deployment). Use the **pinned** Mastra family in [runtime compatibility](../mastra/runtime-family.md), not automatically the latest upstream release.

## Read next

- [Product requirements](../prd.md)
- [Runtime compatibility family](../mastra/runtime-family.md)
- [Postgres schema contract](../mastra/db-001-matrix.md)
- [CopilotKit GenUI foundation audit and corrected plan](09-copilotkit-audit-plan.md)
- [Documentation map](../docs-index.md)
- [Historical AI plans and audits](../archive/copilotkit-mastra/)

Dated conversion plans, repo research, tool surveys, and old runtime audits are preserved in `docs/archive/`; they are not current runtime authority.
