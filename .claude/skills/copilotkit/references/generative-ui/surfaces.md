# CopilotKit surfaces — display AI results outside chat

**Scope:** IPI-1387 read-only pilot *after* CopilotKit/AG-UI version certification. Components and Surfaces is experimental. No new provider, backend route or persistent store.

A **surface** renders in chat or a named workspace area. For iPix: “Compare three shoot options” can produce a card/table in the Campaign planning panel while the chat stays available.

## Step 1 — Add one named read-only target

**Destination (future runtime task):** Existing `src/components/operator-panel/operator-panel.tsx` or an existing campaign/shoot panel. The reusable catalog belongs in `src/lib/copilotkit/ipix-generative-ui.tsx`.

**Reference — ADAPT**
- URL: https://docs.copilotkit.ai/generative-ui/components/surfaces
- Source: `Add a page target` / `Limit the components` → `GenerativeUISurface`, `id`, `description`, `ui`, `components`, `fallback`, `autoScroll`.
- URL: https://github.com/CopilotKit/CopilotKit/blob/814af9b33ff8a76c340d78c6bf2b80f5efca0fd8/packages/react-core/src/v2/generative-ui/GenerativeUISurface.tsx
- Source: `GenerativeUISurfaceProps` and `GenerativeUISurface()`; an invalid component is rejected rather than rendered.
- Use: stable target id, small allowlisted components and a native fallback when no generated surface exists. Use `autoScroll={false}` where mobile/scroll behavior warrants it.
- Do not copy: unrelated e-commerce data, extra CopilotKit providers, or an unbounded free-form generated UI region.
- Apply to: `campaign-comparison` or `shoot-options` display-only surface.
- Verify: permitted tree renders; unknown component is rejected; fallback appears on clear/error/Stop; **Org A/B tenant isolation** and Brand/thread switching deny stale data; accessibility and sticky-header/mobile placement checked.
- **Checkpoint:** PASS when valid data appears in the intended workspace region without modifying durable iPix data.

## Security and failure rules

- A page target `id`, model-selected `surfaceId` and browser `threadId` are **presentation identifiers, not authorization**. Trusted backend checks own Brand/Shoot data. Clear stale surfaces on organization/Brand/thread changes.
- A UI card can show a review link but cannot itself approve/save/publish/pay/delete. Consequential actions must go through the existing human review + server revalidation + idempotent domain action flow.
- Rendering failure, malformed props, unsupported components or inaccessible targets must fall back to native UI; do not silently replace existing product state or lose chat history.
- Keep the user's existing `ShootPlanReviewHitl` and `ComposeShootPlanRenderer` behavior; first proof is a **read-only comparison**, not a new approval mechanism.

**Example:** Operator asks for three production options. Authorized Mastra tools return the options. AI populates `shoot-options` cards using the catalog. Operator selects “Review plan”, which opens the existing human-review flow. Nothing publishes automatically.
