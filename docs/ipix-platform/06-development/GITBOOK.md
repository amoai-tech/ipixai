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

Keep the canonical product files at the top of `docs/`:

```text
docs/
├── README.md
├── prd.md
├── sitemap.md
├── roadmap.md
├── index-docs.md
├── gitbook.md
├── architecture/
├── adr/
├── cloudinary/
├── copilotkit-mastra/
├── data/
├── supabase/
├── testing/
├── reference/
└── archive/
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

For the Free plan, use **one GitBook space** synced to `./docs`.

```text
iPix Docs
└── iPix Documentation
    └── content.directory: ./docs
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
      key: space-ipix-docs
      title: iPix Documentation
      path: docs
      default: true
      content:
        directory: ./docs
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
git diff -- docs/
```

Then verify after merge:

1. GitBook Git Sync completed successfully.
2. Navigation is clear and shallow.
3. Links work.
4. The published page matches the merged Markdown.
5. No obsolete duplicate page is presented as current truth.

## Official references

- Documentation structure best practices: https://gitbook.com/docs/guides/docs-best-practices/documentation-structure-tips
- Publishing docs in GitBook: https://gitbook.com/docs/guides/editing-and-publishing-documentation/complete-guide-to-publishing-docs-gitbook
- GitBook CLI: https://gitbook.com/docs/docs-as-code/gitbook-cli
- Git Sync overview: https://www.gitbook.com/features/git-sync

## iPix decision

Use GitBook as the publishing and retrieval layer, not as a second source of truth.

```text
GitHub docs/ → review → merge → Git Sync → GitBook
```

This keeps the documentation cheap, reviewable, AI-friendly, and aligned with the actual iPix codebase.
