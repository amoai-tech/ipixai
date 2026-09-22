# External Reference → Implementation Mapping Standard

Use this for every substantial executable iPix Linear task that cites external documentation, GitHub repositories, starters, examples, recipes, SDKs, CLIs, vendor docs, or legacy/Lumina references.

## Rule

A detached reference list is not an implementation plan.

Every external reference used by an executable task must be attached to the exact implementation step that consumes it.

Required mapping:

```text
exact URL
→ exact source file/example/section/symbol
→ COPY / ADAPT / MODEL / REFERENCE ONLY
→ exact behavior/pattern to use
→ exact behavior/infrastructure not to copy
→ exact iPix destination
→ exact change
→ exact verification
```

If a URL cannot be connected to a concrete implementation or verification step, remove it from the executable runbook and keep it only in background/research notes.

## Required classifications

Use exactly one primary classification per reference inside a step:

- **COPY** — source is compatible enough to reproduce closely. Still verify current installed APIs, auth, tenancy, and versions.
- **ADAPT** — reuse the source pattern, shape, algorithm, component, or contract, but modify it for current iPix architecture.
- **MODEL** — use it as an architecture/UX/workflow model; do not copy code directly.
- **REFERENCE ONLY** — use it to validate behavior, constraints, terminology, or API expectations; no direct implementation reuse.

For legacy/Lumina migrations, the task may additionally use the stronger existing task vocabulary such as **COPY + CLEAN**, **COPY UI STRUCTURE + REWRITE DATA/WORKFLOW LOGIC**, **REIMPLEMENT USING CURRENT iPix PATTERN**, or **DROP**. Map that action back to one of the four reference classes above for external-reference tracking.

## Mandatory step format

Every URL-bearing implementation step must include this structure:

```markdown
### Step N — <plain-English implementation outcome>

**iPix destination**
- `src/.../target.ts`
- `src/.../target.test.ts`

**Reference 1 — ADAPT**
- URL: https://github.com/vendor/repo/tree/<pinned-sha>/examples/example-name
- Source: `examples/example-name/src/file.ts` → `functionName()` / `ComponentName`
- Use: reuse the typed streaming/request/HITL/etc. pattern.
- Do not copy: demo auth, browser-trusted tenant IDs, in-memory persistence, sample provider, obsolete routing, or unrelated infrastructure.
- Apply to: `src/.../target.ts` → `targetFunction()`
- Change: adapt the source pattern to current iPix installed APIs, server-derived org authorization, and existing source-of-truth boundaries.
- Verify: `npm test -- <targeted test>` plus the exact runtime/browser/database proof required by this behavior.

**Checkpoint**
- PASS when: <observable result>
- Evidence: <command/test/readback/CI/browser proof>
- STOP if: <condition that invalidates the plan>
```

## Exact source requirement

Do not cite only a repository root or documentation homepage when a narrower source exists.

Prefer:

```text
URL to exact docs page
+ exact heading/API
```

or:

```text
URL to exact GitHub example/revision
+ exact file path
+ exact function/component/type
```

For mutable GitHub sources:

1. Keep the readable branch URL for navigation when useful.
2. Resolve the source commit SHA before implementation.
3. Record a pinned commit/blob/tree URL in implementation or PR evidence.

## Exact iPix destination requirement

Do not write vague destinations such as:

```text
apply to Planner
update auth
wire into frontend
```

Use exact targets:

```text
src/mastra/agents/production-planner.ts → tools array
src/app/api/copilotkit/route.ts → authenticated runtime setup
src/lib/auth/resolve-active-org.ts → resolveActiveOrg()
tests/tenant-isolation.test.ts → Org A/B negative case
```

When the exact destination does not exist yet, say explicitly:

```text
Create: src/.../new-file.ts
```

## Verification requirement

Verification must prove the adapted behavior, not merely that code compiles.

Examples:

- component pattern → targeted component test + browser behavior
- RLS/auth pattern → Org A/Org B negative proof
- Mastra memory pattern → restart/persistence proof
- CopilotKit stream pattern → authenticated stream + stop/reconnect proof
- HITL pattern → exact-artifact approve/reject/resume proof
- webhook pattern → signature + retry/idempotency proof
- migration pattern → fresh replay + catalog/readback proof
- Cloudinary pattern → signed upload + exact asset/version readback

Use the cheapest decisive proof first, then broader proof only when the risk requires it.

## Reference quality order

Prefer:

```text
current iPix implementation
→ installed source/types
→ official version-specific docs
→ maintained official GitHub example/starter
→ official SDK/CLI recipe
→ proven legacy/Lumina reference
→ maintained community reference only when official material is insufficient
```

Do not copy archived examples when a maintained official replacement exists.

## Ready gate

A substantial executable Linear task with external references is **not Ready** until every load-bearing external URL has:

- [ ] exact URL
- [ ] exact source file/example/section/symbol
- [ ] COPY / ADAPT / MODEL / REFERENCE ONLY classification
- [ ] exact pattern/behavior to use
- [ ] explicit `Do not copy` boundary
- [ ] exact iPix destination
- [ ] precise implementation change
- [ ] exact verification
- [ ] checkpoint + STOP condition when risk warrants it

A Reference Appendix may summarize sources, but it never replaces the mappings inside the Ordered Implementation Runbook.
