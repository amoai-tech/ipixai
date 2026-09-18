# iPix documentation

Use this folder as a router to current truth, not as a second task tracker.

| Need | Source of truth |
|---|---|
| Product requirements | [prd.md](./prd.md) |
| Routes and phases | [sitemap.md](./sitemap.md) |
| Now → Next → Later | [roadmap.md](./roadmap.md) |
| Current task status / blockers | [Linear v2-ipix](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues) |
| Architecture decisions | [ADR 001](./adr/001-node-first.md) and the `adr/` folder |
| AI runtime | [copilotkit-mastra/index.md](./copilotkit-mastra/index.md) · [mastra/10-mastra-convert.md](./mastra/10-mastra-convert.md) |
| Data / Supabase | [data/index.md](./data/index.md) |
| Media / Cloudinary | [cloudinary/index.md](./cloudinary/index.md) |
| Full docs audit | [DOCS-INDEX.md](./DOCS-INDEX.md) |

## Source-of-truth rule

When documentation conflicts with implementation, prefer:

1. live runtime / current repository and installed types;
2. prd.md + sitemap.md;
3. accepted ADRs;
4. living domain docs;
5. Linear for status and blockers;
6. archived audits/plans only as historical evidence.

Historical migration plans and point-in-time audits are useful evidence, but they are not current architecture authority.

## Repository

https://github.com/amoai-tech/ipixai
