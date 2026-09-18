# 02 — Existing Workers (deep review)

Do **not** copy these Workers into [amo-tech-ai/ipix](https://github.com/amo-tech-ai/ipix). They are the old set: still useful as a **lighting diagram**, not as the new stage.

URLs (public `workers.dev`):

- https://dash.cloudflare.com/4984b9bad07bc1da9f097dc8c1da24e0/workers/services/view/ipix-operator/production  
- https://dash.cloudflare.com/4984b9bad07bc1da9f097dc8c1da24e0/workers/services/view/ipix-operator-preview/production  
- https://dash.cloudflare.com/4984b9bad07bc1da9f097dc8c1da24e0/workers/services/view/ai-gateway/production  

Likely public hosts: `ipix-operator.sk-498.workers.dev`, `ipix-operator-preview.sk-498.workers.dev`, `ai-gateway.sk-498.workers.dev`.

---

## `ipix-operator` — LEGACY / REFERENCE

OpenNext operator app (has **assets**). Latest deploy **2026-08-21 from dashboard** (version `bb09eda5…`), not git-clean Wrangler-only.

**Useful:** `nodejs_compat` + `enable_request_signal` (streaming), observability 100% head sampling, Images binding, version metadata, Hyperdrive id (for later).

**Legacy / do not copy:**

| Item | Live |
| ---- | ---- |
| Storage | **`MASTRA_STORAGE_MODE=noop`** |
| Hyperdrive smokes | `ENABLE_HYPERDRIVE_PG_SMOKE=false`, thread canary false |
| AI | `AI` binding + **service binding `AI_GATEWAY` → Worker `ai-gateway`** |
| Auth data | `SUPABASE_SERVICE_ROLE_KEY` secret |
| Models | `GEMINI_API_KEY`, `GROQ_API_KEY`; **no `OPENAI_API_KEY` on production** |
| Other secrets | `DATABASE_URL`, CopilotKit license, Firecrawl, Cloudinary, webhook/lead secrets |

Git `app/wrangler.jsonc` production `vars.MASTRA_STORAGE_MODE` is **`pg`**. **Live production is `noop`.** Environment drift is confirmed.

---

## `ipix-operator-preview` — LEGACY / REFERENCE

Same OpenNext shape. Last modified **2026-08-24** via Wrangler.

**Closer to “real PG”:** `MASTRA_STORAGE_MODE=pg`, `ENABLE_HYPERDRIVE_PG_SMOKE=true`.  
**Still Gemini-first:** `AI_PROVIDER=gemini`.  
**OAuth helper:** `TRUSTED_OAUTH_FORWARDED_HOSTS=ipix-operator-preview.sk-498.workers.dev`.

Extra vs production: `OPENAI_API_KEY`, `NVIDIA_API_KEY`, per-agent `AI_ROUTING_*` secrets. Preview is a **secret junk drawer**. Re-enter only what the new app needs.

---

## `ai-gateway` — LEGACY / REFERENCE (retire)

This is **not** Cloudflare AI Gateway. It is a **custom Worker** (`services/cloudflare-worker`).

Repo providers: **Gemini, Workers AI, Bedrock** — [router.ts](../../../../services/cloudflare-worker/src/router.ts). **No OpenAI adapter.**

Live plaintext `MODEL_REGISTRY_OVERRIDE`: default/fast/structured → **`@cf/meta/llama-3.1-8b-instruct-fp8`**; embedding → **bge-base**. Plus `CLOUDFLARE_ACCOUNT_ID` plaintext and `CLOUDFLARE_API_TOKEN` secret.

Last Wrangler deploy **2026-08-16**. Observability on. No cron.

**KEEP the idea** (one proxy, logging, model tiers). **REBUILD as native `ipix-prod` Gateway**, not this Worker.

---

## Probe Workers — AUDIT then REMOVE

| Worker | Bindings | Last change | Role |
| ------ | -------- | ----------- | ---- |
| `ipi636-webhook-probe` | Cloudinary + `FORWARD_TO` secrets | 2026-07-16 | Webhook experiment |
| `ipix-hd-smoke-probe` | Hyperdrive only | 2026-07-24 | HD smoke |
| `ipix-hd-pgstore-probe` | Hyperdrive only | 2026-07-24 | PG store probe |

Public `*.workers.dev` with Hyperdrive to **production** Supabase is unnecessary attack surface. Document the lesson (HD works at all), then delete or put behind Access. **Do not** build the new app on these.

---

## Old runtime hacks (do not inherit)

From git + live flags:

- OpenNext `MASTRA_STORAGE_MODE=noop` at **build** (`app/open-next.config.ts`)
- Package **aliases/stubs**: ast-grep, shiki, mermaid, katex, CopilotKit web-inspector
- Optional PG-scope stub unless `IPIX_CF_INCLUDE_MASTRA_PG_SCOPE=1`
- Service binding to custom `ai-gateway` instead of native Gateway
- Feature flags: `ENABLE_CF_AI_SMOKE`, Hyperdrive canaries
- `InMemory` / noop storage as a “supported” Worker mode

New Wrangler should look like a **starter OpenNext file**, not this.

---

## Rename vs new names

Do **not** rename live `ipix-operator` in place (that is production-adjacent). Create **new** scripts:

| Env | Worker name | Hostname (proposed) |
| --- | ----------- | ------------------- |
| local | — | Node `localhost` |
| staging | `ipix-preview` | `ipix-preview.sk-498.workers.dev` then `preview.ipix.co` |
| production | `ipix` | custom domain **after** gold; not apex on day one |

Leave old names running until cutover.
