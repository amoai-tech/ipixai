# iPix GitBook & Documentation Progress Tracker

Verified against the local curated docs worktree, GitHub `main`, PR evidence, and the GitBook preview/site on 2026-09-22.

**Legend:** 🟢 completed · 🟡 in progress · 🔴 failed/blocker · 🔵 not started / needs completion

## Overall status

| Area | Status | Complete | Proof / next action |
| --- | --- | ---: | --- |
| GitBook connection | 🟢 | 100% | GitBook GitHub installation is active; latest sync operation succeeded. |
| GitHub branch protection | 🟢 | 100% | `main-protection` ruleset is active; PR + required checks + conversation resolution + force-push/deletion protection are enabled; GitBook.com is the only bypass actor. |
| GitBook published navigation | 🟢 | 100% | Live space contains core, platform, development, Brands, ADR, and reference pages. |
| GitBook write scope / governance | 🟡 | 90% | Cleanup branch removes the GitBook-generated root `AGENTS.md` / `CLAUDE.md` instruction blocks. Final proof is a post-merge GitHub → GitBook import that does not recreate them. |
| Canonical docs path | 🟢 | 100% | Cleanup branch restores `gitbook-docs.yaml` to `./docs/ipix-platform` and removes the duplicate root tree. |
| Core/platform documentation | 🟢 | 100% | Core docs, CopilotKit, Mastra, Cloudinary, development workflow, ADRs, and reference docs exist. |
| Product-area documentation | 🟡 | 12.5% | Brands is publishable; 7 of 8 planned product-area docs still need to be created. |

## GitBook setup

| Task | Status | Complete | Verification / required fix |
| --- | --- | ---: | --- |
| Create **Ipix Docs** site and **iPix Platform Docs** space | 🟢 | 100% | Live site `site_wSg2e`, space `bLB4k9kvzFkWvhiTjOR8`. |
| Connect `amoai-tech/ipixai` | 🟢 | 100% | GitBook reports GitHub installation `active`. |
| Base branch = `main` | 🟢 | 100% | Live GitBook Git info points to `amoai-tech/ipixai/tree/main`. |
| Successful Git Sync operation | 🟢 | 100% | Latest GitBook operation completed successfully. |
| Protect `main` with modern GitHub ruleset | 🟢 | 100% | Active `main-protection` ruleset verified on GitHub. |
| Allow GitBook.com only as bypass actor | 🟢 | 100% | Ruleset contains GitBook.com integration bypass with `always` mode. |
| Keep required checks | 🟢 | 100% | `Supabase Preview` + `supabase-fresh-replay`; branch must be up to date. |
| Keep PR governance | 🟢 | 100% | PR required, 0 approvals, review conversations resolved, stale/latest-push approval options off. |
| Canonical mapping = `./docs/ipix-platform` | 🟢 | 100% | Cleanup branch restores `key: ipix-platform`, `path: docs`, and `content.directory: ./docs/ipix-platform`. |
| Remove GitBook-exported duplicate tree | 🟢 | 100% | Cleanup branch deletes the 23-file root `ipix-platform-docs/` export and keeps `docs/ipix-platform/`. |
| Prove GitHub PR merge → automatic GitBook import | 🟢 | 100% | PR #249 merge was imported automatically from `main` and live Platform Architecture readback matched `docs/ipix-platform/`. |

## Documentation coverage

| Documentation area | Status | Complete | Proof / next action |
| --- | --- | ---: | --- |
| Core docs: README / PRD / ROADMAP / SITEMAP / index / best practices / SUMMARY | 🟢 | 100% | Present locally and on GitHub `main`; published in GitBook navigation. |
| Documentation standards | 🟢 | 100% | `00-platform/DOC-STANDARDS.md` exists and is published. |
| CopilotKit | 🟢 | 100% | `01-copilotkit/README.md` exists and is published. |
| Mastra | 🟢 | 100% | `02-mastra/README.md` exists and is published. |
| Cloudinary | 🟢 | 100% | Hub + PRDs + contract + operations/reuse docs exist; hub is published. |
| Development / GitBook / PR review / Linear | 🟢 | 100% | Development and Linear docs exist and are published. |
| Architecture decisions | 🟢 | 100% | ADR index + ADR 001–004 exist and are published. |
| Reference index + competitor references | 🟢 | 100% | Reference docs exist and are published. |
| Brands | 🟢 | 100% | `10-brands/README.md` + `BRANDS.md` exist; Brands hub is published. |
| Onboarding | 🔵 | 0% | Folder contains only `.gitkeep`; create an audited onboarding domain doc. |
| Shoots | 🔵 | 0% | Folder contains only `.gitkeep`; create `30-shoots/SHOOTS.md` next. |
| Assets | 🔵 | 0% | Folder contains only `.gitkeep`; create `40-assets/ASSETS.md`. |
| CRM | 🔵 | 0% | Folder contains only `.gitkeep`; create `50-crm/CRM.md`. |
| Operations | 🔵 | 0% | Folder contains only `.gitkeep`; create `60-operations/OPERATIONS.md`. |
| Analytics | 🔵 | 0% | Folder contains only `.gitkeep`; create `70-analytics/ANALYTICS.md`. |
| Plans | 🔵 | 0% | Folder contains only `.gitkeep`; create `80-plans/PLANS.md`. |
| Shared platform architecture | 🟢 | 100% | PR #249 merged at `8086de52a2579cd7828c64eedb9e6635bb65e853`; clean-main docs check passed and GitBook imported/read back `00-platform/IPIX-PLATFORM-ARCHITECTURE.md`. |
| Shared AI feature pattern | 🟡 | 95% | PR #251 implements `00-platform/IPIX-AI-FEATURE-PATTERN.md` and links it from navigation/standards; merge to `main` plus live GitBook import/readback will complete verification. |
| Global reuse matrix | 🔵 | 0% | Planned `00-platform/IPIX-GLOBAL-REUSE-MATRIX.md` is not present. |

## Immediate blockers / fixes

| Priority | Status | Problem | Fix |
| ---: | --- | --- | --- |
| 1 | 🟢 | GitBook export duplicated the curated docs into root `ipix-platform-docs/`. | Cleanup branch deletes only the exported duplicate tree and keeps `docs/ipix-platform/` as the durable source. |
| 2 | 🟢 | GitBook rewrote `gitbook-docs.yaml` to `./ipix-platform-docs`. | Cleanup branch restores `key: ipix-platform`, `path: docs`, and `content.directory: ./docs/ipix-platform`. |
| 3 | 🟢 | GitBook export modified root `AGENTS.md` and `CLAUDE.md`. | Cleanup branch reverts only the GitBook-generated instruction blocks; future sync remains import-first. |
| 4 | 🟢 | Automatic GitHub → GitBook import is proven. | PR #249 merge imported successfully and live readback matched the canonical docs source. |
| 5 | 🟢 | Progress tracker navigation is wired locally. | `SUMMARY.md` and `index-docs.md` now link `progress-tracker.md`; publish these changes through the cleanup/docs PR. |
| 6 | 🔵 | Seven product-area docs are missing. | Work in dependency order: Shoots → Assets → CRM → Operations → Analytics → Plans; audit Onboarding in parallel where useful. |


## Validation evidence

| Check | Status | Result |
| --- | --- | --- |
| Curated tree local links | 🟢 | 0 broken local links under `docs/ipix-platform/`. |
| `git diff --check` for curated docs | 🟢 | Passed. |
| Repo-wide docs check | 🔴 | 165 broken links remain outside the curated `docs/ipix-platform/` tree; this is a separate repository documentation-cleanup problem. |
| Cleanup branch canonical tree | 🟢 | `docs/ipix-platform/` exists, root `ipix-platform-docs/` is absent, and the config points to the curated tree. |
| GitBook live space | 🟢 | Core/platform/Brands/development/ADR/reference pages are readable in the live space. |
| GitBook sync | 🟢 | Installation active; latest operation succeeded. |
