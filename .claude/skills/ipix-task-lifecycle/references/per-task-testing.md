# Per-Task Testing Contract

Every task in an implementation plan (`docs/plan/tasks/*.md`) and every Linear completion step
(A–E) must declare how it will be verified **before moving to the next task**.

Phase 4 is the aggregate gate; **per-task testing happens in Phase 3** after each task chunk.

---

## Rule

| Task type | Required verification |
|-----------|----------------------|
| Logic (hook, service, util, API handler) | Vitest — write or extend `*.test.ts(x)` in `app/` |
| UI component with behaviour | Vitest + RTL — user-visible assertions |
| UI layout-only | Browser smoke step named in task (route + viewport) |
| Edge function | Invoke smoke + `npm run supabase:verify-edge` when task completes fn |
| Migration / RLS | `npm run supabase:verify-rls` on that task's migration |
| Docs-only | Lint check only — document skip in task |
| Pure refactor | Re-run existing suite touching changed files |

**No task ships without a `Test` block.** If truly untestable, use `Test: smoke` with exact
command and expected output — never leave blank.

---

## Task template (required in every plan task)

````markdown
### Task N: [Name]

**Maps to AC:** [criterion id or quote]

**Files:**
- Create: `app/src/...`
- Modify: `app/src/...`
- Test: `app/src/.../name.test.ts`

**Test:**
- Type: vitest | smoke | verify-rls | verify-edge
- Command: `npx vitest run src/path/name.test.ts -t "behaviour"`
- Pass when: [one-line expected outcome]

**Steps:**
1. Write failing test (or document smoke pre-check)
2. Run test — confirm FAIL
3. Minimal implementation
4. Run test — confirm PASS
5. `npm run typecheck` (changed TS only)
````

---

## Commands by area

```bash
# Single test file (default after each task)
npx vitest run src/path/to/file.test.ts

# Single test name
npx vitest run src/path/to/file.test.ts -t "describes behaviour"

# Watch while iterating
npx vitest run src/path/to/file.test.ts --watch

# After migration task
infisical run -- npm run supabase:verify-rls

# After edge fn task
npm run supabase:verify-edge

# UI smoke (no new unit test)
npm run dev:ui   # :3000 — note route + action in task proof
```

---

## Phase 3 loop (implementation)

For each task in the plan, in order:

```
implement → run task Test command → PASS → next task
                ↓ FAIL
            fix (test or code) — do not start next task
```

After **all** tasks: hand off to [testing.md](../testing.md) for full matrix + aggregate gates.

---

## Phase 1 / planning

When drafting Linear A–E steps, each step needs a **proof** line:

```markdown
**Step B proof:** `npx vitest run src/.../foo.test.ts` — 3 passed
```

Map AC rows → test types using [testing-matrix.md](testing-matrix.md).

---

## Test authoring

Load [gen-test](../../gen-test/SKILL.md) for Vitest + RTL patterns in `app/`.

Co-locate tests: `Component.tsx` + `Component.test.tsx` in same directory, or `app/src/**/*.test.ts`.

---

## Skip policy

Document in the task `Test` block:

```markdown
**Test:** smoke only — layout tweak, no logic change
**Command:** manual — `/app/brand-hub` at 375px + 1280px, four states visible
**Skip vitest because:** [one line]
```

Skips without justification block Phase 5 / task-verifier.
