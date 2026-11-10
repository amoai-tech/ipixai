# CopilotKit Generative UI — iPix decision guide

Current official docs include controlled Tool/State Rendering, native **Components and Surfaces (A2UI 1.0)**, legacy **A2UI v0.9** and MCP Apps. They serve different needs. For iPix, choose the smallest **trusted** display that fits the artifact, never a model-generated execution capability.

Official sources:
- https://docs.copilotkit.ai/mastra/generative-ui/tool-rendering
- https://github.com/CopilotKit/CopilotKit/tree/main/examples/showcases/generative-ui

## iPix default

```text
Existing backend tool needs custom display → useRenderTool
New render-only component/tool → useComponent
Stable typed business artifact → controlled React component + validated data
Shared-state artifact → State Rendering / useAgent state pattern when justified
Dynamic configurable layout → consider A2UI only when the product truly needs model-selected layout
External embedded interactive surface → MCP Apps only for an explicit integration need
```

Examples of stable iPix artifacts: `ShootPlan`, Brand DNA evidence, deliverables plan, budget estimate, booking quote, campaign brief, approval diff.

**PLAN-001 default:** controlled React Generative UI, not A2UI. iPix owns component structure, accessibility, validation, permissions, and actions; the agent supplies typed data.

## Native Components and Surfaces — optional after runtime upgrade

**Experimental target, not already enabled:** [IPI-1389](https://linear.app/amo100/issue/IPI-1389) upgrades CopilotKit/AG-UI, [IPI-1386](https://linear.app/amo100/issue/IPI-1386) certifies the combined runtime, then [IPI-1387](https://linear.app/amo100/issue/IPI-1387) may implement the **first read-only native GenUI surface**. Never infer that a 1.85 catalog API is available in the 1.73.3 baseline.

**Reference — ADAPT:** https://docs.copilotkit.ai/generative-ui/components/catalogs → [Catalogs + Standard UI](generative-ui/catalogs-and-standard.md). For cards, charts and tables use a small typed `createGenerativeUI` catalog, verified server DTOs, and explicitly allowed components. The 69-piece `standardUI` catalog is reusable, not permission to enable all controls.

**Reference — ADAPT:** https://docs.copilotkit.ai/generative-ui/components/surfaces → [Surfaces](generative-ui/surfaces.md). A named `GenerativeUISurface` can show authorized campaign comparisons in a workspace panel with a native fallback; do not create another provider or trust a client surface ID as tenant authority.

**Reference — MODEL:** https://www.copilotkit.ai/ag-ui-and-a2ui → [AG-UI + A2UI boundary](generative-ui/a2ui-and-dynamic-schema.md). AG-UI carries messages/tools/UI events; A2UI describes an allowlisted UI tree. Use native A2UI **1.0** only with verified installed exports. The old `@copilotkit/a2ui-renderer`, `createCatalog`, and `a2ui={{ catalog }}` examples target **v0.9** and do not implement native Components and Surfaces. Dynamic-schema A2UI uses a secondary model and is a deferred advanced experiment, not the first read-only IPI-1387 scope.

**Safety gate:** The agent may select a read-only view, but exact ShootPlan approval, asset publishing, payments, data mutation and deletion require existing human review and a server-authorized idempotent action. Fall back on invalid props, unsupported components, unexpected protocol version, Stop, or tenant/Brand switch.
