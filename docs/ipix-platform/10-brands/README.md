# Brands

Brands is the iPix product area for browsing brand records, running Brand Intelligence, reviewing AI-generated research, and approving durable **Brand DNA**.

## Canonical documentation

Read [BRANDS.md](./BRANDS.md) for the evidence-backed current state, user journeys, reuse map, architecture, implementation phases, tests, and references.

## Current verified implementation

- Brands list route: `src/app/app/brands/page.tsx`.
- Brand detail route: `src/app/app/brands/[brandId]/page.tsx`.
- Brand actions: `src/app/app/brands/[brandId]/actions.ts`.
- Durable Brand Intelligence workflow: `src/mastra/workflows/brand-intelligence.ts`.

## Product rule

AI may research and draft Brand DNA, but approval is a human decision. Current code/runtime and tests override stale planning documents; Linear owns live task status.
