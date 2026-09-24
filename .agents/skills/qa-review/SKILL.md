---
name: qa-review
description: Review a feature, implementation, or pull request from a QA perspective — verify intended behavior, surface edge cases and negative flows, flag backwards-compatibility and merge risks, and identify the highest-value scenarios to verify. Use for "review this as QA", "what could go wrong?", "what am I missing?", "what should we test?", or PR merge-risk review.
license: MIT
metadata:
  source: consolidated from testomatio/skills qa-thinking + qa-review-pr
  version: 1.0.0-ipix
---

# QA Review

One QA review entry point for both feature/design analysis and pull-request review.

## Route by input

- **Feature / idea / implementation:** review the behavior, edge cases, negative paths, misuse, interactions, and unclear requirements.
- **Pull request:** first use `qa-pr-analysis` in combined mode to establish intended scope versus actual diff, then review backward compatibility, merge risks, and end-user verification scenarios.
- **Behavior unclear:** establish current product behavior with `qa-explain-behavior` before drawing conclusions.

Do not resolve ambiguity by inference. Every material conclusion needs explicit evidence from requirements, code, tests, runtime proof, or the PR/ticket context. If evidence is unavailable, write `NOT VERIFIED` and state what is missing.

## Think as QA

Check only risks that are relevant to the feature or PR:

- Does the implementation match the stated user/business intent?
- Are any requested requirements missing, misunderstood, or only partially implemented?
- Does the change contradict existing behavior or introduce a backward-compatibility break?
- Are there already similar product patterns that this change should preserve instead of duplicating?
- Negative paths: invalid input, denied access, failures, cancellations, retries, repeated actions.
- Boundaries: empty state, minimum/maximum values, large inputs, expired/stale state, partial completion.
- Interactions: how this feature combines with adjacent features, permissions, roles, workflows, and state transitions.
- Abuse and security scenarios that are visible or meaningful at the product level.
- Recovery: what the user sees and can do after a failure.

Avoid generic software checklists. Raise a scenario only when the requirement, affected domain, implementation, discussion, or established product behavior makes it relevant.

## Output — feature / implementation mode

Use these sections when the request is a general QA review rather than a PR merge review:

### 👷 Must be acknowledged

1. Brief feature summary.
2. Relevant interactions with existing behavior.
3. Material risks only.

### 👓 Must be clarified

Up to 5 unresolved questions. Phrase each as `What if ...?` and include only questions whose answer materially changes expected behavior or testing.

### 🔬 Must be verified

Up to 5 highest-value risk scenarios. Prefer actor/action/outcome language over implementation details.

Then offer only relevant next actions:
- split scenarios across testing levels → `qa-split-testing-levels-pyramid`
- turn scenarios into test cases/checklists → `qa-write-test-cases`
- review requirement defects → `qa-requirement-reviewer`

## Output — PR mode

Use these sections when reviewing a PR for QA/merge risk:

### 👷‍♀️ Is it done

State `Yes`, `No`, `Partially`, or `NOT VERIFIED`, then give 1–3 concise sentences comparing the PR to its stated requirement. Include a one-line original intent summary.

### 🦕 Backwards Compatibility

Describe user-visible or workflow compatibility risk. If none is supported by the evidence, say `No verified breaking changes`.

### 🌋 Merge Risks

1–5 evidence-backed risks introduced by this PR. Do not list generic risks that are unrelated to the changed behavior.

### 🔬 What must be verified

Up to 5 end-user scenarios, each starting with `**What if {persona} {verb}**`.

## Style

- Plain QA/product language first.
- Prefer actors, actions, outcomes, rules, and failure states.
- Avoid internal variable names, SQL, low-level syntax, and implementation trivia unless they are required evidence.
- File/class names are acceptable when they help locate evidence, but do not turn the answer into a code review.
- Keep the output compact and decision-useful.
