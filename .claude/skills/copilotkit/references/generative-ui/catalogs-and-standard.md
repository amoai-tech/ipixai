# CopilotKit catalogs and standard UI — iPix implementation guide

**Scope:** Reference for [IPI-1387](https://linear.app/amo100/issue/IPI-1387) *after* [IPI-1389](https://linear.app/amo100/issue/IPI-1389) and [IPI-1386](https://linear.app/amo100/issue/IPI-1386). Native Components and Surfaces (A2UI 1.0) is **experimental**. The baseline iPix CopilotKit 1.73.3 package does **not** establish that these 1.85 APIs are installed.

**Purpose:** Give AI an **allowlist of React components** and typed props, rather than model-generated React code. The agent selects a view, not the authorization to fetch/save data. For a fashion brand, an authorized Campaign tool may return a verified budget and assets; the agent can arrange them into Card, Text and Table but cannot invent a price or publish media.

## Step 1 — Define a small typed catalog

**Destination (future app change):** `src/lib/copilotkit/ipix-generative-ui.tsx`. No app code is added by this skill guide.

**Reference — ADAPT**
- URL: https://docs.copilotkit.ai/generative-ui/components/catalogs
- Source: `Create a catalog` → `createGenerativeUI`, component descriptions, `props` (Zod schemas), `slots`, typed `GenerativeUIComponentProps`.
- URL: https://github.com/CopilotKit/CopilotKit/blob/814af9b33ff8a76c340d78c6bf2b80f5efca0fd8/packages/react-core/src/v2/generative-ui/catalog.ts
- Source: `createGenerativeUI` and `GenerativeUIComponentProps`, experimental typed catalog surface.
- Use: choose only known branded/display components with schema-validated props; validate exact installation before copying API signatures.
- Do not copy: shop demo prices/data as authoritative iPix values, browser-provided org IDs, or unrestricted executable components.
- Apply to: read-only brand/shoot/campaign comparisons and trusted server DTOs.
- Verify: unknown component/prop rejection, malformed values, Org A/B isolation and no writes.
- **Checkpoint:** PASS when the catalog renders only allowlisted components from verified tenant-authorized tool results.

## Step 2 — Reuse the standard catalog selectively

**Reference — ADAPT**
- URL: https://docs.copilotkit.ai/generative-ui/components/standard-catalog
- Source: `standardUI` — 69 components grouped as layout, text, inputs, data, media, feedback and composites. Includes the A2UI 1.0 basic catalog.
- URL: https://github.com/CopilotKit/CopilotKit/blob/814af9b33ff8a76c340d78c6bf2b80f5efca0fd8/packages/react-core/src/v2/generative-ui/standard/index.ts
- Source: `standardUI`, `standardUI.omit([...])` and `overrides`, explicitly *experimental*.
- Use: reuse stock Card/Column/Text/Table/Chart where relevant; omit Map, action-capable inputs/forms and unused media for the first read-only pilot. Check optional chart/map dependencies before adoption.
- Do not copy: enabling all 69 controls, a new UI provider, new map SDK or financial actions merely because the library includes them.
- Apply to: iPix catalog, within its existing authenticated CopilotKit provider.
- Verify: render a known campaign-comparison fixture; fallback on unsupported component; no payment/save/publish mutation.
- **Checkpoint:** PASS when only the intentionally approved component subset can render.

**Version boundary:** The new native import is `@copilotkit/react-core/v2/generative-ui` with `createGenerativeUI` / `standardUI`. Do **not** mix in legacy `@copilotkit/a2ui-renderer` / `createCatalog` from A2UI v0.9. See [A2UI boundary](a2ui-and-dynamic-schema.md).
