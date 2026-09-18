---
noindex: true
---

# 03 — Secrets and environment contract

**Rule:** names only. Values were not copied into git. Re-enter in Infisical for the **new** app.

---

## Classification (live operator Workers)

| Name | Class | Where | New iPix |
| ---- | ----- | ----- | -------- |
| `NEXT_PUBLIC_*` (app, not Worker list) | PUBLIC | Next | Keep pattern: `NEXT_PUBLIC_SUPABASE_URL`, publishable key |
| `OPERATOR_AUTH_ENABLED` | PUBLIC/FLAG | both Workers `true` | Replace with fail-closed auth; no “enabled” escape |
| `DAM_ENV` | FLAG | prod=`prod`, preview=`staging` | Only if Cloudinary stays |
| `MASTRA_STORAGE_MODE` | **LEGACY** | prod **`noop`**, preview **`pg`**, git prod **`pg`** | **REMOVE**. Always Postgres + `schemaName` + `disableInit` |
| `ENABLE_CF_AI_SMOKE` | LEGACY | `false` | REMOVE |
| `ENABLE_HYPERDRIVE_PG_SMOKE` | LEGACY | prod `false`, preview `true` | REMOVE from product |
| `ENABLE_HYPERDRIVE_THREAD_CANARY` | LEGACY | `false` | REMOVE |
| `AI_PROVIDER` | LEGACY | preview **`gemini`** | REMOVE; Core = OpenAI |
| `TRUSTED_OAUTH_FORWARDED_HOSTS` | SERVER | preview workers.dev | Recreate for new hostnames |
| `GEMINI_API_KEY` | SERVER SECRET | both | **REMOVE from Core**; keep only if a later Gemini tool exists |
| `OPENAI_API_KEY` | SERVER SECRET | **preview only** | **REQUIRED for Core** |
| `GROQ_API_KEY` / `NVIDIA_API_KEY` | LEGACY | preview (+ Groq on prod) | DEFER |
| `AI_ROUTING_AGENT_*` | LEGACY | preview | REMOVE until a real router exists |
| `AI_GATEWAY_API_KEY` | SERVER SECRET | both | Use **native** Gateway token when Gateway is on; not Core |
| `SUPABASE_SERVICE_ROLE_KEY` | SERVER SECRET | both | **REMOVE from Worker/request path.** Edge/admin only |
| `DATABASE_URL` | SERVER SECRET | both | Prefer `MASTRA_DATABASE_URL` (pooler) in Node; do not put prod URL on a public Worker until preview DB |
| `COPILOTKIT_LICENSE_TOKEN` | SERVER SECRET | both | Re-enter if license still required |
| `CLOUDINARY_API_SECRET` | SERVER SECRET | both + probe | Product DAM; not Core chat |
| `FIRECRAWL_API_KEY` | SERVER SECRET | both | Crawl jobs; not Core |
| `CAPTURE_LEAD_PROXY_SECRET` / `INTERNAL_WEBHOOK_SECRET` / `INTELLIGENCE_API_KEY` | SERVER SECRET | both | Recreate if those Edge paths remain |
| `AI` | CLOUDFLARE BINDING | both | DEFER (Workers AI). Core uses OpenAI |
| `AI_GATEWAY` service → `ai-gateway` | CLOUDFLARE BINDING | both | **REMOVE**; use native Gateway HTTP later |
| `HYPERDRIVE_FRESH` | CLOUDFLARE BINDING | both + HD probes | DEFER |
| `ASSETS` / `IMAGES` / `WORKER_SELF_REFERENCE` / `WORKER_VERSION_METADATA` | CLOUDFLARE BINDING | operator | ASSETS+version yes for OpenNext MVP; Images optional |
| `CLOUDFLARE_API_TOKEN` | SERVER SECRET | custom `ai-gateway` Worker | Do not put account tokens in the new app |
| `MODEL_REGISTRY_OVERRIDE` | LEGACY plaintext | custom Worker | REMOVE |

Duplicates: Gemini + Groq + Nvidia + OpenAI + routing secrets on **preview**. Production is Gemini/Groq without OpenAI. **Do not copy production’s missing OpenAI into the new Core.**

---

## Target clean contract (new repo)

```text
# public
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
APP_URL

# server
MASTRA_DATABASE_URL          # preview project first
MASTRA_SCHEMA=mastra
OPENAI_API_KEY
WORKER_ENV                   # development | staging | production

# optional later
AI_GATEWAY_ACCOUNT_ID
AI_GATEWAY_ID=ipix-prod
AI_GATEWAY_API_KEY
```

No `MASTRA_STORAGE_MODE`. No Gemini on the Core path. No service role on the Operator request path.

---

## `ai-gateway` Worker vs native Gateway

| | Custom Worker | Native `ipix-prod` |
| - | ------------- | ------------------- |
| OpenAI | **No** | **Yes** (official `/openai` URL) |
| Live default models | Workers AI Llama (override JSON) | Logs show Workers AI Kimi, not OpenAI |
| Auth | CF token + Gemini/Bedrock keys in code paths | Gateway authentication **enabled** |

New app uses native Gateway **after** direct OpenAI works.
