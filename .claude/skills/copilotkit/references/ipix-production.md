# iPix production CopilotKit — plain-language ops guide

**Status:** current iPix production/runtime operations reference. Re-verify live deployment and env names before acting.

## What this is

The operator app at **www.ipix.co/app** uses CopilotKit for the right-hand AI chat. In production, two things must be true:

1. **You are signed in** (Supabase session) — otherwise the runtime returns `401`.
2. **Vercel has `CPK_INTELLIGENCE_API_KEY`** (managed CopilotKit Intelligence project key) — otherwise chat falls back to the non-Intelligence SSE path and **Threads** aren't durable.

> **IPI-1191 · COPILOT-INTEL-001 correction (2026-09-11):** this doc previously said to set
> `COPILOTKIT_LICENSE_TOKEN` + `INTELLIGENCE_API_KEY` to unlock Threads — that's the old
> architecture and is what originally caused `Invalid CopilotKit license token` in production.
> `COPILOTKIT_LICENSE_TOKEN` is a **separate, offline/self-hosted-only** credential and is not
> set anywhere in iPix's managed dev/staging/prod. See
> `src/app/api/copilotkit/[[...slug]]/route.ts` and the README "CopilotKit Intelligence &
> Threads" section for the current contract.

## Smoke test (30 seconds)

1. Go to [https://www.ipix.co/login](https://www.ipix.co/login) → sign in with an authorized iPix operator account.
2. Open [https://www.ipix.co/app/shoots](https://www.ipix.co/app/shoots) (any `/app/*` route works).
3. Open DevTools → **Console** — expect **no** red errors mentioning `copilotkit` or `401`.
4. DevTools → **Network** → filter `copilotkit` → `info` request should be **200**.
5. Type “hello” in the AI sidebar → you should see a streamed reply.

**Pass without license:** steps 1–3 (page + no console noise).  
**Full pass:** steps 1–5 + Threads drawer not showing “licensed feature”.

## Vercel project

| Setting | Value |
|---------|--------|
| Project | Verify the currently aliased iPix production project in Vercel before changing settings |
| Repository root | `/home/sk/ipixai` |
| Runtime route | `src/app/api/copilotkit/[[...slug]]/route.ts` |

## Env vars (production)

| Variable | Required | What it does |
|----------|----------|--------------|
| `CPK_INTELLIGENCE_API_KEY` | For durable Threads | Managed CopilotKit Intelligence project key (`COPILOTKIT_API_KEY` is the accepted alias). Absent → falls back to non-Intelligence SSE mode, chat still works but Threads aren't durable. |
| `COPILOTKIT_LICENSE_TOKEN` | Not used in managed mode | Offline/self-hosted-only credential — do not set for iPix's managed deployments; a stale/wrong-format value here is what caused `Invalid CopilotKit license token`. |
| Model/provider credentials | As configured by current Planner/model task | Never infer the active provider from this runbook; verify current agent/model config |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Auth + edge function calls |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser Supabase client |

Sync from Infisical; never commit tokens. Local dev: `app/.env.local`.

## How auth + CopilotKit interact

```
Sign in → session cookie set
  → visit /app/shoots
  → src/app/app/layout.tsx runs requireAppWorkspace()
  → verified workspace/session allows the operator shell
  → PlannerApp mounts CopilotKit only after copilotHandshake(authState) allows it
  → signed-out/unverified state must not create unsigned /api/copilotkit/info noise
```

## Common errors

| Error | Meaning | Fix |
|-------|---------|-----|
| `401` on `/api/copilotkit/info` | No valid session | IPI-125 OAuth URLs |
| `/info` reports `mode: "sse"` when Intelligence expected | `CPK_INTELLIGENCE_API_KEY`/`COPILOTKIT_API_KEY` not set for this environment | Set `CPK_INTELLIGENCE_API_KEY` (Vercel + Infisical), do not set `COPILOTKIT_LICENSE_TOKEN` |
| `Invalid CopilotKit license token` banner | `COPILOTKIT_LICENSE_TOKEN` present with a garbage/wrong-format value (e.g. a `ck_pub_...` Cloud public key) | Remove `COPILOTKIT_LICENSE_TOKEN` — managed mode doesn't need it |
| Chat works locally, not prod | Env missing on Vercel | Redeploy after Infisical sync |

## Code pointers

- Runtime: `src/app/api/copilotkit/[[...slug]]/route.ts`
- Operator auth gate: `src/app/app/layout.tsx` → `requireAppWorkspace()`
- CopilotKit mount/provider: `src/app/planner-app.tsx`
- Mount decision: `src/lib/auth/copilot-mount.ts`
- Verified operator/resource identity: `src/lib/auth/verified-operator.ts`
- Example env: verify current root env documentation before changing variables

## Related issues

- [IPI-125](https://linear.app/amo100/issue/IPI-125) — OAuth (must be green before IPI-127)
- [IPI-48](https://linear.app/amo100/issue/IPI-48) — Mastra runtime foundation
