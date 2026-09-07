# Lumina → iPix V2 migration task rules

Lumina is a reuse source, not architecture authority. Current iPix `origin/main` and verified live contracts win.

## Required migration matrix

| Lumina/current source | Pinned URL | Explicit action | iPix target | Reason |
| -- | -- | -- | -- | -- |
| `<file>` | `<commit URL>` | `<COPY / PORT / REIMPLEMENT / ...>` | `<target>` | `<why>` |

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
