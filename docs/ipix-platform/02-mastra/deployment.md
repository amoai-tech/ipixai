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
docker run --stop-timeout 300 -p 127.0.0.1:4111:4111 --env-file .env -e PORT=4111 ipix-mastra    # container behind same-host HTTPS proxy
```

Direct entrypoint (what the image uses):

```bash
node .mastra/output/index.mjs
```

`MASTRA_HOST` defaults to `localhost` when unset. Inside a container that means
the server is unreachable through the published host port, even though the internal healthcheck
probing `127.0.0.1` can still pass. `Dockerfile.agent` sets `MASTRA_HOST=0.0.0.0`. The
manual Docker command binds the host port to `127.0.0.1` so port 4111 is not exposed
directly to the Internet, and pins `PORT=4111` so `.env` cannot move the server away
from the mapped container port. Terminate HTTPS in a same-host reverse proxy. On a
managed container platform, use its private service network and expose only the stable
HTTPS origin.

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
| `SUPABASE_URL` | yes (hosted) | Server-owned Supabase Auth URL used to verify bearer tokens. Hosted mode requires HTTPS and fails before serving if missing/invalid. |
| `SUPABASE_PUBLISHABLE_KEY` | yes (hosted) | Publishable key used with the caller JWT so membership resolution stays under the authenticated/RLS role. Secret/service-role keys are rejected for this purpose. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Used only by privileged server workflows after authenticated user/org authorization. RLS-bypassing; keep server-only. |
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

Do not route/certify production traffic from `/health` alone. Hosted startup now
fails closed when `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` are missing or unsafe,
but authenticated endpoint checks below remain part of deployment certification.

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

Then set `TOKEN` to a real operator JWT and verify the production allowlist:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" "$BASE/api/agents"                              # 200
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" "$BASE/api/workflows"                           # 403
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' --data '{}' "$BASE/api/datasets"   # 403
```

## Host checklist

- [ ] One instance only; autoscaling and replicas disabled.
- [ ] Stable HTTPS origin.
- [ ] Liveness check `GET /health`; do not treat this alone as readiness.
- [ ] Docker stop timeout and platform termination grace are both >= 300s (240s HTTP drain + bounded shutdown cleanup).
- [ ] `MASTRA_HOST=0.0.0.0`.
- [ ] All required env vars above set on the host, including `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
- [ ] Public `GET /api/agents` returns `401`.
- [ ] Authenticated `GET /api/workflows` and `POST /api/datasets` return `403`.

## Closed security dependencies

PR #267 merged IPI-1308 + IPI-1326 into `main`. This branch now includes:

- hosted auth fail-fast using server-owned `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`;
- exact METHOD + path authorization for the four Planner HTTP routes;
- authenticated RequestContext user/org identity for privileged workflows;
- Org A / Org B authorization regression coverage.

The remaining release gate is operational: deploy one stable single-owner Mastra
service, wire Vercel Preview to it, and certify the real authenticated journey,
including exact-run Stop, stale-Stop safety, restart/drain, and rollback.

PR #260 / IPI-1312 is merged on current `main`; the earlier `default` versus
`production-planner` agent-ID mismatch is no longer a blocker for this PR.
