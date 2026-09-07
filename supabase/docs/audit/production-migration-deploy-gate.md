# Production migration deploy gate — what governs Supabase auto-apply

`IPI-1171 · SB-OPS-001` — read-only investigation. Last updated 2026-09-07 against
project `nvdlhrodvevgwdsneplk` ("fashionos").

## Verified operational rule (adopt now)

```text
For iPix, merging a PR containing supabase/migrations/*.sql to `main` DOES
automatically apply them to production, on a timescale tied to Supabase's own
post-push deployment pipeline — NOT instantaneously at the GitHub merge API call.

The exact toggle/setting that supposedly controls this ("Deploy to production")
could not be confirmed from this session (see "Blocked" below) and, per prior
observation on PR #91, was reportedly OFF while auto-apply still happened. Do
not rely on that toggle as the safety boundary until it is re-verified.

Therefore the required production gate for iPix is a PROCESS gate, not a
platform-setting gate:

  no PR containing supabase/migrations/*.sql merges to main
  without an explicit, in-chat human approval naming the exact migration
  files and accepting that merge = production deployment.

This is what was actually practiced for PR #91, #92, and #93 — codify it,
don't assume the dashboard toggle will enforce it instead.
```

## Evidence log (3 confirmed cases)

| PR | Migrations pending pre-merge | Result |
| -- | -- | -- |
| #91 (IPI-1169) | multiple | applied on merge; toggle reportedly OFF beforehand |
| #92 (IPI-1167) | 1 (`block_brand_org_change` fix) | applied on merge |
| #93 (IPI-1163) | 3 (`020000`/`030000`/`040000`) | still pending immediately after merge API call returned; applied only after `main`-branch CI (`run 34101172688`) finished — narrows the mechanism to the post-push deployment pipeline, not the merge event itself |

## Step 1 — repo-owned deploy paths: NONE FOUND

- `.github/workflows/` contains exactly one file, `ci.yml`. Grepped for
  `supabase db push`, `migration repair`, `db reset --linked`, `deploy`,
  `MIGRATE`, `api.supabase.com` — zero matches.
- `supabase/config.toml` has no branching/production block (that config is
  dashboard-side, not version-controlled here).
- **Conclusion: iPix's own CI does not push migrations to production.** The
  auto-apply is entirely external to this repo's GitHub Actions — it's
  Supabase's own GitHub/Branching integration reacting to the push to `main`.

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
— is itself proof that Supabase Branching is actively configured against this
repo's `main` branch. That's the mechanism class; the granular toggle state
inside it is what Step 3 would confirm.

Migration ledger (`supabase migration list --linked`) is the reliable
observable — it reflects real DB state immediately, independent of the branch
metadata's staler `updated_at`.

## Step 3 — dashboard configuration: BLOCKED, needs a human

Not completed this session. `supabase branches list`/`get` and every
Management API endpoint tried (`github-connections`, `vercel-connections`,
`organizations/{id}/integrations`, `config/database`, branch-by-id) returned
404/403 — **the Management API genuinely does not expose GitHub
Integration/Branching/Deploy-to-production settings**, confirming the prior
session's finding independently.

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
PR #93 (see `IPI-1163` for the approval-then-merge-then-verify sequence). This
is enforceable today without needing the dashboard at all.

## Still open

- Dashboard settings unconfirmed (Step 3) — the one item this session
  structurally cannot close.
- Whether GitHub Integration's "required check" can be made a hard GitHub
  branch-protection requirement — moot right now since `main` has no branch
  protection rule at all (`404 Branch not protected`, confirmed 2026-09-07).
  Adding branch protection requiring the "Supabase Preview" check would be a
  separate, low-risk repo-settings change if wanted.
