# Lumina → iPix V2 migration task rules

Lumina is a reuse source, not architecture authority. Current iPix `origin/main` and verified live contracts win.

## Required migration matrix

| Lumina/current source | Main URL | Pinned URL | Explicit action | iPix target | Reason |
| -- | -- | -- | -- | -- | -- |
| `<file>` | `<main URL>` | `<immutable commit URL>` | `<COPY / PORT / REIMPLEMENT / ...>` | `<target>` | `<why>` |

Rules:

- Pin every Lumina source used to an immutable commit SHA.
- Also include the `main` URL for convenience.
- Never bulk-copy a Lumina folder and fix it later.
- Never copy Lumina auth/tenant/data assumptions without proving they match current iPix.
- Preserve user-visible behavior only when it still matches the desired iPix outcome.
- Move unrelated workflow ownership to the exact Linear task instead of vague `defer` language.
- Drop fake/demo/sample data, obsolete routes, stale contexts, fabricated evidence, and dead CTAs.
- Reuse current iPix DAL/auth/tenant/UI primitives before introducing custom wrappers.

## Preferred implementation order

```text
verify current iPix
→ verify live data/security contracts
→ audit pinned Lumina sources
→ complete source/action/target matrix
→ data/types/DAL first
→ routes
→ UI components
→ styles
→ tests
→ browser/runtime proof
```

## Agent prompt

```text
Audit the current iPix implementation first, then evaluate the pinned Lumina source as a reuse reference rather than architecture authority. For every source, record main URL, immutable pinned URL, explicit action, iPix target, and reason. Verify auth, tenant, data, route, AI, and provider assumptions against current iPix before copying. Preserve only behavior that still serves the user outcome; drop fake/demo/stale behavior and move unrelated ownership to the exact Linear task. Implement one bounded file/group at a time and verify it before continuing. Stop if current iPix already solves the requirement or if migration would create a second source of truth.
```
