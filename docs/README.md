# iPix documentation

This is the GitHub-native documentation home for iPix. Use these files for current product and architecture truth; use Linear for live execution status.

| Need | Current source |
|---|---|
| Product requirements | [prd.md](./prd.md) |
| Routes and phases | [sitemap.md](./sitemap.md) |
| Now → Next → Later | [roadmap.md](./roadmap.md) |
| Current task status / blockers | [Linear v2-ipix](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues) |
| Architecture decisions | [adr/README.md](./adr/README.md) |
| AI runtime | [copilotkit-mastra/README.md](./copilotkit-mastra/README.md) |
| Data / Supabase | [data/README.md](./data/README.md) |
| Media / Cloudinary | [cloudinary/README.md](./cloudinary/README.md) |
| Documentation map | [docs-index.md](./docs-index.md) |
| Historical evidence | [archive/README.md](./archive/README.md) |

## Source-of-truth order

When documentation conflicts, prefer:

1. live runtime / current repository and installed types;
2. `docs/prd.md` + `docs/sitemap.md`;
3. accepted ADRs;
4. living domain READMEs and technical contracts;
5. Linear for status, ownership, and blockers;
6. `docs/archive/` only as historical evidence.


## Execution ownership

| Belongs in Markdown | Belongs in Linear |
|---|---|
| Architecture and accepted decisions | Active tasks and sequencing |
| Durable product requirements | Current completion percentages |
| Setup and operational runbooks | Current blockers and assignees |
| Stable technical contracts | Current implementation status |

## Rules

- Do not use Markdown as a second task tracker; Linear owns live task state.
- Keep one current entry point per domain and archive dated plans/audits when they stop being authoritative.
- Current technical claims should cite code, installed types, tests, or an accepted ADR where practical.
- Historical files stay readable under `docs/archive/`, but they are not implementation authority.
- Run `npm run docs:check` after changing active documentation. The check also prevents removed Mintlify files and fully archived top-level docs trees from being recreated.

Repository: https://github.com/amoai-tech/ipixai
