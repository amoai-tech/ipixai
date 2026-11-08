# Advanced Trace Query Reference

Use `mastra api trace query` when a normal trace list cannot express the required filters: recursive boolean predicates, related **span** conditions, metadata filters, ordering, or opaque cursor pagination. The current official query contract does not list related score or feedback predicate collections.

For broad questions about recurring agent behavior or health, start with supported `trace list`/metrics and, **only if Mastra Platform Trace Intelligence is configured**, [`trace-intelligence.md`](trace-intelligence.md). Use advanced trace queries for exact traces matching explicit conditions, then inspect the returned traces for evidence.

## Command contract

The command sends `POST /api/observability/traces/query` to the selected API target. Verify the actual URL, authorization, and observability store: local iPix uses `npm run dev:agent` on `:4111`; Mastra Platform targets and regional hosts are separate services. Never assume that a hosted default is iPix production.

The inline JSON input is required. Before recommending the command, confirm that the installed CLI exposes it:

```bash
npx --no-install mastra api trace query --help
```

After confirming availability, inspect the target server's current contract:

```bash
npx --no-install mastra api trace query --schema
```

Use `--schema` to confirm that the target supports the route and to inspect the current request and response shape and structural constraints. Predicate paths are generic strings in the schema, so it does not provide the context-specific field/operator matrix. If you need more information, read the [official advanced-query reference](https://mastra.ai/reference/observability/tracing/advanced-queries). A route in the schema does not prove the configured store supports it. Do not infer unsupported predicates from storage columns, older skill text, or CLI examples. The server and store capability flags are the ultimate validation authority.

## Query workflow

1. Run `trace query --help` and verify that the installed CLI exposes the command.
1. Run `trace query --schema` against the intended target to inspect the route contract and structural constraints.
1. Build the smallest query that answers the question. `timeRange` is required; `from` is inclusive and `to` is exclusive.
1. Keep `page.limit` small while exploring and project lightweight results with `jq`.
1. If `data.page.next` is non-null, repeat the identical query with that value in `page.after`.
1. Use `trace get` or `trace span` to inspect evidence for selected trace IDs.

Query a time range:

```bash
npx --no-install mastra api trace query \
  '{"timeRange":{"from":"2026-08-01T00:00:00.000Z","to":"2026-08-08T00:00:00.000Z"},"page":{"limit":25}}' \
  | jq '{traces: [.data.traces[] | {traceId, entityName, status, startedAt}], next: .data.page.next}'
```

Find traces containing a failed tool call. Conditions inside one `spans.some` clause must match the same span:

```bash
npx --no-install mastra api trace query \
  '{"timeRange":{"from":"2026-08-01T00:00:00.000Z","to":"2026-08-08T00:00:00.000Z"},"where":{"spans":{"some":{"op":"and","args":[{"op":"eq","left":{"path":"spanType"},"right":{"literal":"tool_call"}},{"op":"exists","path":"error"}]}}},"page":{"limit":25}}' \
  | jq '{traces: .data.traces, next: .data.page.next}'
```

## Pagination

The query response remains nested under `data` so the pagination cursor is preserved:

```json
{
  "data": {
    "traces": [],
    "page": { "next": "opaque-cursor" }
  }
}
```

Pass a non-null cursor back without decoding or modifying it:

```bash
npx --no-install mastra api trace query \
  '{"timeRange":{"from":"2026-08-01T00:00:00.000Z","to":"2026-08-08T00:00:00.000Z"},"page":{"limit":25,"after":"<page.next>"}}'
```

A cursor is bound to the accepted query and ordering. Do not change the time range, predicates, or ordering between pages. A mismatched cursor returns `409`; a malformed cursor returns `400`.

## Predicate semantics

- Compose predicates with `and`, `or`, and `not`.
- Use `some` when one related record must satisfy the complete nested predicate.
- Use `none` when no related record may satisfy the complete nested predicate. Traces with no related records also match `none`.
- Related span clauses correlate records by trace. Separate `spans.some` clauses may match different spans; group conditions into one clause when they must match the same span.
- String comparisons are exact and case-sensitive unless the canonical documentation states otherwise.
- The root `timeRange` filters the selected root span's start time; it does not independently constrain related-record timestamps.
- Query results are lightweight and do not embed matching spans. Fetch trace or span details after selecting candidates.

## Newer official observability operations — gated, not the installed iPix default

The [official Mastra 2.5.0 trace reference](https://github.com/mastra-ai/skills/blob/3020257c173e40f3a49ae6a67d46557fa771e0d4/skills/mastra/references/trace-query.md) adds **span query**, **trace aggregation**, **span aggregation**, numbered trace pages, delta polling, and capability-aware field filters. These are useful concepts, but the installed iPix `mastra` CLI (1.31.3 at this audit) exposes `api trace query` and **does not expose** `api span query` or aggregation subcommands. Do not advise those commands as executable on the current pin.

| Question | Preferred operation *when supported* | Proof before running |
| --- | --- | --- |
| Which Planner requests include a failed tool? | `trace query` | Installed `trace query --help`, target `--schema`, and store support |
| Which individual nested tool calls failed? | `span query` | Newer installed CLI plus `spanQuery` capability |
| What is the error rate or p95 latency by agent? | `trace aggregate` | Newer installed CLI plus `traceAggregate` capability |
| Which nested tool produces most errors? | `span aggregate` | Newer installed CLI plus `spanAggregate` capability |

For a newer server, check `GET /api/observability/capabilities` with appropriate auth or the installed client SDK's `getObservabilityCapabilities()`. Missing/false flags mean unavailable; a CLI subcommand alone is not enough. Span queries use direct span fields, not `spans.some`; aggregates return groups rather than paginated records. Do not turn missing cost data into $0 or assume missing outcomes mean success. Check privacy, tenant scope, and trace retention before querying real user data.

The official [advanced-query API](https://mastra.ai/reference/observability/tracing/advanced-queries) is **REFERENCE ONLY** for features not proven on the iPix runtime. An unsupported operation is not a reason to upgrade Mastra packages during unrelated debug work. Prefer the existing `trace list` or `trace query` path, or report the requested analysis as unavailable.

## Choosing the trace command

- `trace list`: browse recent traces with simple list filters.
- `trace query`: select completed traces using complex, explicit predicates (supported by the installed iPix CLI; verify the server/store).
- `trace get <traceId>`: inspect one selected trace.
- `trace span <traceId> <spanId>`: fetch one span in full.
- Newer `span query`, `trace aggregate`, `span aggregate`: use only when the installed CLI **and** target store advertise support.
- Trace Intelligence: optional platform capability for recurring themes, not evidence of a supported local aggregation command.

Advanced queries only return completed traces. The configured observability store must support the query API. If the server rejects a query that follows the current structural schema and canonical documentation as unsupported, report that limitation rather than falling back to an inaccurate client-side approximation.
