# Standalone Mastra service deployment

**Task:** IPI-1310 · MASTRA-PROD-001 — deploy one long-running Mastra service and wire iPix production to it.

The Vercel app (`www.ipix.co`) does not run the Planner itself. It calls a
separate, long-running Mastra server through `MASTRA_BASE_URL`. This page covers
building, running, and operating that server.

## Why one instance — not serverless, not replicas

Exact-run Stop resolves the active Planner run **from the process that owns it**:

```text
src/mastra/run-control.ts
  findOwnedActiveRun()  -> agent.listActiveThreadRuns()
  abortOwnedActiveRun() -> agent.abortRunStream(runId)
```

Mastra's default PubSub is `EventEmitterPubSub`, which is **in-process**. Run the
service as two or more independent instances and instance B cannot see a run
started on instance A, so a Stop routed to B silently no-ops — the operator's
Stop button appears to do nothing. This is the exact failure PR #253 removed.

Reference: [Mastra server deployment](https://mastra.ai/docs/deployment/mastra-server) —
"Replaying missed events after a restart also requires a shared persistent cache
such as Redis… Multi-replica recovery doesn't yet use a distributed lease."

Therefore:

- **min instances = 1, max instances = 1.** Disable autoscaling.
- One stable HTTPS origin.
- Distributed run ownership (Redis Streams PubSub + leases) is explicitly **out of
  scope** for IPI-1310 and needs its own architecture task.

## Build

```bash
npm run build:agent          # -> .mastra/output (self-contained)
```

`.mastra/output` bundles the server, its own `node_modules`, and a lockfile, so it
can be copied to any Node host.

Container image (recommended — pins the runtime and the bind host):

```bash
docker build -f Dockerfile.agent -t ipix-mastra .
```

`Dockerfile.agent` is **not** the Next.js image; the root `Dockerfile` builds the
Vercel app.

## Run

```bash
npm run start:agent                                    # local, reads .env / .env.production
docker run -p 4111:4111 --env-file .env ipix-mastra    # container
```

Direct entrypoint (what the image uses):

```bash
node .mastra/output/index.mjs
```

`MASTRA_HOST` defaults to `localhost` when unset. Inside a container that means
loopback-only, so the port is open but unreachable from outside and every
healthcheck fails. `Dockerfile.agent` sets `MASTRA_HOST=0.0.0.0`.

## Required environment (server-only)

Set these on the Mastra host. They are **separate** from the Vercel app's
environment; the app does not need the Planner's model key for remote mode.

| Variable | Required | Why |
| --- | --- | --- |
| `MASTRA_DATABASE_URL` | yes (hosted) | Durable thread/memory storage in Supabase Postgres. |
| `IPIX_MASTRA_HOSTED=1` | yes (hosted) | Without it the service silently falls back to **in-memory** storage and threads do not survive restart. |
| `OPENAI_API_KEY` | yes | The Planner uses `openai("gpt-5.6-luna")` and the agent executes **on this host**. Missing key = every turn fails. Not listed in `.mastra/output/preflight-metadata.json`. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Bearer-token verification in `src/mastra/server-auth.ts`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Same. **IPI-1308 will rename these** to `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` and add startup fail-fast. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Used by the `brand-intelligence` workflow. Privileged and RLS-bypassing — see "Known gaps". |
| `SUPABASE_SECRET_KEYS` | optional | JSON `{"default": "<key>"}` fallback for the crawl-start key. |
| `PORT` | optional | Defaults to `4111`. |
| `MASTRA_HOST` | optional | Defaults to `localhost`; must be `0.0.0.0` in a container. |
| `LOG_LEVEL` | optional | `ConsoleLogger` level. |

`.dockerignore` excludes `.env` and `.env.*`, so secrets are never baked into the
image. Provide them at runtime.

## Health and readiness

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | public | Returns `200`. Use as the platform healthcheck. |
| `GET /api/agents` | Supabase JWT | Should be `401` without a token. |
| `POST /ipix/run-control/active` | Supabase JWT | Should be `401` without a token. |

## Restart and drain

On `SIGTERM` the generated server stops accepting connections, waits
`server.drainTimeout`, then runs `mastra.shutdown()`. `src/mastra/runtime.ts` sets
`drainTimeout: 240_000`.

A plain `agent.stream()` **cannot resume after the process exits**, so a short
drain permanently truncates a live operator turn. Keep the hosting platform's
termination grace period **at or above** `drainTimeout`, otherwise the platform
kills the process mid-drain and the setting has no effect.

Active-run ownership is in-memory. A restart during an active run loses that
ownership even though thread data is durable in Postgres — the turn does not
resume and the operator must retry.

## Verify a deployment

```bash
BASE=https://<your-mastra-origin>

curl -s -o /dev/null -w '%{http_code}\n' "$BASE/health"            # 200
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/agents"        # 401
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/workflows"     # 401
```

Then, with a real operator JWT, `GET /api/agents` must return `200`.

## Host checklist

- [ ] One instance only; autoscaling and replicas disabled.
- [ ] Stable HTTPS origin.
- [ ] Healthcheck `GET /health`.
- [ ] Restart policy enabled; termination grace >= `drainTimeout`.
- [ ] `MASTRA_HOST=0.0.0.0`.
- [ ] All required env vars above set on the host.
- [ ] Public `GET /api/agents` returns `401`.

## Known gaps

1. **Agent id mismatch.** `GET /api/agents` returns the agent keyed
   `production-planner` while the frontend resolves `default`. Planner chat fails
   to mount until [PR #260](https://github.com/amoai-tech/ipixai/pull/260) merges.
2. **`SUPABASE_SERVICE_ROLE_KEY` on a public-facing process.** The
   `brand-intelligence` workflow builds a service-role client, and
   `/api/workflows/*` is reachable by any authenticated operator. This bypasses
   RLS on a tenant-reachable route and needs its own task.
3. **Auth config fail-fast (IPI-1308).** `getPublicSupabaseConfig()` returns
   `null` silently, so a misconfigured host answers `401` to every request with no
   diagnostic and `/health` still reports `200`.
