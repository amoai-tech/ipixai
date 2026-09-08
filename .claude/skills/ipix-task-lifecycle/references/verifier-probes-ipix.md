# iPix task-verifier probes (adapted from `.claude/skills/task-verifier`)

**Sources of truth:** `AGENTS.md` · `CLAUDE.md` · current repo/runtime · live Linear · relevant domain SSOT

**Canonical edge/model traps:** `.claude/skills/task-verifier/references/verifier-probes-ipix.md` (post PR #3)

**Before marking any IPI issue Done:**

1. Load `.claude/skills/task-verifier/SKILL.md` + this file
2. Run task-specific probes below
3. Run MCP checks from `mcp-cadence-ipix.md`
4. Score ≥85/100 or document waivers in Linear comment

## Universal probes

| Probe | Command | Pass |
|-------|---------|------|
| Build | `npm run build` | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0 (if configured) |
| RLS (platform) | `npm run supabase:verify-rls` | 19/19 when DB touched |
| No client secrets | `npm run check:env` or `node scripts/check-client-env.mjs` | exit 0 after PLT-004 |
| Gemini in client | `rg VITE_GEMINI|GEMINI_API_KEY src/` | no matches in `src/` |

## Schema traps (verified against `20260614000000_ipix_platform_mvp.sql`)

| Wrong | Correct |
|-------|---------|
| `ai_agent_logs.latency_ms` | `duration_ms` |
| `brand_scores.overall_score` | `score` + `score_type` |
| PRD `aesthetic-auditor` slug (MVP) | `audit-asset-dna` |
| `generateImages()` | `generateContent()` + parse `inlineData` |

## Model default (MVP)

- **As-built edge:** `gemini-3.5-flash` — `_shared/gemini.ts`
- **Target (AI-018):** `gemini-3.5-flash` — see [`tasks/intelligence/plans/gemini-plan.md`](../../../tasks/intelligence/plans/gemini-plan.md)
- **Text + URL:** `gemini-3.5-flash` + `{ urlContext: {} }` — [URL context docs](https://ai.google.dev/gemini-api/docs/url-context)
- **Vision / DNA:** `gemini-3.5-flash` + Cloudinary `secure_url` or `inlineData` — AI-010
- **Structured output:** `responseMimeType: application/json` + `responseSchema` (Type enums) — [Structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- **Thinking:** `thinkingConfig.thinkingLevel` — default `medium`; use `high` for scoring (not `thinkingBudget`)
- Verify model ID via `user-gemini-api-docs-mcp` `fetch_docs` or AI-018 registry before deploy
