# Advanced Trace Query Reference

Use `mastra api trace query` when a normal trace list cannot express the required filters: recursive boolean predicates, related span conditions, metadata filters, ordering, or opaque cursor pagination. Old Core 1.71 / Client 1.50 examples document score/feedback filters, but these are not verified on the current iPix runtime. Verify the installed server/store before choosing any version-specific filter.

For broad questions about recurring agent behavior or health, start with supported `trace list`/metrics and, **only if Mastra Platform Trace Intelligence is configured**, [`trace-intelligence.md`](trace-intelligence.md). Use advanced trace queries for exact traces matching explicit conditions, then inspect the returned traces for evidence.

## Command contract

The command sends `POST /api/observability/traces/query` to the selected API target. Verify the actual URL, authorization, and observability store: local iPix uses `npm run dev:agent` on `:4111`; Mastra Platform targets and regional hosts are separate services. Never assume that a hosted default is iPix production.

The inline JSON input is required. Before recommending the command, confirm that the installed CLI exposes it:

```bash
npx --no-install mastra api --url http://localhost:4111 trace query --help
```

After confirming availability, inspect the target server's current contract:

```bash
npx --no-install mastra api --url http://localhost:4111 trace query --schema
```

For an authorized **local iPix** server, use `--schema` to inspect the request/response shape and structural constraints. **Mastra Platform does not expose this schema endpoint**: when the authorized target is Platform, consult the official [Request fields](https://mastra.ai/reference/observability/tracing/advanced-queries#request-fields) and [Fields and operators](https://mastra.ai/reference/observability/tracing/advanced-queries#fields-and-operators) instead. This documentation fallback explains query syntax; it does **not** establish that the target's observability store supports trace or span queries. Check `GET /api/observability/capabilities` independently before any query. Predicate paths are generic strings in the schema, so it does not provide the context-specific field/operator matrix. If you need more information, read the [official advanced-query reference](https://mastra.ai/reference/observability/tracing/advanced-queries). A route in the schema does not prove the configured store supports it. Do not infer unsupported predicates from storage columns, older skill text, or CLI examples. The server and store capability flags are the ultimate validation authority.

## Query workflow

1. Run `trace query --help` and verify that the installed CLI exposes the command.
1. For local iPix, inspect `trace query --schema` with explicit `--url http://localhost:4111`; for authorized Mastra Platform targets without that endpoint, read the published Request fields / Fields and operators documentation instead.
1. Build the smallest query that answers the question. `timeRange` is required; `from` is inclusive and `to` is exclusive.
1. Keep `page.limit` small while exploring and project lightweight results with `jq`.
1. If `data.page.next` is non-null, repeat the identical query with that value in `page.after`.
1. Use `trace get` or `trace span` to inspect evidence for selected trace IDs.

Query a time range:

```bash
npx --no-install mastra api --url http://localhost:4111 trace query \
  '{"timeRange":{"from":"2026-08-01T00:00:00.000Z","to":"2026-08-08T00:00:00.000Z"},"page":{"limit":25}}' \
  | jq '{traces: [.data.traces[] | {traceId, entityName, status, startedAt}], next: .data.page.next}'
```

Find traces containing a failed tool call. Conditions inside one `spans.some` clause must match the same span:

```bash
npx --no-install mastra api --url http://localhost:4111 trace query \
  '{"timeRange":{"from":"2026-08-01T00:00:00.000Z","to":"2026-08-08T00:00:00.000Z"},"where":{"spans":{"some":{"op":"and","args":[{"op":"eq","left":{"path":"spanType"},"right":{"literal":"tool_call"}},{"op":"exists","path":"error"}]}}},"page":{"limit":25}}' \
  | jq '{traces: .data.traces, next: .data.page.next}'
```

## Historical score and feedback predicates — not certified on 1.84

Earlier Core 1.71 / Client JS 1.50 documentation included `scores.some` and `feedback.some`. This is **historical**, not evidence of compatibility with 1.84. Never use the following legacy request against an unverified target: check installed types, current schema and store capability first.

For a target that actually supports related-score queries, the documented structure is:

```json
{
  "timeRange": { "from": "2026-08-01T00:00:00.000Z", "to": "2026-08-08T00:00:00.000Z" },
  "where": { "scores": { "some": {
    "op": "and",
    "args": [
      { "op": "eq", "left": { "path": "scorerId" }, "right": { "literal": "factuality" } },
      { "op": "lt", "left": { "path": "score" }, "right": { "literal": 0.6 } }
    ]
  } } },
  "page": { "limit": 25 }
}
```

`feedback.some` follows the same related-record idea (see the installed client documentation for accepted fields). Keep every condition that must describe one score or feedback row inside a **single** `some` clause. **Do not send this example automatically:** timestamps are historical placeholders and the selected target's observability data, permissions, store capabilities, and filters must be verified. The installed SDK/type evidence is not a successful live query.

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
npx --no-install mastra api --url http://localhost:4111 trace query \
  '{"timeRange":{"from":"2026-08-01T00:00:00.000Z","to":"2026-08-08T00:00:00.000Z"},"page":{"limit":25,"after":"<page.next>"}}'
```

A cursor is bound to the accepted query and ordering. Do not change the time range, predicates, or ordering between pages. A mismatched cursor returns `409`; a malformed cursor returns `400`.

## Predicate semantics

- Compose predicates with `and`, `or`, and `not`.
- Use `some` when one related record must satisfy the complete nested predicate.
- Use `none` when no related record may satisfy the complete nested predicate. Traces with no related records also match `none`.
- Related `spans.some` clauses correlate records by trace; separate clauses can match different spans. The installed family additionally documents `scores.some` and `feedback.some`. Group conditions within a single related clause when they must match the same record, and verify the target supports each relation.
- String comparisons are exact and case-sensitive unless the canonical documentation states otherwise.
- The root `timeRange` filters the selected root span's start time; it does not independently constrain related-record timestamps.
- Query results are lightweight and do not embed related matching spans or score/feedback rows. Fetch authorized trace/span details or the corresponding scorer/feedback records after selecting candidates.

## Installed CLI 1.40.0 — queries and aggregates need server capabilities

All four commands exist in the installed CLI. Verify command syntax **without making a remote request**:

```bash
npx --no-install mastra api --url http://localhost:4111 trace query --help
npx --no-install mastra api --url http://localhost:4111 trace aggregate --help
npx --no-install mastra api --url http://localhost:4111 span query --help
npx --no-install mastra api --url http://localhost:4111 span aggregate --help
```

For the **explicitly authorized target**, check `GET /api/observability/capabilities` or installed `getObservabilityCapabilities()` before querying:

| Question | Command | Required capability |
| --- | --- | --- |
| Planner turns containing failed tools | `trace query` | `traceQuery` |
| Failed nested tool calls | `span query` | `spanQuery` |
| Error rates and p95 latency | `trace aggregate` | `traceAggregate` |
| Slowest individual tool spans | `span aggregate` | `spanAggregate` |

Use `--schema` only when the authorized server exposes it (local iPix). For Mastra Platform, use the published request-field documentation; **neither path substitutes for the independent capability check above**. A 501 means unsupported storage; a 422 can mean an unsupported field. Bound time ranges/limit, preserve opaque cursors, redact tenant data, and never assume an upstream Mastra Platform default URL is the iPix server. **Estimated trace cost is not provider billing; missing usage never means $0.**

**Reference — ADAPT:** [Mastra capabilities](https://mastra.ai/reference/observability/tracing/advanced-queries#check-capabilities) and [Mastra CLI](https://mastra.ai/reference/cli/mastra). Do not copy default hosted access or unsupported filters.

## Choosing the trace command

- `trace list`: browse recent traces with simple list filters.
- `trace query`: select completed traces using complex, explicit predicates (supported by the installed iPix CLI; verify the server/store).
- `trace get <traceId>`: inspect one selected trace.
- `trace span <traceId> <spanId>`: fetch one span in full.
- `span query`, `trace aggregate`, `span aggregate`: installed CLI 1.40.0 exposes these; still require target store support.
- Trace Intelligence: optional platform capability for recurring themes, not evidence of a supported local aggregation command.

Advanced queries only return completed traces. The configured observability store must support the query API. If the server rejects a query that follows the current structural schema and canonical documentation as unsupported, report that limitation rather than falling back to an inaccurate client-side approximation.
