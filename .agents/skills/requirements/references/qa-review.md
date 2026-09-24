# QA Requirements Review

Use this reference from the `requirements` skill when reviewing an existing Epic, story set, BRD, acceptance criteria, or other requirement package.

## Structured review — default

1. Extract each stated requirement without rewriting the source.
2. Check clarity, atomicity, completeness, consistency, feasibility, and testability.
3. Identify vague thresholds, compound behaviors, contradictions, missing actors, missing permissions, and undefined data/state transitions.
4. Derive missing acceptance criteria only when they follow from stated intent; label assumptions instead of inventing product decisions.
5. Check happy path, empty state, error state, authorization, recovery, boundaries, and meaningful non-functional constraints.
6. Separate implementation risk, testing risk, and business-impact risk when useful.

## Output contract

Return only sections that add value:

- Readiness assessment
- Key findings table: requirement · issue type · finding · question/recommendation
- Ambiguities and open questions
- Gaps and contradictions
- Acceptance-criteria review
- Edge cases and test considerations
- Risks and impact
- Remediation checklist / recommendation

## Clarification drill — optional

Use only when the user asks for interactive review or a missing decision blocks testability.

- Ask one question at a time.
- Prefer yes/no or A/B/C when the options are genuinely bounded.
- Confirm the answer before moving to the next unresolved requirement.
- Stop when remaining gaps can be recorded as explicit open questions rather than guessed.

## Review discipline

Do not silently rewrite requirements into a different product. Do not treat proposed acceptance criteria as approved facts. Preserve requirement IDs and source wording where possible so findings can be traced back to the artifact under review.

For worked examples, see `requirements-review-examples.md`.
