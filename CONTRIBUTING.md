# Contributing

Canonical repository: [amoai-tech/ipixai](https://github.com/amoai-tech/ipixai).

## Local development

1. `npm ci`
2. Secrets — Infisical is canonical (see `AGENTS.md` § Secrets / Infisical; needs `infisical login` once). Run servers **separately**:
   - `infisical run --env=dev -- npm run dev:ui` — Next.js on port 3000
   - `infisical run --env=dev -- npm run dev:agent` — Mastra on port 4111

   No Infisical session? Fallback: copy `.env.example` to `.env`, set local keys (never commit `.env`), then run `npm run dev:ui` / `npm run dev:agent` without the wrapper.
3. Do not run combined `npm run dev` (blocked until DEV-STAB-001 is fixed).
4. Do not run `npm run build` while either dev server is up.

## Pull requests

- One concern per PR and per commit.
- Prefer squash merge.
- CI must pass (`npm ci` + `npm run build`).
- Do not import the old `/home/sk/ipix` Worker/Mastra tree unless a current failure proves it is required.

See `AGENTS.md` for agent-facing conventions.
