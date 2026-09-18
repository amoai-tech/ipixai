# 01 — Live Cloudflare inventory

**Method:** GET via Cloudflare API MCP, 2026-08-24. Account `4984b9bad07bc1da9f097dc8c1da24e0`.  
**Not verified:** billing invoices, Workers CPU/bundle byte size (no size field on list), other Cloudflare accounts.

`workers.dev` account subdomain: **`sk-498`**.

---

## Zones and DNS

This token sees **one** zone: **`ipix.co`** (`6889b08f99cafcb8cbc83f5bd8ed7ed7`), plan **Free Website**, status **active**, created **2026-08-19**.

| Record | Type | Content | Proxied |
| ------ | ---- | ------- | ------- |
| `ipix.co` | A | `216.198.79.1` (Vercel anycast) | yes |
| `www.ipix.co` | CNAME | `cname.vercel-dns.com` | yes |
| `ipix.co` | MX | Google Workspace | no |
| TXT | Google site + SPF + Vercel domain verify | — | no |

**Worker routes on this zone:** **none**. **Workers custom domains API:** empty.

WAF/security_level: **medium**.

**KEEP** DNS/CDN/WAF. Apex and www are the live marketing/app front door on **Vercel**, orange-clouded. Like leaving the storefront lights on while you rebuild the studio out back.

`ipix.co` as a **Worker origin** is **not** how production works today. Do not attach OpenNext to the apex in Core.

---

## Workers (6)

| Name | Created | Last modified | Compat | Flags | Assets | Last deploy from | workers.dev |
| ---- | ------- | ------------- | ------ | ----- | ------ | ---------------- | ----------- |
| `ai-gateway` | 2026-07-11 | 2026-08-16 | 2026-03-10 | `nodejs_compat` | no | wrangler | on |
| `ipi636-webhook-probe` | 2026-07-16 | 2026-07-16 | 2026-07-16 | `nodejs_compat` | no | wrangler | on |
| `ipix-hd-pgstore-probe` | 2026-07-24 | 2026-07-24 | 2025-11-01 | `nodejs_compat` | no | wrangler | on |
| `ipix-hd-smoke-probe` | 2026-07-24 | 2026-07-24 | 2025-11-01 | `nodejs_compat` | no | wrangler | on |
| `ipix-operator` | 2026-07-09 | 2026-08-21 | 2026-07-08 | `nodejs_compat`, `enable_request_signal` | **yes** | **dash** | on |
| `ipix-operator-preview` | 2026-07-18 | 2026-08-24 | 2026-07-08 | same | **yes** | wrangler | on |

Cron: **none** on any of the six. Durable Object namespaces: **none**. Logpush: **off**. Observability logs: **on** for operator + HD probes + `ai-gateway`.

---

## Native AI Gateway

Gateway id **`ipix-prod`**. Created 2026-07-14. Authentication **true**. `collect_logs` **true**. Cache TTL **0**. Rate limit **0**. Not marked default. Unified-billing provider_configs list: **empty** (you still pass the provider key, or use Unified Billing later).

OpenAI provider URL (docs + API):  
`https://gateway.ai.cloudflare.com/v1/4984b9bad07bc1da9f097dc8c1da24e0/ipix-prod/openai`

Recent logs (5 of 69): provider **`workers-ai`**, model **`@cf/moonshotai/kimi-k2.6`**, 200, uncached. **Not** an OpenAI production traffic sample.

---

## Hyperdrive

| Field | Value |
| ----- | ----- |
| Name | `ipix-supabase-fresh` |
| Id | `f59421821941436593f4c88416fb1601` |
| Origin | `db.nvdlhrodvevgwdsneplk.supabase.co:5432` / `postgres` |
| User | `hyperdrive_mastra_runtime` |
| Cache | **disabled** |
| `origin_connection_limit` | 5 |

Matches git `app/wrangler.jsonc` binding `HYPERDRIVE_FRESH`.

---

## Storage products

| Product | Live |
| ------- | ---- |
| KV namespaces | **0** |
| Queues | **0** |
| D1 | **0** |
| Durable Objects | **0** |
| R2 | **not enabled** (API 10042) |

---

## Repo Wrangler vs live

| Source | Names |
| ------ | ----- |
| `app/wrangler.jsonc` | `ipix-operator` + env `ipix-operator-preview` / `ipix-operator` |
| `services/cloudflare-worker/wrangler.jsonc` | `ai-gateway` |
| Live extras | three `*-probe` Workers not in those configs as product |

OpenNext: `app/open-next.config.ts` still builds with **`MASTRA_STORAGE_MODE=noop`** and bundle stubs. That is the exact glue **not** to inherit.

Official Next-on-Workers: [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) → OpenNext adapter. Use a **new** Wrangler file in the new repo, smallest bindings: `nodejs_compat`, assets, observability. No Hyperdrive/AI service binding until MVP proof.
