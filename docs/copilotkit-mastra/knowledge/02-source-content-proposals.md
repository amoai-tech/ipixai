# 02 — Suggested iPix Knowledge Documents and Real User Examples

**Owner:** [IPI-1469 — iPix Knowledge 3](https://linear.app/amo100/issue/IPI-1469). **Status:** Content proposals only. These are **not verified iPix company policies**. Do not publish or seed until the correct operational/domain owner approves their factual contents and document source. Start with public/internal non-sensitive generic material.

## What belongs in Knowledge?

| Priority | Proposed Markdown document | Real-world operator question | Content to verify before seeding | Source-of-truth separation |
| --- | --- | --- | --- | --- |
| 1 | pre-shoot-checklist.md | “What do I confirm before our fashion shoot?” | Current shoot prep steps, responsibilities, date/version, known exceptions | Shoot booking/status stays in Supabase, not a copied checklist |
| 2 | asset-upload-review-handoff.md | “How do I check the right version and hand off approved images?” | Current Cloudinary upload/preview, actual asset QA, version-aware access, handoff | Cloudinary/asset tables own actual media, version and approval state |
| 3 | brand-dna-review-process.md | “How do I review the generated Brand DNA draft?” | Actual draft review sequence, provenance, existing UI flows and owner | Brand Profile/RPC owns Brand truth, not Knowledge |
| 4 | shoot-plan-review-save.md | “What happens when I approve the AI Shoot Plan?” | Current review/approve/save/reopen path and retry advice | Actual review revision/hash and one persisted Shoot remain in database |
| 5 | campaign-ready-assets-checklist.md | “Which assets should I prepare for a social campaign?” | Current supported channels/specs, approved asset versions, draft vs published rules | Campaign and provider status remain in current records |

**Preferred content sources:** Existing product docs, current in-repo checklists, code-backed workflow descriptions and actual approved operational runbooks. If no authoritative source exists, create a draft and label it **Proposed — not approved**, rather than asserting a policy. No copying private customer photos, Brand secrets, contracts, passwords, social tokens or live price estimates into alpha Knowledge.

## Suggested source page format

Each source-controlled Markdown page should carry:

- **Title and purpose:** short and understandable to an operator.
- **Source path + owning team:** permanent repository path or documented company source.
- **Validated date + content revision/hash:** helps show freshness and update the same Knowledge page.
- **Scope:** exact server-assigned read scope, preferably a non-sensitive shared runbook scope for pilot; not a client-provided arbitrary organization ID.
- **Procedure/checklist:** specific steps derived from approved current iPix workflow.
- **Exceptions/unknowns:** clearly mark missing or app-specific behavior not yet implemented.
- **Last review / next review:** owner-maintained; Knowledge alpha has no automatic stale-page expiration.

### Example — proposed pre-shoot question and answer pattern

**Question:** “What should we check before a product photoshoot?”

**Expected output structure:**

1. “I found the *Pre-shoot checklist* runbook.”
2. A concise checklist using only the current cited text; for example, proposed categories might be **shoot brief**, **products/variants**, **team/schedule**, **deliverables**, and **asset handoff**. The precise required checks must be verified by the owner before inclusion.
3. “Source: [actual document title and path], revision X, last reviewed on [source date]”.
4. “I could not confirm [missing information] from the available runbook” instead of inventing deadlines, policies, verified facts or approvals.

### Another useful question — media review

**Question:** “Which version of these product photos should I hand off?”

Knowledge can explain the approved **procedure**, but it must *not* make up an asset version. The agent should call the existing authorized Cloudinary/asset tool for the **actual asset ID, version and review status**, then use Knowledge only to explain the checklist.

## Source validation and loading process

1. Select three source documents with actual maintainers. Compare text to the current app, not to an older plan.
2. Remove secrets/customer data; define the non-sensitive scope.
3. Write only reviewed Markdown to a **dedicated source-content folder**, for example a new docs/knowledge/ folder after confirming no existing owned runbooks fit. This folder does **not** yet exist and is deliberately separate from docs/copilotkit-mastra/knowledge/, which contains the implementation plans. Preserve source metadata.
4. Under IPI-1469, implement an idempotent server seed using the native Knowledge API (upsertPage). Re-run twice and prove one page per source key, not duplicates.
5. Modify one Markdown page and re-run. The same Knowledge ref/version should update, with source path/hash retained.
6. **Retire withdrawn sources:** Compare the current approved source manifest with previously seeded page IDs. When a source is deleted, withdrawn or no longer approved, block it from retrieval until a guarded server-side retirement executes. The [Mastra Knowledge loading guide](https://mastra.ai/docs/knowledge/load-your-content#keep-content-in-sync) states that upsert does **not** remove deleted source pages: use the version-verified native `removePage()` after handling child-page dependencies. Never silently leave withdrawn content searchable, and do not remove unrelated still-approved pages. Seed/retirement writes remain server-only.
7. **Regression:** Seed sources A and B; remove A from the authoritative manifest; run reconciliation twice; verify A cannot be read/searched and the user gets the missing-document fallback, while B remains readable at its original version.
8. From existing /app ask each proposed question, verify exact cited page, a no-result fallback and malicious-document prompt injection resistance.
9. Test another organization and lost/invalid auth; no readable content must cross scope boundaries.
10. Do not enable autonomous agent writes, bulk importer, public Studio or pinned context until IPI-1470 provides reliable scoped proof.

## Product-agent knowledge boundaries

| Knowledge source | Where truth actually lives | How the agent should combine it |
| --- | --- | --- |
| Shared production runbook | Native Mastra Knowledge read-only pages | Explain procedures, quote/cite the source |
| Approved Brand DNA | Existing Brand Profile and evidence service | Fetch exact approved facts; show provenance, not a free-form Knowledge copy |
| Actual Shoot plan/status | Current Shoot tables and domain RPCs | Fetch real state and only save via reviewed server action |
| Actual asset media/QA status | Current Cloudinary and version-aware asset service | Return authorized live asset IDs and status; Knowledge explains workflow |
| Previous conversation | Mastra thread Memory | Remember context; do not treat prior chat as company policy |
| External fashion website | Verified bounded research tool/provider | Cite actual sources, avoid importing untrusted page text as company runbook |

**Real-world feature goal:** A Production Copilot that knows *how* iPix procedures work without pretending Knowledge contains the *current state* of a campaign, booking or asset.
