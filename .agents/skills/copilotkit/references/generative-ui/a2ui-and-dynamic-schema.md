# AG-UI, A2UI 1.0 and dynamic-schema examples — choose the correct engine

**Scope:** [IPI-1387](https://linear.app/amo100/issue/IPI-1387) version-gated read-only work. **Do not** combine the A2UI v0.9 demo API with the new experimental A2UI 1.0 Components and Surfaces engine.

`AG-UI` transports agent↔frontend messages, tools, state and UI operations. `A2UI` is the *declarative specification of what UI to render*. CopilotKit renders components from an allowed catalog; an AI response is not a permission to execute arbitrary React code.

| Approach | Appropriate iPix use |
| --- | --- |
| Controlled React/tool rendering | **Keep** for exact Shoot Plan, review/approval and stable business artifacts |
| Native Components and Surfaces (A2UI 1.0) | After IPI-1386, trial read-only cards/tables in the workspace |
| Legacy `@copilotkit/a2ui-renderer` / `createCatalog` / `a2ui={{ catalog }}` | **Historical v0.9**, not the 1.0 implementation |
| Dynamic-schema A2UI demo | **Defer**: secondary LLM generates schema and content, increasing variability, model usage and validation surface |

## Step 1 — Preserve the AG-UI transport and use typed A2UI 1.0

**Destination (future app task):** `src/lib/copilotkit/ipix-generative-ui.tsx` and existing `src/components/operator-panel/operator-panel.tsx`. Change `src/app/api/copilotkit/[[...slug]]/route.ts` only if the *installed 1.85 types and real integration tests* prove server changes necessary.

**Reference — MODEL**
- URL: https://www.copilotkit.ai/ag-ui-and-a2ui
- Source: `One describes the UI. The other moves it.`
- URL: https://docs.copilotkit.ai/generative-ui/a2ui
- Source: `What is A2UI` and legacy fixed/dynamic setup patterns.
- Use: let the existing Mastra/CopilotKit AG-UI bridge transport safe catalog operations.
- Do not copy: standalone demo routes, a second agent/provider or model-generated executable code.
- Apply to: one authenticated Production Copilot and read-only display.
- Verify: versioned protocol/event compatibility, malformed payload fallback, tenant isolation and exact Stop/replay preservation.
- **Checkpoint:** PASS when UI descriptions and transport remain separate and model outputs cannot bypass the trusted catalog.

## Step 2 — Correct the legacy-to-native 1.0 migration

**Reference — ADAPT**
- URL: https://docs.copilotkit.ai/generative-ui/components/from-a2ui
- Source: `Before and after`, `Convert a custom catalog` and `Bindings and actions`.
- URL: https://github.com/CopilotKit/CopilotKit/blob/814af9b33ff8a76c340d78c6bf2b80f5efca0fd8/packages/react-core/src/v2/generative-ui/index.ts
- Source: `createGenerativeUI`, `standardUI`, `GenerativeUISurface` exports.
- Use: A2UI 1.0: `createGenerativeUI`, `generativeUI={{ ui: appUI }}`, typed `GenerativeUISurface`. The 1.0 docs say the model receives `render_ui` on a run with a catalog; the old `runtime.a2ui` option is not required for that new path.
- Do not copy: v0.9 `@copilotkit/a2ui-renderer`, `createCatalog` or `a2ui={{ catalog: myCatalog }}` into the native 1.0 foundation; do not create `/api/copilotkit-declarative-gen-ui`.
- Apply to: keep old `references/a2ui-renderer.md` visible only as **legacy A2UI v0.9** documentation.
- Verify: exact installed 1.85 package exports and accepted/rejected 1.0 operations in focused tests.
- **Checkpoint:** STOP if source/docs and installed package behavior conflict. Never mix wire formats or silently add a new runtime.

## Step 3 — Treat dynamic schema as advanced, optional research

**Reference — REFERENCE ONLY**
- URL: https://docs.copilotkit.ai/generative-ui/a2ui/dynamic-schema
- Source: `Dynamic Schema A2UI` showcases a **secondary model** generating schema/layout/data. Its demo snippet uses `createCatalog`, `a2ui` provider config and a separate example endpoint, reflecting the older recipe.
- Use: research flexible campaign analytics dashboards when a fixed standard catalog cannot meet a real user need.
- Do not copy: arbitrary model-generated schemas as authorization, dynamic JSX execution, arbitrary component names, a second LLM handling customer data without review, or direct publish/payment tool handlers.
- Apply to: a separately approved advanced GenUI task **after** the read-only IPI-1387 foundation.
- Verify: security/privacy, per-tenant approved data, catalog/schema bounds, output size/time/cost limits, malformed input fallback, accessibility, server-side authorization on consequential actions.
- **Checkpoint:** DEFER unless need, exact version support, cost, rollback and safe behavior are demonstrated.

**Rule:** A2UI may present an interactive view; it does not become the app's authorization, persistence or HITL approval layer. Human reviews exact artifacts, server revalidates and executes authorized idempotent actions.
