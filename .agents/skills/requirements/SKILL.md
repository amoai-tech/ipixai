---
name: requirements
description: Use when defining or reviewing product requirements as an Epic, user story, acceptance criteria, or testable requirements package before implementation or Linear task breakdown.
---

# Requirements

Own product-requirements definition and review. Preserve business intent, expose ambiguity, and make requirements testable before implementation begins.

## Choose the mode

| Need | Mode |
|---|---|
| Turn an Epic or broad feature into a formal requirements package | **Epic mode** |
| Create or refine a focused story and acceptance criteria | **User story mode** |
| Audit existing requirements for completeness and testability | **QA review mode** |

Do not use this skill for every planning artifact:

- Use `to-spec` for conversation → spec when no interview is wanted.
- Use `tasks` for the canonical iPix/Linear executable task.
- Use `writing-plans` for accepted spec → implementation plan.

## Common quality gate

Check the smallest set needed for the requested mode:

- business value, actors, scope, and out-of-scope boundaries
- assumptions, constraints, dependencies, and business rules
- atomic, observable, pass/fail acceptance criteria
- contradictions, missing decisions, and hidden coupling
- happy path, empty/error states, permissions, recovery, and edge cases
- measurable non-functional requirements where they materially affect delivery

Ask only questions that block a reliable requirement. Prefer concise A/B/C or yes/no choices when possible. If the user explicitly wants a no-interview conversion, route to `to-spec` instead.

## Epic mode

1. Validate title, business value, stakeholders, scope, constraints, requirements, and success metrics.
2. Identify implicit gaps, cross-story dependencies, contradictions, and missing failure behavior.
3. Ask targeted clarification questions only for material gaps.
4. Produce a formal package with: Executive Summary; Scope; Assumptions; Business Rules; Functional Requirements; Non-Functional Requirements; User Stories + Acceptance Criteria; Dependencies & Flow; Edge Cases & Error Handling; QA Considerations; Open Questions.
5. Keep requirement IDs stable when revising an existing package.

## User story mode

1. Establish actor, desired capability, business outcome, and scope.
2. Ask up to five targeted questions only when missing information changes acceptance behavior.
3. Produce: `US-xxx: Title`; Business Context; User Story; Acceptance Criteria; Technical Notes only when already constrained; Out of Scope; Dependencies; QA Notes; Open Questions.
4. Keep acceptance criteria implementation-agnostic unless the requirement explicitly constrains implementation.
5. Separate independent behaviors so each criterion can pass or fail on its own.

## QA review mode

Default to a structured review without interviewing the user. Extract the current requirements, flag ambiguity/contradictions/testability gaps, derive missing acceptance criteria and edge cases, and report remediation needed before implementation.

Use the clarification drill only when the user requests interactive review or unresolved decisions prevent testability. Ask one bounded question at a time and confirm the answer before continuing.

Read `references/qa-review.md` for the detailed review workflow and output contract. Use `references/requirements-review-examples.md` when examples help calibrate the review.

## Handoff

Requirements define **what must be true**. Once approved:

- hand executable iPix work to `tasks`;
- hand multi-step implementation design to `writing-plans`;
- keep unresolved product decisions in this skill rather than hiding them in implementation tasks.
