---
title: "iPix documentation best practices"
description: "Canonical rules for GitBook, Markdown documentation, todo.md, changelog.md, and AI-assisted development in iPix."
---

# iPix documentation best practices

## Summary

Use one clear ownership model:

```text
Linear = live tasks, blockers, ownership, status
GitHub docs/ = canonical durable documentation
GitBook = published navigation, search, Markdown, MCP, AI discovery
todo.md = short current-session handoff
changelog.md = notable verified completed changes
Git/PRs/tests = implementation evidence
Claude / ChatGPT / Codex = assistants, not sources of truth
```

**Rule:** avoid duplicating the same truth across several systems.

## 1. Documentation source of truth

- Write and review documentation in GitHub first.
- Publish `docs/` through GitBook Git Sync.
- Keep Linear as the only live task/status tracker.
- Use code, tests, runtime evidence, and accepted ADRs to resolve stale-doc conflicts.
- Link to canonical pages instead of copying the same explanation into multiple files.

## 2. Organize docs for humans first

Organize navigation around iPix product areas and user journeys. Use Diátaxis to define what kind of page each document is.

- **Tutorial** — teaches a beginner through a complete first experience.
- **How-to** — gives practical steps to complete a task.
- **Reference** — records exact contracts, schemas, APIs, commands, or facts.
- **Explanation** — explains architecture, decisions, trade-offs, or concepts.

Do not force the entire repository into four Diátaxis folders. A developer looking for Shoot documentation should find **Shoots** first, then the relevant tutorial, how-to, reference, or explanation.

Keep navigation shallow where possible:

```text
Area
→ topic
→ page
```

Prefer descriptive filenames and titles. Avoid vague names such as `new-plan.md`, `stuff.md`, or `final-v2.md` for canonical docs.

## 3. Page writing standard

For active published pages, use minimal frontmatter:

```yaml
---
title: "Clear page title"
description: "One sentence explaining exactly what this page answers."
---
```
Frontmatter is optional for archives, evidence files, and temporary internal notes.

Writing rules:

1. One primary topic per page.
2. Use a predictable `H1 → H2 → H3` hierarchy.
3. Lead with the answer or outcome, then explain details.
4. Keep important facts in text, not only screenshots or diagrams.
5. Use fenced code blocks for commands and executable examples.
6. Use one canonical term for each concept.
7. Make sections understandable when retrieved independently by an AI tool.
8. Cross-link related canonical pages instead of duplicating content.
9. Move superseded material to `docs/archive/` and label it historical.
10. Update docs in the same PR when behavior, architecture, contracts, or user journeys materially change.

## 4. GitBook best practices

Use GitBook as the publishing and retrieval layer, not a second authoring source of truth.

```text
GitHub docs/
→ PR review
→ merge to main
→ GitBook Git Sync
→ published docs
```

For the current iPix Free-plan setup, prefer one space mapped to `./docs` instead of recreating many GitBook spaces and sections.

Do not manually maintain GitBook-generated AI outputs such as `llms.txt` unless a separate non-GitBook consumer specifically requires it.

## 5. AI and LLM optimization

Optimize normal documentation rather than creating a separate AI-only documentation set.

- Use clear titles, descriptions, headings, and canonical terminology.
- Keep pages focused enough that retrieval does not mix unrelated topics.
- Put exact commands, schemas, routes, and ownership boundaries in text.
- Archive stale architecture so agents do not retrieve obsolete decisions as current truth.
- Add realistic iPix examples to important architecture and workflow pages.
- Test important docs with real questions from Claude, ChatGPT, Codex, and GitBook MCP.

Useful golden questions include:

```text
How does iPix prevent cross-tenant access?
Where is an approved ShootPlan persisted?
What owns AI orchestration?
What owns canonical application state?
Can Mastra directly perform consequential writes?
How is a GitBook docs change published?
```

A correct answer should be current, complete, traceable to the right page, and free of stale terminology.

## 6. todo.md best practices

`todo.md` is a **short execution handoff**, not the project backlog.

Linear remains authoritative for task IDs, ownership, dependencies, blockers, and status.
Use `todo.md` for:

- current task/context;
- current blocker;
- next action;
- branch or PR;
- last verification result;
- short handoff notes for the next developer or AI session.

Keep it small and easy to scan. Remove completed temporary context after the work is merged and recorded elsewhere.

For code TODO comments, prefer traceable entries:

```ts
// TODO(IPI-1234): Retry transient GitBook sync failures.
```

Avoid unowned comments such as:

```ts
// TODO: fix later
```

Recommended AI-session flow:

```text
read repository instructions
→ read todo.md
→ verify Linear task
→ inspect branch/PR/code
→ work and test
→ update handoff if needed
```
## 7. changelog.md best practices

`changelog.md` is permanent, curated history of **notable verified changes**. It is not a commit log and not a second task tracker.

Use a Keep a Changelog-style structure:

```markdown
# Changelog

## [Unreleased]

### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security
```

Use ISO dates (`YYYY-MM-DD`) and newest entries first.

Good changelog entries explain the user/developer impact:

```text
Fixed Copilot run persistence so multi-turn conversations survive requests landing on different Vercel instances.
```

Do not record trivial formatting, variable renames, or every commit. Link notable entries to the relevant Linear issue and PR when useful.

AI may draft a changelog entry, but only verified shipped behavior belongs in the changelog.

## 8. How todo.md and changelog.md work together

```text
Linear issue
→ todo.md holds current execution context
→ implementation + tests + PR
→ merge
→ notable result goes to changelog.md
→ temporary todo.md context is removed
```

## 9. Documentation lifecycle

For meaningful product or engineering changes:

```text
Linear
→ implementation
→ tests
→ update affected docs
→ update changelog if notable
→ PR review
→ merge main
→ GitBook sync
→ verify published docs
```

A documentation change is not done merely because a Markdown file exists. Verify the published result when the page is intended for GitBook.

## 10. Verification

Before merging documentation changes:

```bash
npm run docs:check --if-present
git diff --check
git diff -- docs/
```

Then verify:

- canonical links resolve;
- no duplicate page competes as current truth;
- terminology matches the current product/code;
- commands and code examples are valid;
- important diagrams have supporting text;
- GitBook Git Sync succeeds after merge;
- representative AI questions return the correct current answer.

## 11. Linear development workflow

Linear is the live execution source of truth. Keep the existing lean workflow and four approved issue templates; do not add process states or duplicate task systems without evidence they are needed.

Every substantive issue must make this chain explicit:

```text
Purpose → Outcome → Implementation → Acceptance criteria → Verification → References
```

Use the approved template that matches the work: normal implementation → `Universal Engineering Task`; audit/research only → `iPix Task Audit & Implementation Plan`; confirmed root-cause repair → `Forensic Error Audit & Fix`; production certification → `Production Readiness / Release Gate`.

Use one-week cycles while they remain effective. Once per cycle, review active work and backlog: close duplicates, cancel genuinely stale work with a reason, move still-valid work to the right cycle/owner, and preserve historical evidence rather than deleting it just to reduce counts.

For GitHub integration, include the Linear identifier (`IPI-1234`) in the branch, commit, or PR so Linear can associate implementation with the issue. Verify team Git automations under Linear team settings rather than assuming status transitions are configured.

Coding agents must start from the live Linear issue plus current code/runtime truth, not past chat context. `todo.md` is only a short handoff pointer; `changelog.md` receives notable verified outcomes; durable behavior changes update `docs/**` in the same PR and GitBook publishes them after merge.

## Official references

- GitBook structure: https://gitbook.com/docs/guides/docs-best-practices/documentation-structure-tips
- GitBook AI/GEO: https://gitbook.com/docs/guides/seo-and-llm-optimization/geo-guide
- GitBook CLI: https://gitbook.com/docs/docs-as-code/gitbook-cli
- Diátaxis: https://diataxis.fr/
- Keep a Changelog: https://keepachangelog.com/en/1.1.0/

## Final rule

Keep every system focused on one job. If information is already authoritative somewhere else, link to it instead of creating another copy.
