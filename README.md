# CopilotKit <> Mastra Starter

Canonical repository: [amo-tech-ai/ipix](https://github.com/amo-tech-ai/ipix). Default branch: `main`.

This is a starter template for building AI agents using [Mastra](https://mastra.ai) and [CopilotKit](https://copilotkit.ai). It provides a modern Next.js application with integrated AI capabilities and a beautiful UI.

## Prerequisites

- Node.js 18+
- Any of the following package managers:
  - npm (default)
  - [pnpm](https://pnpm.io/installation)
  - [yarn](https://classic.yarnpkg.com/lang/en/docs/install/)
  - [bun](https://bun.sh/)

## Getting Started

1. Add your OpenAI API key

```bash
# you can use whatever model Mastra supports
echo "OPENAI_API_KEY=your-key-here" >> .env
```

2. Install dependencies using your preferred package manager:

```bash
# Using npm (default)
npm install

# Using pnpm
pnpm install

# Using yarn
yarn install

# Using bun
bun install
```

3. Start the development servers **separately** (combined `npm run dev` is disabled until DEV-STAB-001 is fixed — it forked thousands of Node processes and OOM-killed the machine):

```bash
# Terminal A — Next.js UI on :3000
npm run dev:ui

# Terminal B — Mastra agent on :4111 (only when you need the agent)
npm run dev:agent
```

A guard refuses to start if that port is already listening. `npm run build` also refuses if `:3000` or `:4111` is in use. Do not run `npm run build` while either server is up.

## Running a Channel

`channel-host.mts` mounts the same agent as an Intelligence Channel
(Slack, Teams). It requires `CPK_INTELLIGENCE_API_KEY` and a declared Channel in
`.copilotkit/channels.json` — set both up with `copilotkit init` or
`copilotkit channels add`, which write that file and the credentials your
`.env` needs, then:

```bash
npm run channel
```

The host reads which Channel to hold from `.copilotkit/channels.json`. If a
project declares more than one, set `INTELLIGENCE_CHANNEL_NAME` to pick one.

The host holds no provider credentials and exposes no provider endpoint —
Intelligence owns the provider edge — so the same file works for every provider.

The Channel itself is declared in `channels.mts` — that is where to add commands,
reactions, or an `onMention` handler. `channel-host.mts` only owns the process
lifetime, and is byte-identical in every starter.

Once startup finishes, the log reports the truth per Channel:

- `Channel "<name>" is online.` — the session is up and can send.
- `Channel "<name>" is declared but no provider is attached yet.` —
  a normal waiting state, not a failure. Run `copilotkit channels status` to
  see what setup remains.

Neither message proves the provider app is installed, reachable, or that
anyone can message it — verify that separately (invite the bot, then message
it) before treating the Channel as working.

Unlike the other starters, this one has no `typecheck:channel` script: the
host's import chain reaches `src/mastra/**`, which carries a pre-existing
type error unrelated to the Channel host (see the comment in
`tsconfig.channel.json`).

## Available Scripts

The following scripts can also be run using your preferred package manager:

- `dev` - Disabled until DEV-STAB-001 (combined watcher storm). Use `dev:ui` / `dev:agent` separately.
- `dev:ui` - Starts only the Next.js UI server (`:3000`), refuses if the port is taken
- `dev:agent` - Starts only the Mastra agent server (`:4111`), refuses if the port is taken
- `dev:debug` - Starts the UI server with debug logging
- `build` - Builds the application for production. Refuses if `:3000` or `:4111` is already listening (do not build while a dev server is up).
- `start` - Starts the production server
- `channel` - Holds an Intelligence Channel open (see "Running a Channel" above)

## Documentation

- [Mastra Documentation](https://mastra.ai/en/docs) - Learn more about Mastra and its features
- [CopilotKit Documentation](https://docs.copilotkit.ai) - Explore CopilotKit's capabilities
- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## CopilotKit Intelligence & Threads (Optional)

CopilotKit Intelligence adds durable thread history and cross-session memory to
your agent. Two deployment modes exist — pick one per environment, don't mix
their credentials.

### Managed (recommended — what this starter's deployed environments use)

Hosted by CopilotKit; no local Docker stack. Provision the project key with
the CopilotKit CLI:

```bash
npx copilotkit project select --project <your-project>
```

This writes `CPK_INTELLIGENCE_API_KEY` into `.env` (gitignored). The runtime
(`src/app/api/copilotkit/[[...slug]]/route.ts`) and the Channel host
(`channel-host.mts`) both read `CPK_INTELLIGENCE_API_KEY` (`COPILOTKIT_API_KEY`
is the accepted alias) and switch into Intelligence mode automatically when it
is set — no `COPILOTKIT_LICENSE_TOKEN` needed. `COPILOTKIT_LICENSE_TOKEN` is a
**separate, offline/self-hosted-only** credential; do not set it for managed
mode, and never reuse a `ck_pub_...` Cloud public key as its value — that
combination previously produced `Invalid CopilotKit license token` even with a
valid project key.

Then start the dev server as usual (`npm run dev:ui`). Verify with:

`/api/copilotkit/*` (including `/info`) requires a verified Supabase session
and org membership — a bare `curl` gets `401`, not the fields below. Sign in
at `http://localhost:3000/login` first, then either:

- open `http://localhost:3000/api/copilotkit/info` in that same signed-in
  browser tab and read the JSON directly, or
- reuse the browser's session cookie:
  ```bash
  curl -s http://localhost:3000/api/copilotkit/info \
    -H "Cookie: $(pbpaste)" | jq '.mode, .licenseStatus'
  # "intelligence"
  # "valid"
  ```
  (copy the `Cookie` request header value from your browser's Network tab
  for any `/api/copilotkit/*` request; `pbpaste` is macOS — swap in your
  platform's clipboard tool, or paste the value directly).

### Self-hosted (Docker, alternative)

Runs your own local Intelligence stack instead of the managed platform.
Requires Docker Desktop, a local Intelligence repo checkout, and
`COPILOTKIT_LICENSE_TOKEN` (self-hosted licensing — a different credential
family from the managed `CPK_INTELLIGENCE_API_KEY` above; the two modes are
not interchangeable and should not both be configured at once).

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running
- A `COPILOTKIT_LICENSE_TOKEN` (obtain from [CopilotKit Cloud](https://cloud.copilotkit.ai))
- The [Intelligence repo](https://github.com/CopilotKit/Intelligence) cloned
  locally. The `docker-compose.intelligence.yml` defaults to a sibling
  directory at `../../../Intelligence` relative to this starter; override with
  the `INTELLIGENCE_REPO` env var if your checkout is elsewhere.

### Start the intelligence stack

```bash
# From inside this starter directory:
docker compose -f docker-compose.intelligence.yml up -d --wait
```

First run builds the intelligence image from source (may take several minutes).

### Verify the stack is healthy

```bash
docker compose -f docker-compose.intelligence.yml ps
```

All three services (`postgres`, `redis`, `intelligence`) should show `healthy`.

### Set environment variables

Add the following to your `.env` file:

```env
COPILOTKIT_LICENSE_TOKEN=your-license-token-here
INTELLIGENCE_API_URL=http://localhost:4204
INTELLIGENCE_GATEWAY_WS_URL=ws://localhost:4404
```

Then start the dev server as usual (`npm run dev`). Thread history and memory
features are activated automatically when `COPILOTKIT_LICENSE_TOKEN` is set.

### Stop / reset

```bash
# Stop without removing data:
docker compose -f docker-compose.intelligence.yml down

# Full reset (removes postgres + redis volumes):
docker compose -f docker-compose.intelligence.yml down -v
```
