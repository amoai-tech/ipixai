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
docker run --stop-timeout 300 -p 127.0.0.1:4111:4111 --env-file .env ipix-mastra    # container behind same-host HTTPS proxy
```

Direct entrypoint (what the image uses):

```bash
node .mastra/output/index.mjs
```

`MASTRA_HOST` defaults to `localhost` when unset. Inside a container that means
loopback-only, so the port is open but unreachable from the container network and every
healthcheck fails. `Dockerfile.agent` sets `MASTRA_HOST=0.0.0.0`. The manual Docker
command binds the host port to `127.0.0.1` so port 4111 is not exposed directly to
the Internet; terminate HTTPS in a same-host reverse proxy. On a managed container
platform, use its private service network and expose only the stable HTTPS origin.

The image also sets `IPIX_MASTRA_HOSTED=1`. That activates the existing
`src/mastra/pg-store.ts` fail-closed guard: a missing or unsafe
`MASTRA_DATABASE_URL` throws instead of silently using in-memory storage. Override
this only for deliberate local/container experiments; hosted Preview/Production
must keep it enabled.

## Required environment (server-only)

Set these on the Mastra host. They are **separate** from the Vercel app's
environment; the app does not need the Planner's model key for remote mode.

| Variable | Required | Why |
| --- | --- | --- |
| `MASTRA_DATABASE_URL` | yes (hosted) | Durable thread/memory storage in Supabase Postgres. |
| `IPIX_MASTRA_HOSTED=1` | yes (hosted) | Baked into `Dockerfile.agent`; on non-container hosts set it explicitly. It makes missing/unsafe Postgres configuration fail closed instead of using in-memory storage. |
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
| `GET /health` | public | **Liveness only.** `200` proves the process is answering; it does not prove Supabase auth/storage readiness. |
| `GET /api/agents` | Supabase JWT | Should be `401` without a token. |
| `POST /ipix/run-control/active` | Supabase JWT | Should be `401` without a token. |

Do not route/certify production traffic from `/health` alone. IPI-1308 owns the
stronger startup/readiness contract for required Supabase auth configuration;
authenticated endpoint checks below remain part of deployment certification.

## Restart and drain

On `SIGTERM` the generated server stops accepting connections, waits
`server.drainTimeout`, then runs `mastra.shutdown()`. `src/mastra/runtime.ts` sets
`drainTimeout: 240_000`.

A plain `agent.stream()` **cannot resume after the process exits**, so a short
drain permanently truncates a live operator turn. In the installed Mastra server,
HTTP draining can consume the full 240 seconds and core shutdown is then bounded
separately by another 5 seconds. Docker's default stop timeout is shorter than
that full shutdown envelope, so the documented container command uses
`--stop-timeout 300`. Configure the hosting platform's termination grace to
**at least 300 seconds** as well; otherwise Docker or the platform can still kill
the process after HTTP drain but before cleanup completes.

Active-run ownership is in-memory. A restart during an active run loses that
ownership even though thread data is durable in Postgres — the turn does not
resume and the operator must retry.

## Verify a deployment

```bash
BASE=https://<your-mastra-origin>

curl -s -o /dev/null -w '%{http_code}\n' "$BASE/health"                    # 200 liveness
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/agents"                # 401
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/workflows"             # 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type: application/json' --data '{"threadId":"deployment-check"}' "$BASE/ipix/run-control/active"   # 401
```

Then, with a real operator JWT, `GET /api/agents` must return `200`.

## Host checklist

- [ ] One instance only; autoscaling and replicas disabled.
- [ ] Stable HTTPS origin.
- [ ] Liveness check `GET /health`; do not treat this alone as readiness.
- [ ] Docker stop timeout and platform termination grace are both >= 300s (240s HTTP drain + bounded shutdown cleanup).
- [ ] `MASTRA_HOST=0.0.0.0`.
- [ ] All required env vars above set on the host.
- [ ] Public `GET /api/agents` returns `401`.

## Known gaps

1. **Privileged workflow authorization (IPI-1326).** The production
   `brand-intelligence` and `shoot-plan-review` workflows perform service-role
   operations. Supabase service-role bypasses RLS, so caller-supplied identity
   fields such as `actorId` / `stagedBy` cannot be authorization truth. IPI-1326
   owns deriving actor/org identity from authenticated Mastra `RequestContext`
   and proving Org B cannot execute as Org A. PR #252 is a separate Brand
   Intelligence golden-path change and must not be used to widen this deployment
   PR.
2. **Auth config fail-fast (IPI-1308).** `server-auth.ts` still reads the
   Next/browser-named Supabase variables and `/health` can be `200` while
   authenticated traffic is unusable. IPI-1308 owns server-only
   `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` and the stronger readiness gate.

PR #260 / IPI-1312 is merged on current `main`; the earlier `default` versus
`production-planner` agent-ID mismatch is no longer a blocker for this PR.
