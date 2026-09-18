# 04 — Findings, architecture, stages

## Target architecture (official)

```text
User
  → Cloudflare DNS + CDN + WAF          # KEEP from day one
    → Node Next.js (Vercel or local)    # CORE
      → CopilotKit
        → Mastra (in-process)
          → Postgres (Supabase mastra schema, preview first)
          → OpenAI (direct)

MVP later:
  same app → OpenNext Worker `ipix-preview`
    → optional AI Gateway `ipix-prod` → OpenAI
    → Hyperdrive only if Worker+PG latency/pooling is proven
```

This matches Cloudflare’s current Next.js guidance ([OpenNext on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)) and AI Gateway’s OpenAI-compatible URLs ([chat completions](https://developers.cloudflare.com/ai-gateway/usage/chat-completion/), [REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/)). Hyperdrive is the right **Workers→Postgres** pooler ([how it works](https://developers.cloudflare.com/hyperdrive/concepts/how-hyperdrive-works/)); it is the wrong **first** persistence path.

---

## Findings (full)

### CF-01 — Production Worker storage is noop (P1)

**Problem:** Live `ipix-operator` `MASTRA_STORAGE_MODE=noop`. Git Wrangler production says `pg`.  
**Evidence:** Worker settings GET 2026-08-24; `app/wrangler.jsonc` env.production; `app/open-next.config.ts` build `noop`.  
**Why it matters:** Refresh/restart cannot restore planner threads on the Worker. Same class of bug as a shoot call sheet that only exists in the photographer’s head.  
**Fix:** New runtime never has a noop mode. Old Worker left as-is.  
**Risk:** Low if we do not “fix” production Worker in this rebuild.  
**Effort:** None for Core.  
**Faster option:** Ignore old Worker; Node + preview DB.

### CF-02 — Service role on Workers (P1)

**Problem:** `SUPABASE_SERVICE_ROLE_KEY` bound on operator prod + preview.  
**Evidence:** secrets list (names only).  
**Why:** A Worker RCE or log leak bypasses RLS.  
**Fix:** User JWT + RLS; service role only in trusted Edge/admin.  
**Risk:** High if copied.  
**Effort:** S on new app.  
**Faster:** Never add the secret to the new Worker.

### CF-03 — Gemini-shaped preview vs OpenAI Core (P1)

**Problem:** Preview `AI_PROVIDER=gemini`; production has Gemini/Groq, no OpenAI secret.  
**Evidence:** plaintext + secrets lists.  
**Fix:** `OPENAI_API_KEY` only on Core.  
**Effort:** S.

### CF-04 — Two “gateways” (P2)

**Problem:** Native `ipix-prod` vs custom Worker `ai-gateway` (no OpenAI).  
**Evidence:** AI Gateway API; `services/cloudflare-worker/src/router.ts`; live Llama override.  
**Fix:** Native Gateway for OpenAI; retire Worker in Post-MVP.  
**Faster:** Skip Worker; hit OpenAI then `gateway.ai.cloudflare.com/.../ipix-prod/openai`.

### CF-05 — Apex is Vercel, not Workers (P2)

**Problem:** Easy to “attach Worker to ipix.co” and take down the live site.  
**Evidence:** DNS A/CNAME to Vercel; empty Worker routes.  
**Fix:** New hostnames only (`preview.ipix.co`, then `app.`).  
**Effort:** S (discipline).

### CF-06 — R2 disabled (P2 / not a Core blocker)

API 10042. Enable when DAM/cache needs it. Cloudinary already exists.

### CF-07 — Probe Workers (P3)

Public workers.dev + Hyperdrive to prod Postgres. Delete after notes. Effort S.

### CF-08 — Preview secret sprawl (P2)

OpenAI + Gemini + Groq + Nvidia + routing + service role. New Infisical env should be minimal.

### CF-09 — `origin_connection_limit=5` (P3)

Fine for probes; too small for a busy Worker+Mastra world. Revisit only if Hyperdrive is adopted.

---

## New Wrangler sketch (MVP, not Core)

```jsonc
{
  "name": "ipix-preview",
  "compatibility_date": "2026-08-24",
  "compatibility_flags": ["nodejs_compat", "enable_request_signal"],
  "main": ".open-next/worker.js",
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "observability": { "enabled": true, "head_sampling_rate": 1 },
  "workers_dev": true
}
```

No Hyperdrive, no `AI` binding, no service binding to `ai-gateway`, no noop var.

Rollback: previous Worker version in dashboard (operator already uses versioned deploys) **plus** DNS still on Vercel until cutover.

---

## Observability

Keep Workers Logs (already on for operator). Native Gateway logs already collecting (69). Add Sentry in the Node app (existing product). Do not build a custom log Worker.

---

## Better / faster / safer (efficiency)

| Temptation | Better |
| ---------- | ------ |
| Fork `ipix-operator` Wrangler | New file, ~15 lines |
| “Enable Hyperdrive so Mastra works” | Node `MASTRA_DATABASE_URL` first |
| Custom OpenAI in `ai-gateway` Worker | Native Gateway URL |
| Put OpenNext on `ipix.co` now | Vercel stays origin |
| Copy all preview secrets | Six vars in Infisical |
| Dashboard-fix production `noop` | Out of scope; don’t poke live chat |
