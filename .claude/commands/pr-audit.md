---
description: "Adversarial task-verifier audit of a PR against the current Linear task, exact head, CI, and live runtime."
argument-hint: "<GITHUB_PR_URL>"
---

Review this PR using the current iPix verification standard:
PR: $ARGUMENTS

Use:

* `.claude/skills/tasks/SKILL.md`
* `.claude/skills/task-verifier/SKILL.md`
* the affected domain skills only
* current Linear task
* exact PR head/diff
* GitHub CI/reviews/comments
* current repo/runtime/live Supabase when applicable
* installed dependency source/types first
* Context7 / official docs / official GitHub only when current code/runtime cannot answer the question

Run `task-verifier` in Standard mode by default and automatically escalate to Adversarial mode for auth/RLS/tenant, Supabase migrations/RPCs, HITL/consequential AI, production config/release, webhooks, external callbacks, dependency/runtime security, payments/publishing, destructive writes, or Mastra persistence/resume/cancellation risks.

Faster/better approach: use Graphify first for dependency/path discovery when available, inspect only load-bearing files, run the cheapest decisive tests first, and stop broad testing if a smaller proof identifies a blocker.

Verify:

* whether the Linear task is still valid
* whether the PR actually implements each acceptance criterion
* whether the implementation reuses current iPix correctly
* errors, red flags, failure points, blockers, missing work
* whether PR comments/review-bot findings are actually correct
* Next.js / Supabase / Mastra / CopilotKit / Cloudinary contracts when affected
* migrations, RLS, RPCs and live DB state when relevant
* tenant isolation
* negative/recovery paths
* exact-head tests and CI
* browser/user journey when applicable
* post-merge requirements
* whether all tests could pass while the real user outcome is still broken

For every verdict provide exact evidence: file/line, SHA, command/test output, CI job, live query, or official version-specific source.

Classify every acceptance criterion: VERIFIED / PARTIAL / UNVERIFIED / FAILED.
Classify findings: BLOCKER / HIGH / MEDIUM / IMPROVEMENT / OUT-OF-SCOPE / NOISE.

End with:

* MERGE / MERGE AFTER FIXES / DO NOT MERGE
* overall score /100 when evidence is sufficient
* implementation correctness %
* estimated production success %
* production-ready checklist
* exact pre-merge tests
* exact post-merge actions
* smallest fixes/proofs required to reach verified Done

Final question: would this exact PR at this exact head SHA successfully deliver the current Linear task in production after merge? If not, what is the smallest set of actions required to make the answer YES?
