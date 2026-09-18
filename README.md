# iPix

iPix is an AI-native operating system for fashion brands and production teams. This repository contains the Next.js operator application, CopilotKit/Mastra AI runtime, Supabase-backed domain workflows, and Cloudinary media integration.

## Start here

| Need | Source |
|---|---|
| Documentation home | [docs/README.md](docs/README.md) |
| Product requirements | [docs/prd.md](docs/prd.md) |
| Routes and phases | [docs/sitemap.md](docs/sitemap.md) |
| Architecture decisions | [docs/adr/README.md](docs/adr/README.md) |
| Durable roadmap | [docs/roadmap.md](docs/roadmap.md) |
| Live execution status, blockers, sequencing | [Linear v2-ipix](https://linear.app/amo100/project/v2-ipix-cd2f90b58cd2/issues) |
| Documentation map | [docs/docs-index.md](docs/docs-index.md) |

**Repository:** https://github.com/amoai-tech/ipixai

## Development

```bash
npm ci
npm run dev:ui      # Next.js UI on :3000
npm run dev:agent   # Mastra on :4111, only when needed
```

Run the UI and agent in separate terminals. The combined `npm run dev` command is intentionally disabled while the watcher-stability issue remains open.

Useful verification commands:

```bash
npm run docs:check
npm run typecheck
npm test
npm run build
```

## Architecture boundaries

- Supabase/Postgres owns durable application truth and tenant-protected domain state.
- Mastra owns agents, tools, workflows, memory orchestration, and resumable AI execution.
- CopilotKit / AG-UI owns the interactive AI experience.
- Cloudinary owns image/video bytes, transformations, and delivery.
- Consequential writes follow: AI proposes → human reviews → approved action executes → system records the result.

For runtime details, setup contracts, and domain-specific guidance, use [docs/README.md](docs/README.md). Do not duplicate live task status in this README; Linear owns current execution state.
