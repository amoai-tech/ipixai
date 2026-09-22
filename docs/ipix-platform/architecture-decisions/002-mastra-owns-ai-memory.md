# ADR 002 — Mastra owns AI memory; Supabase app tables own the shoot

**Status:** Accepted · 2026-08-24
**Context:** Mixing conversation state into `public` AI tables, or treating Mastra working memory as the source of truth for shoots/bookings, creates a second lookbook that drifts from production.

**Decision:**

- **Mastra `mastra.*`:** threads, messages, workflow snapshots, traces.
- **Supabase app schema:** brands, shoots, bookings, CRM, approvals, assets.
- Constructor: live iPix `@mastra/pg@1.20.0` uses `schemaName` + `disableInit: true`. Current Mastra docs use `schemaName` + `disableInit`. **Follow installed types.** `MASTRA_SCHEMA` required; never silent `public`.
- Preview/branch DB until Wave 4 gold. No production thread writes on day one.

**Do not:** Invent `public.mastra_*`. Do not store shot lists or booking rows only in agent memory.