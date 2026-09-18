# iPix Mermaid plan — diagrams as a development tool

**Brand:** iPix · [ipix.co](https://ipix.co) · **Code truth:** `src/` in this repo, not old FashionOS docs and not `github/copilotkit/` demos.

**The gist:** Draw **four contracts that exist today**. Do not draw Brand Brain, Cloudinary, commerce, or Planner HITL as if they were live — they are **not** in `src/`. Add those diagrams **when the code lands**.

**Think of it like:** A floor plan of the house you occupy, not a rendering of the mall you hope to build. Wrong floor plans cause the plumber to cut into a wall that isn’t there.

**Evidence (2026-09-02, this `src/`):** CopilotKit route fail-closed auth + `org_members` + `memoryResourceId` (`org:{orgId}::user:{userId}`) + `TenantAbortRunner`. Mastra registers **only** `weatherAgent` + `weatherTool` (Open-Meteo, no DB write). `PostgresStore` schema `mastra` when `MASTRA_DATABASE_URL` is set, else LibSQL. HITL is the **moon** demo, not Planner gates. **Zero** `.mmd` files. ~304 mermaid fences in `docs/` (mostly audits / notes), many **stale** vs code. Convert doc path `docs/mastra/10-mastra-convert.md` is **missing** (still cited in Cursor rules; copy lives under `docs/archive/`).

| Claim | Status |
|-------|--------|
| Auth / org / resourceId / abort isolation | ✅ code |
| Weather agent as the only Mastra agent | ✅ code |
| Production Planner, Cloudinary, Stripe, domain RPCs | ❌ not in `src/` |
| Hosted golden persistence green | ❓ not probed this pass |

---

## What to do (and not do)

| Keep permanently | Create when the feature ships | On demand | Avoid |
|------------------|-------------------------------|-----------|--------|
| 4 as-built diagrams | Planner sequence + HITL state; domain ER; brand/campaign/shoot **after** tools exist | Debug sequences, PR before/after | Commerce, publishing, learning-loop, Gantt of the whole product, GitGraph, mindmaps, “full platform” ER |

**Counts:** Core **4** · Feature later **~5** · Temporary **as needed** · **Permanently maintained now: 4** (not 11).

**Faster path:** One folder under existing `docs/mermaid/`. Skill + mcp-mermaid already exist. No Kroki, no second skill, no `mmdc` CI unless a PNG must live in a PR.

```text
Inspect src/
→ pick type (mermaid-diagrams skill)
→ write .mmd
→ mcp-mermaid generate_mermaid_diagram
→ compare to code
→ save .mmd only if it will be updated when that path changes
```

---

## 1. As-built map (30 seconds)

```text
Operator browser (Next.js :3000)
  → sign-in (Supabase Auth)
  → CopilotKit UI (refuses mount if unsigned)
  → POST /api/copilotkit (AG-UI)
  → JWT + org_members  →  401 / 403 / 503 or resourceId
  → Mastra weather agent (:4111 in local split-dev)
  → Open-Meteo (read)  +  Memory in mastra Postgres (or LibSQL fallback)
```

**AI proposes vs human approves:** today, almost nothing is a product write. Moon HITL is a **demo**. Domain writes must stay **RPC + user JWT**, not Mastra as `postgres` — that rule is policy; Planner writes are **not implemented**.

---

## 2. Diagram types — keep / skip

| Type | Use here? | Why |
|------|-----------|-----|
| Architecture (`architecture-beta`) | **Yes — core** | Services that actually run |
| Sequence | **Yes — core** | Auth order, `/stop` isolation, later Planner tools |
| Flowchart | **Yes — mount / 401–403** | Fail-closed decisions |
| State | **Later** | Real HITL (not moon) |
| ER | **Later** | When this app owns domain tables; `org_members` can wait inside the auth sequence |
| User journey | **Later** | Brand/campaign/shoot when those agents exist |
| C4 | Skip extra | Architecture-beta covers containers |
| Requirement | Linear AC, not a permanent `.mmd` | |
| Gantt / GitGraph / mindmap / pie | Skip | Prose + Linear already clearer |
| Dependency flowchart | On-demand for a Linear epic | Not a forever file |

---

## 3. Journeys from the prompt vs code

| Prompt journey | Diagram now? |
|----------------|--------------|
| Core platform (browser, CopilotKit, Mastra, Auth, Postgres, Vercel) | **Yes — as-built** (no Cloudinary node) |
| AI: Operator → CopilotKit → Agent → tool → HITL → RPC → Supabase | **Partial:** stop at weather tool. Do **not** draw RPC writes until they exist |
| Brand / campaign / shoot / asset / commerce / publishing / learning | **Do not create** as permanent docs. They would **lie**. Generate when `src/` has the agent/tool |

**Real example (true today):** Operator asks for weather. Sequence must show **no** `INSERT` into `shoot.*`. If a future PR adds a write tool without an RPC, the as-built sequence makes the cheat obvious.

**Real example (not true today):** “24-shot lookbook then persist a shoot” — **do not** put that in a core diagram until Production Planner tools exist.

---

## 4. How diagrams cut errors

| Diagram | Prevents | Tests you can derive |
|---------|----------|----------------------|
| Runtime architecture | Wiring Cloudinary/Mastra writes that aren’t there; combining `dev:ui`+`dev:agent` | Ports 3000/4111; no Cloudinary import in `src/` |
| Auth sequence | Chat with `resourceId` `"default"`; org from client metadata; Org B `/stop` killing Org A | 401 unsigned; 403 non-member; Org A/B thread isolation (`auth-001` / `auth-002`) |
| Abort sequence | Unscoped `threadId` in `InMemoryAgentRunner` | Stop only cancels own `resourceId`+thread |
| Future Planner sequence | Tool write before approve; agent as `postgres` | Draft cannot commit; wrong org cannot approve |

**Drift check (lightweight, not an enforcer):** Agent reads `.mmd` + `src/` and reports extra/missing nodes. Most valuable on **runtime architecture** and **auth sequence**. Mermaid does **not** fail CI by itself unless you add a test that asserts files/symbols exist.

---

## 5. Use in the lifecycle

| Moment | Use the diagram as |
|--------|--------------------|
| Planning | Scope: “this PR may not add Cloudinary” |
| Implementation | Interaction contract |
| Review / PR | Diff vs `.mmd`; if arrows change, update the file in the **same** PR (one concern: that runtime) |
| Testing | Each 401/403/stop branch |
| Debugging | First arrow that doesn’t match logs |
| Linear | Blockers: auth Done before Planner writes |
| Onboarding | Four pictures, then `src/app/api/copilotkit` |
| Cursor | Load `.mmd` before editing the route |

---

## 6–7. Recommended set

### Core (permanent) — 4

| Priority | Diagram | Type | Purpose | Systems | Error prevented | Dev use | Permanent? |
|----------|---------|------|---------|---------|-----------------|---------|------------|
| P0 | Runtime as-built | architecture-beta | Who talks to whom | Next 3000, CopilotKit, Mastra 4111, Supabase Auth, mastra PG / LibSQL, Open-Meteo | Fake Cloudinary/Planner nodes | Onboarding, PR boundary | **Yes** |
| P0 | Copilot auth | sequence | JWT → membership → `memoryResourceId` | Route, `verified-operator`, `runtime-org`, hooks | Unsigned chat; client-chosen org | Review AUTH-002 | **Yes** |
| P0 | Tenant stop | sequence | `/run` vs `/stop` keys | `TenantAbortRunner`, `scopedThreadId` | Cross-tenant abort | Debug Stop button | **Yes** |
| P1 | Chat mount | flowchart | Signed-in only | `copilot-mount`, login | Mounting CopilotKit logged out | UI review | **Yes** |

**Suggested files:**

```text
docs/mermaid/architecture/runtime-as-built.mmd
docs/mermaid/architecture/copilot-auth.mmd
docs/mermaid/architecture/tenant-abort.mmd
docs/mermaid/architecture/chat-mount.mmd
```

| File | In scope | Out of scope | Update when |
|------|----------|--------------|-------------|
| `runtime-as-built.mmd` | Processes and stores that exist | Brand DNA, Cloudinary, Stripe, shoot tables | New agent ID, new store, new host |
| `copilot-auth.mmd` | 401/403/503 and `org:{id}::user:{id}` | Planner tools | Auth/membership/resourceId change |
| `tenant-abort.mmd` | thread prefix + abortRun | Weather API internals | Runner/store key change |
| `chat-mount.mmd` | Handshake refuse | Visual design | Mount/auth UI change |

### Feature (not now) — ~5 when code exists

| When | Diagram | Type | File (later) |
|------|---------|------|----------------|
| Planner agent registered | Planner draft → (future) HITL → RPC | sequence + state | `docs/mermaid/journeys/planner-hitl.mmd` |
| Domain schema used by this app | Org–brand–shoot–asset | erDiagram | `docs/mermaid/data/domain-er.mmd` |
| Brand research agent | URL → draft → approve → save | flowchart | `docs/mermaid/journeys/brand.mmd` |
| Shoot persist | Brief → shot list → approve → assets | flowchart | `docs/mermaid/journeys/shoot.mmd` |
| Cloudinary in `src/` | Upload → transform → metadata | sequence | `docs/mermaid/journeys/asset-cloudinary.mmd` |

### Do not create (would be fiction)

Commerce checkout, publishing/Postiz, analytics→Brand Brain learning loop, “full iPix” ER from `docs/data/audit/*`, GitGraph of gitflow, product Gantt.

---

## 8. Folder structure (reuse `docs/mermaid/`)

```text
docs/mermaid/
  plan-mermaid.md          ← this plan
  mermaid-skills.md        ← skill/MCP catalog
  notes/                   ← prompts / essays (not contracts)
  architecture/            ← core .mmd (create with first three)
  journeys/                ← empty until feature ships
  data/                    ← domain ER later
```

Do **not** add `docs/architecture/` in parallel. Do **not** treat 54 markdown files with fences as the SSOT — pick the four `.mmd` files.

---

## 9. MCP workflow

Already in `.claude/skills/mermaid-diagrams`: inspect → type → fence → **mcp-mermaid** → save `.mmd` beside the doc **only if asked / worth maintaining**.

Gap: **none** that justifies Kroki or another skill.

---

## 10. Drift

| Diagram | Drift signal |
|---------|----------------|
| Runtime as-built | New `src/mastra` agent not on the diagram; Cloudinary import without a node (or a node without import) |
| Auth sequence | `memoryResourceId` shape change; membership not from `org_members` |

Optional later: a unit test that `src/mastra/index.ts` agent keys ⊆ labels in `runtime-as-built.mmd`. Until then: review checklist, not enforcement.

---

## 11. Tests from diagrams (as-built)

**Auth sequence** → unsigned 401; no membership 403; membership from `org_members` only; `resourceId` format; Org B cannot use Org A thread (existing `tests/auth-00*.ts`).

**Tenant abort** → `/stop` with another org’s threadId does not abort.

**Mount flowchart** → CopilotKit not mounted signed out.

**Future Planner state** `Draft → Review → Approved → Commit` → draft cannot commit; reject does not write; approve once; wrong org denied — **write those tests when the states exist**.

---

## 12. Score (/100)

| Axis | Score | Deduction |
|------|------:|-----------|
| Architecture clarity | 82 | Docs still describe Planner/Cloudinary as if present |
| Development accuracy | 88 | Four as-built diagrams match `src/` |
| Error reduction | 80 | Highest risk is **auth/tenant**, already test-backed; diagrams make it reviewable |
| Debugging | 78 | Abort/auth sequences help; weather path is simple |
| AI-agent usefulness | 85 | Compact `.mmd` beats 300 fences in audits |
| Testability | 84 | Maps to existing auth tests |
| Maintenance cost | 70 | sprawl in `docs/` still exists; plan is to **stop** feeding it |
| Onboarding | 80 | Four pictures vs convert-doc 404 |
| **Overall** | **80** | −20 vs a “full product map” because that map would be **wrong** |

---

## 13. Next implementation — first 3

```text
1. docs/mermaid/architecture/runtime-as-built.mmd
   Type: architecture-beta
   Why first: stops agents from “implementing” Cloudinary/Planner that aren’t here
   Systems: Next, CopilotKit, Mastra, Auth, mastra PG/LibSQL, Open-Meteo
   Prevents: fake integrations; combined npm run dev as a “service”

2. docs/mermaid/architecture/copilot-auth.mmd
   Type: sequenceDiagram
   Why first: AUTH-002 is the load-bearing wall
   Systems: JWT, org_members, memoryResourceId, copilot hooks
   Prevents: resourceId "default"; client org spoof; missing 401

3. docs/mermaid/architecture/tenant-abort.mmd
   Type: sequenceDiagram
   Why first: subtle, already custom code, easy to regress
   Systems: TenantAbortRunner, scoped threadId, /stop
   Prevents: Org B cancelling Org A’s stream
```

Fourth (`chat-mount.mmd`) can follow in the same concern if the PR is still “mermaid contracts” only.

---

## 14. Final

**Keep permanently:** the four as-built files above.

**Per feature:** Planner / brand / shoot / Cloudinary diagrams **tied to the PR that adds the code**.

**On demand:** debug sequences, Linear dependency flowcharts.

**Avoid:** decorating `docs/data/audit` with more FashionOS fences; duplicating Linear as Gantt.

**Core principle:** Diagram only what helps build, verify, debug, or understand. If it isn’t in `src/`, it isn’t a core diagram.

**One-line takeaway:** Four truthful pictures of today’s CopilotKit + Mastra starter beat eleven pictures of tomorrow’s product.
