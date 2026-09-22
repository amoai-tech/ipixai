# ADR 001 — Node / Vercel first

**Status:** Accepted · 2026-08-24
**Context:** Live operator app is Next on Vercel. Worker/OpenNext + Hyperdrive exist but chat persistence is not the golden path (`MASTRA_STORAGE_MODE=noop` on some Worker configs).

**Decision:** Core and MVP run on Node (Vercel). Cloudflare stays DNS/CDN/WAF/R2/AI Gateway until the same `TEST-<uuid>` gold passes on a Worker preview.

**Do not:** Make CopilotKit + Mastra + OpenNext + Hyperdrive one debugging exercise.