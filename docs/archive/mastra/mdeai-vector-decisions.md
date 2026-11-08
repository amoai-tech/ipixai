# Legacy MDE-only PgVector decisions

> Historical context for a different application's rentals/events vector/search implementation. **Never adopt these dimensions, models, architecture rules, or task IDs as current iPix truth.**

> **🚩 mdeai scope (read first — verified 2026-06-05).** This page is **generic Mastra RAG/vector docs**, kept for reference. For mdeai specifically:
> - **Do NOT adopt `@mastra/rag` chunk/embed/retrieve for product search.** Restaurants/events/rentals/venues are **structured rows**, not documents — they're served by **Supabase pgvector RPC + Gemini embeddings** today, which is correct. See `tasks/mastra/plan/2-mastra-surface-gap-analysis.md` §5.
> - The **only** place a Mastra `PgVector` store earns its keep is **semantic *memory* recall** → **AGT-08 (SAN-603, Phase 3)**. Not MVP.
> - **Embeddings = Gemini, not OpenAI.** Use `gemini-embedding-001` → **768 dimensions** (not the `text-embedding-3-small`/1536 shown in examples below). No `gpt-*`/OpenAI in mdeai (CLAUDE.md hard rule).
> - `@mastra/pg` is installed; `@mastra/rag` is **not** — keep it that way unless AGT-08 needs the store.
