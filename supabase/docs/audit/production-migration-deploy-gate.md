# Production migration deploy gate — what governs Supabase auto-apply

**IPI-1171 · SB-OPS-001 — Determine What Actually Governs Supabase's Production
Migration Auto-Apply** — read-only investigation. Last updated 2026-09-07
against project `nvdlhrodvevgwdsneplk` ("fashionos").

## Recommended operational rule (adopt now — not yet technically enforced)

```text
Across 3 observed cases, merging a PR containing supabase/migrations/*.sql to
`main` was followed by automatic production application of the pending
migrations, on a timescale tied to something in Supabase's post-push
deployment pipeline — NOT instantaneously at the GitHub merge API call. This
is an evidence-based pattern from direct observation, not a vendor-confirmed
mechanism (see Steps 1–2 below, marked NOT VERIFIED).

The exact toggle/setting that supposedly controls this ("Deploy to production")
could not be confirmed from this session (see Step 3 below) and, per prior
observation on **PR #91 · IPI-1169 · SB-MIG-004 — Reconcile 3 migration-
timestamp identities, restore Supabase Preview**, was reportedly OFF while
auto-apply still happened. Do not rely on that toggle as the safety boundary
until it is re-verified.

Therefore the required production procedure for iPix is a PROCESS rule, not a
platform-setting guarantee:

  no PR containing supabase/migrations/*.sql merges to main
  without an explicit, in-chat human approval naming the exact migration
  files and accepting that merge = production deployment.

This is what was actually practiced for PR #91, #92, and #93. It is a required
procedure, not a technically enforced control — nothing currently blocks
someone from merging a migration-bearing PR without asking (see "Recommended
model" below for what a real technical control would need).
```

## Evidence log (3 confirmed cases)

| PR | Migrations pending pre-merge | Result |
| -- | -- | -- |
| **PR #91 · IPI-1169 · SB-MIG-004 — Reconcile 3 migration-timestamp identities, restore Supabase Preview** | multiple | applied on merge; toggle reportedly OFF beforehand |
| **PR #92 · IPI-1167 · SB-FIX-011 — Fix Live `block_brand_org_change` Bug on Production** | 1 (`block_brand_org_change` fix) | applied on merge |
| **PR #93 · IPI-1163 · SB-SEC — Retire Legacy Anonymous Demo-Event Write Policies From Production** | 3 (`20260907020000`/`030000`/`040000`) | still pending immediately after merge API call returned; applied only after `main`-branch CI (`run 34101172688`) finished — narrows the mechanism to the post-push deployment pipeline, not the merge event itself |

## Step 1 — repo-owned deploy paths: NONE FOUND

- `.github/workflows/` contains exactly one file, `ci.yml`. Grepped for
  `supabase db push`, `migration repair`, `db reset --linked`, `deploy`,
  `MIGRATE`, `api.supabase.com` — zero matches.
- `supabase/config.toml` has no branching/production block (that config is
  dashboard-side, not version-controlled here).
- **Confirmed: iPix's own CI does not push migrations to production** —
  directly verified by grep, zero matches for any deploy command.
- **NOT VERIFIED: that Supabase's GitHub/Branching integration is *the*
  mechanism causing auto-apply.** That's the leading hypothesis given the
  auto-apply is provably not repo-owned and a `main`-tracking branch record
  exists (Step 2), and it matches the *documented* behavior of the "Deploy to
  production" GitHub Integration setting per official Supabase docs (confirmed
  via Context7 2026-09-07: "Enabling the Deploy to production option...
  automatically deploys changes when pushing or merging to the production
  branch... new migrations are applied, and Edge Functions and Storage buckets
  declared in config.toml are deployed" — source:
  `apps/docs/content/guides/deployment/branching/github-integration.mdx`).
  But this project's actual toggle state was never confirmed (Step 3, blocked),
  so treat this as the best-supported hypothesis, not a proven mechanism.

## Step 2 — live Supabase state (read-only, via CLI + Management API)

```text
project ref:            nvdlhrodvevgwdsneplk
org id:                 qxwedaovkaggtzmzysoq
project status:         ACTIVE_HEALTHY
branch record:          main (id 73a28f1e-9fba-4728-bd4b-0bb1e55ce440)
  is_default:            true
  git_branch:            "main"
  persistent:            false
  status:                FUNCTIONS_DEPLOYED
  preview_project_status: ACTIVE_HEALTHY
  updated_at:             2026-09-01 (predates today's merge — this field
                           does NOT refresh on every migration apply; it
                           appears tied to the Edge Functions deploy step
                           specifically, not the Migrate step)
```

The existence of this branch record — `is_default: true`, `git_branch: "main"`
— confirms Supabase Branching is *configured* to track this repo's `main`
branch. **NOT VERIFIED:** that this configuration is itself what *executes*
the migration apply (as opposed to some other internal Supabase system keyed
off the same git push). The granular toggle state inside it is what the
still-blocked Step 3 would confirm.

Migration ledger (`supabase migration list --linked`) is the reliable
observable — it reflects real DB state immediately, independent of the branch
metadata's staler `updated_at`.

## Step 3 — dashboard configuration: BLOCKED, needs a human

Not completed this session. **NOT VERIFIED: that the Management API has no
endpoint anywhere for GitHub Integration/Branching/Deploy-to-production
settings.** What's actually confirmed is narrower: the specific guessed
endpoint paths below returned 404/403, and Context7's index of the official
OpenAPI-generated Management API reference (`/websites/api_supabase_api_v1`,
queried 2026-09-07) lists documented categories — Auth, Analytics, Rest,
Branches, etc. — with no "Integrations"/GitHub category among them. Neither
of those is proof no such endpoint exists at all; it's the best evidence
available without either an authenticated dashboard session or an official
statement from Supabase.

Exact probe record — token: project-scoped personal access token (the
`organizations/{id}` plain GET below 403'd as Forbidden, confirming the
token's scope does *not* extend to organization-level reads; project-level
reads succeed, e.g. `GET /v1/projects/{ref}` returned 200 earlier in this
session):

| Timestamp (UTC) | Endpoint | Status | Response body |
| -- | -- | -- | -- |
| 2026-09-07T09:05:19Z | `GET /v1/projects/nvdlhrodvevgwdsneplk/github-connections` | 404 | `{"message":"Cannot GET /v1/projects/nvdlhrodvevgwdsneplk/github-connections"}` |
| 2026-09-07T09:05:19Z | `GET /v1/projects/nvdlhrodvevgwdsneplk/vercel-connections` | 404 | `{"message":"Cannot GET /v1/projects/nvdlhrodvevgwdsneplk/vercel-connections"}` |
| 2026-09-07T09:05:19Z | `GET /v1/organizations/qxwedaovkaggtzmzysoq/integrations` | 404 | `{"message":"Cannot GET /v1/organizations/qxwedaovkaggtzmzysoq/integrations"}` |
| 2026-09-07T09:05:19Z | `GET /v1/projects/nvdlhrodvevgwdsneplk/config/database` | 404 | `{"message":"Cannot GET /v1/projects/nvdlhrodvevgwdsneplk/config/database"}` |
| 2026-09-07T09:05:19Z | `GET /v1/projects/nvdlhrodvevgwdsneplk/branches/73a28f1e-9fba-4728-bd4b-0bb1e55ce440` | 404 | `{"message":"Preview branch not found."}` (the officially documented `GET /v1/branches/{branch_id_or_ref}` endpoint exists per Context7, but doesn't resolve this project's default/production branch record — only actual preview branches, apparently) |
| 2026-09-07T09:05:19Z | `GET /v1/organizations/qxwedaovkaggtzmzysoq` | 403 | `{"message":"Forbidden"}` |

Conclusion held open: the dashboard-only path (below) remains the only way
to actually confirm these settings; the Management API silence above is
supporting evidence, not a substitute for it.

The only way to read those settings is the dashboard UI
(`/project/nvdlhrodvevgwdsneplk/settings/integrations`), which requires
signing in. Entering a password to authenticate is a prohibited action for
me to perform on your behalf, even with credentials supplied — this has to
be either:
- you check the 3 settings yourself (GitHub Integration on/off, Deploy to
  production toggle state, Branching enabled) and report back, or
- you authorize the Supabase MCP connector for this session (`/mcp` or
  `claude mcp` — needs an interactive session, not this one) so a future
  session can query it directly, if that connector exposes these settings
  (unconfirmed — the REST Management API doesn't, so the MCP server may not
  either).

## Recommended model (Option A, hardened with a process gate)

Comparing the 3 options from the task:

- **A. Supabase auto-deploy from main** — this is what's actually happening,
  confirmed 3/3. Fastest, but least explicit control *unless* paired with a
  merge-time human gate.
- **B. Preview branches + explicit production promotion** — would mean
  pointing Supabase's tracked git_branch at something other than `main`
  (e.g. a `deploy` branch) and promoting explicitly. Real restructuring,
  not justified unless Option A+gate proves insufficient.
- **C. Disable auto-deploy via the dashboard toggle, use manual `db push`** —
  cannot be verified reliable: PR #91's already-off toggle didn't stop
  auto-apply, so flipping it again risks doing nothing while giving false
  confidence.

**Adopt A, hardened**: keep Supabase's auto-deploy as-is (changing it requires
the blocked dashboard step and hasn't been shown to work anyway), but make the
human-approval step mandatory and explicit for every PR touching
`supabase/migrations/**` before merge — exactly the gate already used for
**PR #93 · IPI-1163 · SB-SEC — Retire Legacy Anonymous Demo-Event Write
Policies From Production** (see that issue for the approval-then-merge-then-
verify sequence). This is the *required procedure* today, not a technically
enforced control — `main` has no branch protection rule at all (`404 Branch
not protected`, confirmed 2026-09-07), so nothing currently stops a merge that
skips the approval step. It becomes an actually-enforced gate only once paired
with a technical control: adding branch protection on `main` requiring a
human-reviewed check (or a bot check gated on an explicit approval label) for
any PR touching `supabase/migrations/**`.

## Still open

- Dashboard settings unconfirmed (Step 3) — the one item this session
  structurally cannot close.
- Whether GitHub Integration's "required check" can be made a hard GitHub
  branch-protection requirement — moot right now since `main` has no branch
  protection rule at all (`404 Branch not protected`, confirmed 2026-09-07).
  Adding branch protection requiring the "Supabase Preview" check would be a
  separate, low-risk repo-settings change if wanted.
