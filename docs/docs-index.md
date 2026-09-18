# iPix documentation map

This file describes the current GitHub-native documentation structure after the P1 cleanup. It is a map, not a task tracker.

## Current sources of truth

| Area | Current document |
|---|---|
| Documentation home | [README.md](./README.md) |
| Product requirements | [prd.md](./prd.md) |
| Routes and phases | [sitemap.md](./sitemap.md) |
| Product roadmap | [roadmap.md](./roadmap.md) |
| Architecture decisions | [adr/README.md](./adr/README.md) |
| CopilotKit + Mastra | [copilotkit-mastra/README.md](./copilotkit-mastra/README.md) |
| Mastra runtime family | [mastra/runtime-family.md](./mastra/runtime-family.md) |
| Mastra Postgres contract | [mastra/db-001-matrix.md](./mastra/db-001-matrix.md) |
| Data / Supabase | [data/README.md](./data/README.md) |
| Forward migrations | [supabase/ipi-1040-forward-migrations.md](./supabase/ipi-1040-forward-migrations.md) |
| Schema reconciliation | [supabase/ipi-1161-reconciliation-deployment.md](./supabase/ipi-1161-reconciliation-deployment.md) |
| Cloudinary media | [cloudinary/README.md](./cloudinary/README.md) |
| Media requirements | [cloudinary/prd.md](./cloudinary/prd.md) |
| Cloudinary locked contract | [cloudinary/CONTRACT-1110-1112.lock.md](./cloudinary/CONTRACT-1110-1112.lock.md) |
| Engineering review guidance | [pr-review-guidelines.md](./pr-review-guidelines.md) |
| Linear task format | [linear/linear-format.md](./linear/linear-format.md) |

## Reference material

- `docs/mermaid/` contains maintained diagram guidance.
- `docs/screenshots/` and `docs/reference/` contain visual/competitive reference assets.
- `docs/cloudinary-environment.json` is environment evidence, not a source for secrets.

## Historical material

Superseded planning/audit documents live under [archive/README.md](./archive/README.md). The cleanup preserved their original hierarchy where practical.

P1 moved **142** historical files into `docs/archive/`: the **116** files already classified ARCHIVE in P0 plus **26** additional dated UPDATE/KEEP planning files that were no longer suitable as current documentation. Five superseded/generated files were removed after reference checks.

## Source-of-truth order

1. live runtime / current repository and installed types;
2. `docs/prd.md` + `docs/sitemap.md`;
3. accepted ADRs;
4. living domain READMEs and technical contracts;
5. Linear for live status and blockers;
6. `docs/archive/` only as historical evidence.

Run `npm run docs:check` after changing active documentation.
