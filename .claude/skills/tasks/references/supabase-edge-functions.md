# Supabase Edge Functions task reference

Use this reference for iPix tasks that create, retain, retire, secure, deploy, or certify Supabase Edge Functions.

## Primary source

- Supabase Edge Functions: https://supabase.com/docs/guides/functions

## Auth and secrets

- Securing Edge Functions: https://supabase.com/docs/guides/functions/auth
- Authorization headers and `verify_jwt`: https://supabase.com/docs/guides/functions/auth-headers
- Managing secrets: https://supabase.com/docs/guides/functions/secrets
- API key migration: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
- JWT signing keys: https://supabase.com/docs/guides/auth/signing-keys
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security

## Development and operations

- Local development: https://supabase.com/docs/guides/functions/local-development
- Debugging tools: https://supabase.com/docs/guides/functions/debugging-tools
- Deploying Edge Functions: https://supabase.com/docs/guides/functions/deploy

## iPix execution rules

1. Inspect live Supabase and current `origin/main` before assuming a function is missing or stale.
2. Classify every function caller before changing auth: user JWT, external provider webhook, trusted backend, or public liveness.
3. Preserve user-scoped Supabase clients for tenant-aware database work so RLS remains authoritative.
4. Do not treat CORS as authorization.
5. Do not send `sb_publishable_*` or `sb_secret_*` values as user bearer JWTs.
6. External webhooks must verify the provider signature over the raw request body before any durable write.
7. AI-generated consequential state follows: AI proposes → human reviews → approved server action writes.
8. Prefer official SDK/client behavior over custom HTTP wrappers when runtime/security proof passes.
9. Keep an explicit caller/disposition matrix: keep / diagnostic / retire / replace.
10. Never delete a deployed function until caller search, runtime proof, rollback, and remote inventory verification show zero required production callers.

## iPix Edge V2 task owners

- IPI-1186 · SB-EDGE-V2-001 — Retire Legacy Supabase Edge Paths After V2 Replacement Proof
- IPI-1187 · SB-EDGE-V2-002 — Certify Retained Edge Functions for Production V2
- IPI-1093 · BRAND-INTEL-001 — Turn a Brand Website Into an Approved Brand DNA Profile
- IPI-1136 · ASSET-DNA-001 — Analyze Uploaded Shoot Assets Against the Approved Brand Brain
- IPI-1175 · SB-KEYS-001 — Migrate iPix Backend Supabase Access to Modern Secret Keys
- IPI-1176 · AUTH-SIGNING-001 — Move Supabase Auth to Asymmetric JWT Signing Keys Safely
- IPI-742 · SB-EDGE-CI-001 — Controlled Supabase Edge Function Deployment Pipeline
- IPI-689 · SB-EDGE-006 — CI inventory gate for Edge repo vs remote vs config.toml
- IPI-685 · SB-EDGE-002 — Harden capture-lead origin allowlist, rate limit, and transactional writes

## Verification order

Static caller/config inspection → targeted unit test → auth/tenant negative test → integration test → deploy canary → production smoke → remote inventory comparison → Supabase advisor review.

For external Firecrawl callbacks also use:
- Firecrawl webhook security: https://docs.firecrawl.dev/webhooks/security
- Firecrawl crawl: https://docs.firecrawl.dev/features/crawl
- Firecrawl JS SDK: https://github.com/firecrawl/firecrawl/tree/main/apps/js-sdk/firecrawl
