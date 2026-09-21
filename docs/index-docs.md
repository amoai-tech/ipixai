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
| **All docs index** | **[`index-docs.md`](./index-docs.md)** | **This file — canonical map of all documentation** |
| Product requirements | [`prd.md`](./prd.md) | Product source of truth |
| Product sitemap | [`sitemap.md`](./sitemap.md) | Canonical routes and phase ownership |
| Product roadmap | [`roadmap.md`](./roadmap.md) | Product sequencing and roadmap |
| Architecture decisions | [`adr/README.md`](./adr/README.md) | Accepted ADR catalog |
| Engineering review | [`pr-review-guidelines.md`](./pr-review-guidelines.md) | PR review expectations |

### Source-of-truth order

1. Current runtime / repository / installed package types
2. [`prd.md`](./prd.md) + [`sitemap.md`](./sitemap.md)
3. Accepted ADRs
4. Living domain documentation and technical contracts
5. Linear for live task status, blockers, assignees, and completion
6. [`archive/`](./archive/) for historical evidence only

---

## 2. Documentation areas

Every document under `docs/` belongs to one of these areas. Folder entry points provide the detailed file-by-file map for their area; this file is the one global index.

| Area | Path | Role |
|---|---|---|
| Product / navigation | [`README.md`](./README.md), [`prd.md`](./prd.md), [`sitemap.md`](./sitemap.md), [`roadmap.md`](./roadmap.md) | Product truth, routes, roadmap |
| Architecture decisions | [`adr/`](./adr/) | Accepted architectural decisions |
| CopilotKit + Mastra | [`copilotkit-mastra/`](./copilotkit-mastra/) | Agent UI/runtime integration, AG-UI, tools, HITL, research |
| Mastra runtime | [`mastra/`](./mastra/) | Runtime, storage, persistence, hosting, upgrades |
| Supabase / data | [`data/`](./data/), [`supabase/`](./supabase/) | Durable data, schema, RLS, migrations, reconciliation |
| Cloudinary / media | [`cloudinary/`](./cloudinary/), [`cloudinary-environment.json`](./cloudinary-environment.json) | Media architecture and environment evidence |
| Linear / execution standards | [`linear/`](./linear/) | Task format and execution documentation |
| Mermaid / diagrams | [`mermaid/`](./mermaid/) | Maintained diagram guidance |
| Reference material | [`reference/`](./reference/) | Maintained external/competitive references |
| Screenshots / evidence | [`screenshots/`](./screenshots/) | Visual verification evidence |
| Engineering review | [`pr-review-guidelines.md`](./pr-review-guidelines.md) | PR review guidance |
| Historical archive | [`archive/`](./archive/) | Superseded plans, audits, migration notes, task snapshots |

---

## 3. Architecture decisions

Folder: [`adr/`](./adr/)

- [`adr/README.md`](./adr/README.md)
- [`adr/001-node-first.md`](./adr/001-node-first.md)
- [`adr/002-mastra-owns-ai-memory.md`](./adr/002-mastra-owns-ai-memory.md)
- [`adr/003-supabase-owns-tenancy.md`](./adr/003-supabase-owns-tenancy.md)
- [`adr/004-compatibility-bundle.md`](./adr/004-compatibility-bundle.md)

---

## 4. CopilotKit + Mastra / agent platform

- [`copilotkit-mastra/`](./copilotkit-mastra/) — CopilotKit, AG-UI, Mastra integration, runtime patterns, tools, agents, workflows, HITL, research, and reference implementations.
- [`copilotkit-mastra/README.md`](./copilotkit-mastra/README.md) — area entry point.
- [`mastra/`](./mastra/) — Mastra runtime, storage, hosting, upgrade, and persistence docs.
- [`mastra/runtime-family.md`](./mastra/runtime-family.md) — runtime/package family contract.
- [`mastra/db-001-matrix.md`](./mastra/db-001-matrix.md) — PostgreSQL/storage contract.

**Implementation principle:** existing iPix → official feature/example → proven maintained implementation → smallest iPix adaptation → custom only when required.

---

## 5. Supabase / data / persistence

- [`data/`](./data/) — Supabase/data documentation.
- [`data/README.md`](./data/README.md) — data area entry point.
- [`supabase/`](./supabase/) — migrations, reconciliation, and database-specific implementation notes.
- [`supabase/ipi-1040-forward-migrations.md`](./supabase/ipi-1040-forward-migrations.md) — forward migration guidance.
- [`supabase/ipi-1161-reconciliation-deployment.md`](./supabase/ipi-1161-reconciliation-deployment.md) — reconciliation/deployment guidance.

**Ownership:** Supabase/Postgres owns durable iPix application truth and tenant isolation. Mastra storage owns AI runtime/memory truth, not domain truth.

---

## 6. Cloudinary / media

- [`cloudinary/README.md`](./cloudinary/README.md) — area entry point.
- [`cloudinary/prd.md`](./cloudinary/prd.md) — media/product requirements.
- [`cloudinary/CONTRACT-1110-1112.lock.md`](./cloudinary/CONTRACT-1110-1112.lock.md) — locked Cloudinary contract.
- [`cloudinary/official-repos.md`](./cloudinary/official-repos.md) — official repositories/examples.
- [`cloudinary-environment.json`](./cloudinary-environment.json) — environment evidence; never a secret source.

**Ownership:** Cloudinary owns image/video bytes, transformations, and delivery. Supabase owns asset business metadata and relationships.

---

## 7. Linear / task standards

- [`linear/`](./linear/) — all Linear/task documentation.
- [`linear/linear-format.md`](./linear/linear-format.md) — canonical Linear issue formatting.

Linear is the live authority for task status, dependencies, blockers, assignees, milestones, and completion state.

---

## 8. Mermaid / diagrams

Folder: [`mermaid/`](./mermaid/)

Use diagrams where they make ownership, sequence, state, relationships, dependencies, user journeys, or verification easier to understand. Current code/runtime remains authoritative over diagrams.

---

## 9. Reference and evidence

- [`reference/`](./reference/) — maintained reference material.
- [`screenshots/`](./screenshots/) — screenshots and visual verification evidence.

These are references/evidence, not product or architecture authority.

---

## 10. Historical / archived documentation

Folder: [`archive/`](./archive/)

Entry point: [`archive/README.md`](./archive/README.md)

The archive contains superseded planning, migration, design, task snapshots, audits, research, and historical implementation evidence. Every file beneath `archive/` remains discoverable through this global index and its preserved directory hierarchy.

**Archive rule:** historical evidence only. Re-verify old task status, package versions, runtime assumptions, and API contracts before reuse.

---

## 11. Complete top-level `docs/` inventory

This table is the global completeness boundary. Every top-level document or documentation directory under `docs/` must appear here.

| Path | Classification | Included |
|---|---|---:|
| [`README.md`](./README.md) | Active | ✅ |
| [`index-docs.md`](./index-docs.md) | Active / **canonical global index** | ✅ |
| [`prd.md`](./prd.md) | Active | ✅ |
| [`sitemap.md`](./sitemap.md) | Active | ✅ |
| [`roadmap.md`](./roadmap.md) | Active | ✅ |
| [`pr-review-guidelines.md`](./pr-review-guidelines.md) | Active | ✅ |
| [`cloudinary-environment.json`](./cloudinary-environment.json) | Evidence | ✅ |
| [`adr/`](./adr/) | Active directory | ✅ |
| [`cloudinary/`](./cloudinary/) | Active directory | ✅ |
| [`copilotkit-mastra/`](./copilotkit-mastra/) | Active/research directory | ✅ |
| [`data/`](./data/) | Active directory | ✅ |
| [`linear/`](./linear/) | Active directory | ✅ |
| [`mastra/`](./mastra/) | Active directory | ✅ |
| [`mermaid/`](./mermaid/) | Active/reference directory | ✅ |
| [`reference/`](./reference/) | Reference directory | ✅ |
| [`screenshots/`](./screenshots/) | Evidence directory | ✅ |
| [`supabase/`](./supabase/) | Active directory | ✅ |
| [`archive/`](./archive/) | Historical directory | ✅ |

### Completeness rule

Whenever a new top-level file or directory is added under `docs/`, update this table in the same PR. Files inside a documented directory must be represented by that directory's local README/index where one exists.

---

## 12. Domain / product execution map

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

Use [`prd.md`](./prd.md), [`sitemap.md`](./sitemap.md), and Linear for current implementation scope and ordering.

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

## 13. Documentation maintenance rules

1. **One global index:** `docs/index-docs.md`.
2. Domain/folder README files organize only their own directory.
3. Do not create another repository-wide documentation index.
4. Product truth belongs in `prd.md` / `sitemap.md`.
5. Architecture decisions belong in ADRs.
6. Live task status belongs in Linear.
7. Superseded material moves to `archive/`.
8. Add new docs to the appropriate existing domain before creating a new top-level folder.
9. Run `npm run docs:check` after documentation changes.
10. Any new top-level `docs/*` file/folder must be added to the inventory above in the same change.

---

## Summary

**Single documentation entry point:** [`docs/index-docs.md`](./index-docs.md).

It covers product docs, architecture, CopilotKit/Mastra, Supabase/data, Cloudinary/media, Linear standards, diagrams, references/evidence, and the complete historical archive.
