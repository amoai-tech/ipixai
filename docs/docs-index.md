# iPix Documentation Index

**Canonical documentation index for the iPix repository.**

Use this page as the single starting point for everything under `docs/`.

- **Repository branch:** `docs/reference-index`
- **Live execution/status authority:** Linear
- **Product authority:** [`prd.md`](./prd.md) + [`sitemap.md`](./sitemap.md)
- **Architecture authority:** accepted ADRs + current code/runtime
- **Historical material:** [`archive/`](./archive/)

> Rule: this file is the one documentation index. Do not create competing doc indexes. Domain `README.md` files may organize their own folders, but they should link back here.

---

## 1. Start here

| Area | Document | Purpose |
|---|---|---|
| Documentation home | [`README.md`](./README.md) | Short introduction to repository documentation |
| **All docs index** | **[`docs-index.md`](./docs-index.md)** | **This file — canonical map of all documentation** |
| Product requirements | [`prd.md`](./prd.md) | Product source of truth |
| Product sitemap | [`sitemap.md`](./sitemap.md) | Canonical routes and phase ownership |
| Product roadmap | [`roadmap.md`](./roadmap.md) | Product sequencing and roadmap |
| Architecture decisions | [`adr/README.md`](./adr/README.md) | Accepted ADR catalog |
| Engineering review | [`pr-review-guidelines.md`](./pr-review-guidelines.md) | PR review expectations |
| Legacy detailed reference index | [`reference-index.md`](./reference-index.md) | Historical/reference material; **not a second canonical index** |

### Source-of-truth order

1. Current runtime / repository / installed package types
2. [`prd.md`](./prd.md) + [`sitemap.md`](./sitemap.md)
3. Accepted ADRs
4. Living domain documentation and technical contracts
5. Linear for live task status, blockers, assignees, and completion
6. [`archive/`](./archive/) for historical evidence only

---

## 2. Architecture decisions

Folder: [`docs/adr/`](./adr/)

| Document | Purpose |
|---|---|
| [`adr/README.md`](./adr/README.md) | ADR catalog |
| [`adr/001-node-first.md`](./adr/001-node-first.md) | Node/Vercel-first runtime decision |
| [`adr/002-mastra-owns-ai-memory.md`](./adr/002-mastra-owns-ai-memory.md) | Mastra owns AI/conversation memory |
| [`adr/003-supabase-owns-tenancy.md`](./adr/003-supabase-owns-tenancy.md) | Supabase owns tenancy and authorization truth |
| [`adr/004-compatibility-bundle.md`](./adr/004-compatibility-bundle.md) | Compatibility/version-family policy |

---

## 3. CopilotKit + Mastra / agent platform

Folder: [`docs/copilotkit-mastra/`](./copilotkit-mastra/)

Use this area for CopilotKit, AG-UI, Mastra integration, runtime patterns, tools, agents, workflows, HITL, research, and reference implementations.

- [`copilotkit-mastra/`](./copilotkit-mastra/) — complete CopilotKit/Mastra documentation folder
- [`copilotkit-mastra/README.md`](./copilotkit-mastra/README.md) — folder entry point when present

Related runtime docs:

- [`mastra/`](./mastra/) — Mastra runtime, storage, hosting, upgrade, and persistence documentation
- [`mastra/runtime-family.md`](./mastra/runtime-family.md) — runtime/package family contract
- [`mastra/db-001-matrix.md`](./mastra/db-001-matrix.md) — Mastra PostgreSQL/storage contract

**Implementation principle:** existing iPix → official feature/example → proven maintained implementation → smallest iPix adaptation → custom only when required.

---

## 4. Supabase / data / persistence

Folders:

- [`data/`](./data/) — Supabase/data documentation
- [`supabase/`](./supabase/) — migrations, reconciliation, database-specific implementation notes

Primary documents:

- [`data/README.md`](./data/README.md) — data documentation entry point
- [`supabase/ipi-1040-forward-migrations.md`](./supabase/ipi-1040-forward-migrations.md) — forward migration guidance
- [`supabase/ipi-1161-reconciliation-deployment.md`](./supabase/ipi-1161-reconciliation-deployment.md) — reconciliation/deployment guidance

**Ownership rule:** Supabase/Postgres owns durable iPix application truth and tenant isolation. Mastra storage is AI runtime/memory truth, not domain truth.

---

## 5. Cloudinary / media

Folder: [`docs/cloudinary/`](./cloudinary/)

| Document | Purpose |
|---|---|
| [`cloudinary/README.md`](./cloudinary/README.md) | Cloudinary documentation entry point |
| [`cloudinary/prd.md`](./cloudinary/prd.md) | Media/product requirements |
| [`cloudinary/CONTRACT-1110-1112.lock.md`](./cloudinary/CONTRACT-1110-1112.lock.md) | Locked Cloudinary contract |
| [`cloudinary-environment.json`](./cloudinary-environment.json) | Environment evidence; **never treat as a secret source** |

**Ownership rule:** Cloudinary owns image/video bytes, transformations, and delivery. Supabase owns asset business metadata and relationships.

---

## 6. Linear / task standards

Folder: [`docs/linear/`](./linear/)

- [`linear/`](./linear/) — all Linear/task documentation
- [`linear/linear-format.md`](./linear/linear-format.md) — canonical Linear issue formatting rules

Linear is the live authority for:

- task status
- dependencies
- blockers
- assignees
- milestones
- completion state

Repository docs explain **how the system works**; Linear explains **what is currently being executed**.

---

## 7. Mermaid / diagrams

Folder: [`docs/mermaid/`](./mermaid/)

Use Mermaid only where a diagram improves understanding of:

- system ownership
- request/response sequence
- state transitions
- entity relationships
- dependencies
- user journeys
- verification paths

Current runtime/code remains authoritative over diagrams.

---

## 8. Reference material

Folders:

- [`reference/`](./reference/) — maintained visual/competitive/reference material
- [`screenshots/`](./screenshots/) — screenshots and visual verification evidence

These are references, not architecture or product authority.

---

## 9. Historical / archived documentation

Folder: [`docs/archive/`](./archive/)

Entry point: [`archive/README.md`](./archive/README.md)

The archive contains superseded planning, migration, design, task snapshots, audits, research, and historical implementation evidence, including preserved subtrees such as:

- [`archive/MIGRATE/`](./archive/MIGRATE/)
- archived task specifications
- archived architecture/research plans
- older product/design documentation
- superseded runtime/deployment notes

**Archive rule:** every file under `docs/archive/` is historical evidence only. Do not use old task status, package versions, runtime assumptions, or API contracts without re-verifying them against current iPix.

The archive is intentionally linked from this canonical index so **no documentation is orphaned**, while avoiding hundreds of historical files overwhelming the active documentation map.

---

## 10. Complete docs directory inventory

Every documentation file in the branch belongs to one of the locations below. This table is the completeness boundary for `docs/`.

| Path | Classification | Included here? |
|---|---|---:|
| [`docs/README.md`](./README.md) | Active | ✅ |
| [`docs/docs-index.md`](./docs-index.md) | Active / canonical index | ✅ |
| [`docs/prd.md`](./prd.md) | Active | ✅ |
| [`docs/sitemap.md`](./sitemap.md) | Active | ✅ |
| [`docs/roadmap.md`](./roadmap.md) | Active | ✅ |
| [`docs/pr-review-guidelines.md`](./pr-review-guidelines.md) | Active | ✅ |
| [`docs/cloudinary-environment.json`](./cloudinary-environment.json) | Evidence | ✅ |
| [`docs/reference-index.md`](./reference-index.md) | Legacy/reference | ✅ |
| [`docs/adr/`](./adr/) | Active directory — all files included | ✅ |
| [`docs/cloudinary/`](./cloudinary/) | Active directory — all files included | ✅ |
| [`docs/copilotkit-mastra/`](./copilotkit-mastra/) | Active/research directory — all files included | ✅ |
| [`docs/data/`](./data/) | Active directory — all files included | ✅ |
| [`docs/linear/`](./linear/) | Active directory — all files included | ✅ |
| [`docs/mastra/`](./mastra/) | Active directory — all files included | ✅ |
| [`docs/mermaid/`](./mermaid/) | Active/reference directory — all files included | ✅ |
| [`docs/reference/`](./reference/) | Reference directory — all files included | ✅ |
| [`docs/screenshots/`](./screenshots/) | Evidence directory — all files included | ✅ |
| [`docs/supabase/`](./supabase/) | Active directory — all files included | ✅ |
| [`docs/archive/`](./archive/) | Historical directory — all files included | ✅ |

### Completeness rule

Whenever a new top-level file or directory is added under `docs/`, update this table in the same PR.

For files inside an existing documented directory, its local `README.md` may provide the detailed file-by-file map. This page remains the **one global index**.

---

## 11. Domain / product execution map

The main iPix product areas are:

```text
Shared platform
→ Brands
→ Shoots / Production Planner
→ Talent / Booking
→ Assets / Media
→ CRM
→ Operations
→ Analytics
→ Saved Plans
```

Use [`prd.md`](./prd.md), [`sitemap.md`](./sitemap.md), and Linear for the current implementation scope and ordering.

Real-world iPix journey:

```text
Brand URL
→ research + Brand DNA draft
→ human approval
→ approved Brand Brain
→ campaign / shoot planning
→ operator approval
→ production
→ assets in Cloudinary
→ DNA review
→ product/content linking
→ publishing
→ analytics
→ learning back into Brand Brain
```

---

## 12. Documentation maintenance rules

1. **One global index:** `docs/docs-index.md`.
2. Domain/folder `README.md` files organize only their own directory.
3. Do not create another repository-wide documentation index.
4. Current product truth belongs in `prd.md` / `sitemap.md`, not in task snapshots.
5. Current architecture decisions belong in ADRs.
6. Live task status belongs in Linear.
7. Superseded material moves to `archive/`; do not delete useful history casually.
8. Add new docs to the appropriate existing domain before creating a new top-level folder.
9. Run `npm run docs:check` after documentation changes.
10. If a new top-level `docs/*` file or folder is created, update the **Complete docs directory inventory** above in the same change.

---

## 13. Drift guard

`npm run docs:check` protects the active documentation model.

It should prevent:

- removed/superseded documentation systems returning
- duplicate global indexes becoming authoritative
- fully archived top-level trees being recreated without an explicit decision
- broken active documentation structure

Historical files under `docs/archive/` remain exempt from active-link authority because they preserve historical evidence.

---

## Summary

**Best decision:** use **`docs/docs-index.md` as the only global documentation index**.

It now covers:

- product docs
- architecture decisions
- CopilotKit + Mastra
- Supabase/data
- Cloudinary/media
- Linear/task standards
- diagrams
- references/screenshots
- the full historical archive
- every top-level file/directory under `docs/`

**Next rule:** every future documentation PR must keep this index synchronized with any new top-level `docs/*` file or directory.