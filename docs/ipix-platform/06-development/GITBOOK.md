# iPix GitBook workflow

## Summary

iPix uses a docs-as-code model:

```text
Linear = live task/status truth
GitHub docs/ = durable documentation truth
GitBook = published documentation + navigation + MCP
Claude / ChatGPT / Codex = documentation assistants
```

**Best rule:** write and review documentation in GitHub first, then let GitBook Git Sync publish it.

## Recommended GitHub structure

GitBook publishes only the curated `docs/ipix-platform/` subtree:

```text
docs/ipix-platform/
├── README.md
├── SUMMARY.md
├── PRD.md
├── ROADMAP.md
├── SITEMAP.md
├── BEST-PRACTICES.md
├── architecture-decisions/
├── 00-platform/
├── 01-copilotkit/
├── 02-mastra/
├── 04-cloudinary/
├── 06-development/
├── 09-onboarding/
├── 10-brands/
├── 30-shoots/
├── 40-assets/
├── 50-crm/
├── 60-operations/
├── 70-analytics/
└── 80-plans/
```

## Organization rules

1. Organize around **what the reader is trying to do**, not around internal tools alone.
2. Keep one canonical page for each topic. Link to it instead of copying the same explanation into multiple files.
3. Keep hierarchy shallow: usually folder → page/subpage is enough. Avoid deep nesting.
4. Use clear H1–H4 headings, short sections, examples, and explicit cross-links.
5. Keep important facts in text, not only screenshots, so humans and AI can retrieve them.
6. Put historical plans and superseded audits in `docs/archive/`; do not mix them into current navigation.
7. Linear owns changing execution status; Markdown owns durable requirements, architecture, runbooks, and references.
8. Code, tests, runtime evidence, and accepted ADRs override stale documentation.

## iPix GitBook structure

Use **one GitBook space** synced to the curated `./docs/ipix-platform` directory unless a proven need requires another space.

```text
iPix Docs
└── iPix Documentation
    └── content.directory: ./docs/ipix-platform
```

Do not recreate separate GitBook spaces for Mastra, Supabase, Product Docs, Changelog, etc. unless there is a proven need. The repository folder hierarchy should do most of the organization.

The site structure is controlled by the root file:

```text
gitbook-docs.yaml
```

Current mapping:

```yaml
site:
  title: iPix Docs
  structure:
    - type: space
      key: ipix-platform
      title: iPix Platform Docs
      path: docs
      default: true
      content:
        directory: ./docs/ipix-platform
```

## Development workflow

Use the same review discipline for docs as code:

```text
Linear issue
→ implementation changes
→ update affected docs in the same branch/PR
→ run docs checks
→ review
→ merge to main
→ GitBook Git Sync
→ verify published page
```

Recommended PR rule:

> Any PR that materially changes architecture, user journeys, database contracts, agent/tool/workflow behavior, or public product behavior must update the affected `docs/**` files or explicitly state why no documentation change is required.

## GitBook CLI commands

GitBook CLI is for querying/managing GitBook and automation. It is **not** a docs preview server.

Install/check:

```bash
npm install -g @gitbook/cli
gitbook --version
gitbook whoami
```

Normal interactive authentication:

```bash
gitbook login
```

Token authentication for CI/scripts or integration publishing:

```bash
gitbook auth --token "$GITBOOK_API"
```

Do not print the token or commit it to Git.

Explore GitBook:

```bash
gitbook organizations list --json
gitbook spaces list --organization <organizationId> --json
gitbook spaces get <spaceId> --json
gitbook spaces content pages list <spaceId> --json
```

Inspect the iPix site:

```bash
gitbook organizations sites get EwHjYjyITtuB1aLae2qA site_wSg2e --json
gitbook organizations sites structure get EwHjYjyITtuB1aLae2qA site_wSg2e --json
gitbook organizations sites site-spaces list EwHjYjyITtuB1aLae2qA site_wSg2e --json
```

Ask the organization documentation a question:

```bash
gitbook organizations ask stream EwHjYjyITtuB1aLae2qA --query "How does iPix handle tenant isolation?"
```

Important: these commands are for GitBook integrations, not normal documentation editing:

```bash
gitbook integration new
gitbook integration dev
gitbook integration publish
```

For iPix documentation, prefer GitHub Markdown + Git Sync instead.

## Verification checklist

Before merging a docs change:

```bash
npm run docs:check --if-present
git diff --check
git diff -- docs/ipix-platform/
```

Then verify after merge:

1. GitBook Git Sync completed successfully.
2. Navigation is clear and shallow.
3. Links work.
4. The published page matches the merged Markdown.
5. No obsolete duplicate page is presented as current truth.

## Official references

- [GitBook documentation structure best practices](https://gitbook.com/docs/guides/docs-best-practices/documentation-structure-tips)
- [GitBook complete guide to publishing documentation](https://gitbook.com/docs/guides/editing-and-publishing-documentation/complete-guide-to-publishing-docs-gitbook)
- [GitBook CLI documentation](https://gitbook.com/docs/docs-as-code/gitbook-cli)
- [GitBook Git Sync overview](https://www.gitbook.com/features/git-sync)

## iPix decision

Use GitBook as the publishing and retrieval layer, not as a second source of truth.

```text
GitHub docs/ipix-platform/ → review → merge → Git Sync → GitBook
```

This keeps the documentation cheap, reviewable, AI-friendly, and aligned with the actual iPix codebase.
