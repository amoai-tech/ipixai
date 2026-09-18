# Cloudflare rebuild audit (live, read-only)

**Account:** `4984b9bad07bc1da9f097dc8c1da24e0` ([dashboard](https://dash.cloudflare.com/4984b9bad07bc1da9f097dc8c1da24e0/home))  
**Verified:** 2026-08-24 via Cloudflare API MCP (GET only). **No production changes.**  
**Repo context:** new app is [amo-tech-ai/ipix](https://github.com/amo-tech-ai/ipix); this repo’s `app/` + `services/cloudflare-worker/` are the **legacy** operator/OpenNext stack.

Fashion example: keep the studio lease, the front door, and the lighting grid. Do **not** move the new lookbook shoot into the old set with the taped-together radio. Prove the shot on a Node stage first, then copy the lighting plot to Cloudflare.

| Score | Result |
| ----- | -----: |
| Overall rebuild plan | **88/100** |
| Current Cloudflare setup | **54/100** |
| New target architecture | **93/100** |
| Live inventory confidence | **90%** |
| Combined confidence | **86%** |

**Final answer:** **reuse the Cloudflare account, zone, CDN/WAF, and native AI Gateway.** **Do not copy** `ipix-operator` / OpenNext / the custom `ai-gateway` Worker. **Node first**, then a **clean** `ipix-preview` Worker after the golden test.

---

## 1. Executive verdict

| Keep | Change | Do not copy |
| ---- | ------ | ----------- |
| `ipix.co` DNS (proxied to Vercel) | Native gateway `ipix-prod` for OpenAI **after** direct OpenAI works | OpenNext `ipix-operator` as the new runtime |
| Orange-cloud CDN + WAF (`security_level=medium`) | New Worker names `ipix-preview` / `ipix` | `MASTRA_STORAGE_MODE=noop` as a feature |
| `workers.dev` subdomain `sk-498` for experiments | Re-enter secrets; never bulk-copy | Probe Workers as product |
| Hyperdrive config **as a later option** | Preview Mastra DB, not prod threads | Custom `ai-gateway` Worker (Gemini/Workers AI/Bedrock router) |

**Why current score is ~54:** DNS and native AI Gateway are real and useful. The live operator Workers are the old compatibility museum: production **`MASTRA_STORAGE_MODE=noop`**, service-role on the Worker, Gemini-first flags, service binding to a **custom** gateway Worker whose dashboard override points at **Workers AI Llama**, not OpenAI. That is why chat persistence never became the golden path.

---

## 2. Asset decision matrix

| Asset | Decision |
| ----- | -------- |
| `ipix.co` zone | **KEEP** |
| DNS / CDN / WAF | **KEEP** |
| `www.ipix.co` → Vercel | **KEEP** (untouched until cutover) |
| Native AI Gateway `ipix-prod` | **REUSE** (OpenAI path later; auth already on) |
| Custom Worker `ai-gateway` | **LEGACY / REFERENCE — retire after native Gateway** |
| `ipix-operator` | **LEGACY / REFERENCE** |
| `ipix-operator-preview` | **LEGACY / REFERENCE** |
| Probe Workers | **AUDIT then REMOVE** (no product traffic) |
| Hyperdrive `ipix-supabase-fresh` | **DEFER** until Node golden test + Worker golden test |
| R2 / KV / D1 / Queues / Durable Objects | **NONE live** — add only for a real use case |
| Existing Worker secrets | **RE-ENTER selectively** — do not bulk-copy |
| Worker custom domains / zone routes | **None today** — add on cutover |
| New `ipix-preview` | **CREATE CLEAN** (MVP, after Node golden test) |
| New `ipix` | **CREATE AFTER** the same golden test on Cloudflare |

Detail: [01-inventory.md](./01-inventory.md) · [02-workers.md](./02-workers.md) · [03-env-secrets.md](./03-env-secrets.md) · [04-findings-and-plan.md](./04-findings-and-plan.md)

---

## 3. Node-first vs Worker-first

| Criterion | A. Node / Vercel first | B. Workers / OpenNext first |
| --------- | ---------------------: | --------------------------: |
| Simplicity | 90 | 42 |
| CopilotKit compatibility | 88 | 55 |
| Mastra compatibility | 90 | 48 |
| Persistence | 92 | 38 |
| Debugging | 90 | 50 |
| Cost | 78 | 80 |
| Production readiness (now) | 82 | 40 |
| **Weighted** | **~88** | **~49** |

**Recommend A.** Official Cloudflare path for Next.js is still [OpenNext on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/). That is the **MVP hosting** target, not the first runtime. Live proof: production Worker has assets (OpenNext) **and** `MASTRA_STORAGE_MODE=noop`. Do not repeat that.

**Gate (both platforms):** `TEST-<uuid>` → stream → DB persist → hard refresh → server restart → Org B cannot read Org A thread. Pass on Node, then the **same** test on `ipix-preview`.

---

## 4. AI Gateway

Two different things exist:

1. **Product** [AI Gateway](https://developers.cloudflare.com/ai-gateway/) slug **`ipix-prod`**. OpenAI URL works:  
   `https://gateway.ai.cloudflare.com/v1/4984b9bad07bc1da9f097dc8c1da24e0/ipix-prod/openai`  
   Auth **on**. Cache TTL **0**. Rate limit **off**. Logs **on** (69 stored; recent sample is **Workers AI**, not OpenAI).
2. **Worker** `ai-gateway` — custom router (Gemini / Workers AI / Bedrock). Live `MODEL_REGISTRY_OVERRIDE` defaults to **Workers AI Llama 3.1**. **No OpenAI provider in that Worker.**

**New iPix:** Mastra → AI SDK / OpenAI **direct** first. Then Mastra → OpenAI **via native Gateway** `ipix-prod`. Do **not** put Gateway on the Core golden path. Do **not** reuse the custom Worker.

---

## 5. Hyperdrive

Config **`ipix-supabase-fresh`** (`f59421821941436593f4c88416fb1601`) → live Supabase Postgres, user `hyperdrive_mastra_runtime`, **query cache off**, origin pool **5**. Bound on operator Workers and HD probes.

**Defer.** Workers Hyperdrive is for when the **app** runs on Workers. Core Node talks to Postgres with `MASTRA_DATABASE_URL` (transaction pooler) like the rest of the plan. Turning Hyperdrive on against **production** `mastra.*` before preview storage is a data-loss risk.

---

## 6. Top findings

| ID | Sev | Problem |
| -- | --- | ------- |
| CF-01 | P1 | Production `ipix-operator` **`MASTRA_STORAGE_MODE=noop`** while git Wrangler production block says `pg`. Persistence is not the live Worker path. |
| CF-02 | P1 | `SUPABASE_SERVICE_ROLE_KEY` on operator Workers. Fail-closed JWT + RLS should be enough for user traffic. |
| CF-03 | P1 | Preview `AI_PROVIDER=gemini` + `GEMINI_API_KEY`; production also Gemini-keyed. New Core is **OpenAI**. |
| CF-04 | P2 | Custom `ai-gateway` Worker ≠ native Gateway; Llama override vs OpenAI rebuild. |
| CF-05 | P2 | `ipix.co` has **zero** Worker routes. App origin is **Vercel**. Do not steal DNS in Core. |
| CF-06 | P2 | R2 not enabled (API 10042). Fine for Core. |
| CF-07 | P3 | Three probe Workers still public on `*.sk-498.workers.dev`. |

---

## 7. Stages

**CORE** — reuse DNS; leave `ipix-operator` up; no new Worker; Node golden test.  
**MVP** — `ipix-preview` + current OpenNext; native AI Gateway for OpenAI; same golden test; logs + rollback.  
**POST-MVP** — production `ipix` Worker; optional custom domain; R2/Queues if needed; Hyperdrive only if Worker PG is proven; delete probes.  
**ADVANCED** — routing, multi-region, Durable Objects only with a proven coordination case.

---

## 8. Cutover order and rollback

1. Wave 0 Supabase (existing pack).  
2. Node app + direct OpenAI + preview `mastra`.  
3. Golden test on Node.  
4. Optional: OpenAI through `ipix-prod` Gateway.  
5. Clean `ipix-preview` OpenNext (no stubs, no `noop`). Repeat golden test.  
6. New `ipix` Worker. Point a **preview hostname** first, never `ipix.co` apex on day one.  
7. Cut `app.ipix.co` or similar; keep apex/www on Vercel until the Worker is gold.  
8. Retire probes → custom `ai-gateway` Worker → old operator names.

**Rollback:** DNS still points at Vercel until step 7. After step 7, flip DNS back to Vercel CNAME/A. Old `ipix-operator` stays undeleted until the new Worker is gold.

---

## 9. Production-ready checklist (Cloudflare)

- [ ] Node golden test green on preview DB  
- [ ] `ipix-preview` golden test green (same UUID story)  
- [ ] No `MASTRA_STORAGE_MODE=noop` on the new Workers  
- [ ] No service-role on the request path  
- [ ] Native Gateway optional; OpenAI works without it  
- [ ] Observability on; traces optional  
- [ ] Rollback DNS documented  
- [ ] Probes gone or Access-gated  
- [ ] `ipix.co` apex unchanged until explicitly scheduled
