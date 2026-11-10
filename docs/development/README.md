# iPix — Lightweight spec-driven task handoff

**Use when a task actually needs it.** The product-wide [intent](../intent.md), [spec](../spec.md), and [plan](../plan.md) explain iPix; this directory provides optional **task-level** starting points. They are not mandatory task documents or a second task manager.

The authoritative sources remain [AGENTS.md](../../AGENTS.md), the existing [tasks skill](../../.claude/skills/tasks/SKILL.md), current `origin/main` and runtime, and the **live Linear issue** for acceptance, dependencies, progress and evidence.

## Choose the smallest path

| Task | Use | Do not do |
|---|---|---|
| **Small fix**: single clear local defect, no new business decisions | Live IPI issue → affected code → focused test → one PR | No task intent/spec/plan files |
| **Normal feature**: clear Linear acceptance and implementation plan | Existing issue + relevant portions of product guides, domain skills, and current code | No repeated issue text or second plan |
| **Complex or resumable**: cross-team ambiguity, several coupled boundaries, or real session handoff gap | Reuse existing task artifacts; create only the missing [intent](./templates/intent.md), [spec](./templates/spec.md), [plan](./templates/plan.md) sections necessary to settle open decisions | No new Linear issue, checklist, release authority, or parallel progress tracker |

**Trigger to create files:** identify the exact unresolved question or missing handoff in the live IPI issue. If it is faster to clarify that issue directly, do so instead. **One approved decision, one owner.**

## Responsibilities and authoring order

1. **Intent (WHY):** customer problem, actor, outcome, constraints, non-goals, open questions. Review with product owner before turning assumptions into requirements. Avoid committing to a stack. [Template](./templates/intent.md).
2. **Spec (WHAT):** observed functionality, existing features to reuse, browser/server/database trust, failure/retry behavior, acceptance tests. Link the exact Linear issue and approved intent. [Template](./templates/spec.md).
3. **Plan (HOW):** inspect clean current main and linked PRs first, map existing symbols and official references to exact file changes and focused tests. Specify STOP/recovery, avoid duplicate tasks. Keep progress and evidence in Linear, **not a second Markdown tracker**. [Template](./templates/plan.md).

Store genuinely needed task artifacts under `docs/development/tasks/IPI-XXXX/`. **Optional**: one or two files may be enough. Do not generate all three automatically or treat filenames as agent-native magic.

### Which agent reads them?

- **Shared:** `AGENTS.md` provides the decision gate. A coding agent follows the applicable paths explicitly after loading repository instructions.
- **Claude Code:** `CLAUDE.md` imports `@AGENTS.md`; otherwise a working-directory `CLAUDE.md` can hide `AGENTS.md` under Claude's default instruction-file mode. No parallel Claude-only task instructions.
- **Codex and other AGENTS-aware agents:** follow `AGENTS.md` and the same Linear/artifact links; do not presume every external model automatically discovers arbitrary Markdown.
- **All agents:** fetch live Linear and current SHA again after an interruption. The issue's handoff must state last verified checkpoint, blockers, PR/head, exact next step and tests. Static task files never override newer verified runtime.

## Pilot — avoid a duplicate CopilotKit upgrade

[IPI-1389 pilot](./tasks/IPI-1389/intent.md) demonstrates the boundary. The CopilotKit/AG-UI code upgrade is already merged in [PR #319](https://github.com/amoai-tech/ipixai/pull/319), but release/certification evidence belongs in [the existing Linear issue](https://linear.app/amo100/issue/IPI-1389). The correct handoff is **verify pending live acceptance**, not create another upgrade PR. The [spec](./tasks/IPI-1389/spec.md) and [plan](./tasks/IPI-1389/plan.md) are concise examples of the decision; do not treat them as an alternate runbook.

## External references applied here

- **Official — MODEL:** [Anthropic: Capture intent](https://academy.claude.com/courses/ai-native-sdlc-playbook/capture-intent), *Capture as intent.md*. Apply problem-first, human-reviewed intent to `templates/intent.md`; **do not copy** a requirement for one file per ticket or another product-ownership system. Verify intent has no premature technology decisions.
- **Official — ADAPT:** [Claude Code: Memory / AGENTS.md](https://code.claude.com/docs/en/memory), *When Claude Code reads AGENTS.md* and *Share one file with other coding tools*. Apply `@AGENTS.md` import to root `CLAUDE.md`; **do not copy** duplicate Claude task rules or large startup imports. Verify the import and canonical precedence.
- **Official — REFERENCE ONLY:** [GitHub Spec Kit README](https://github.com/github/spec-kit), *Specify CLI / workflow*. Reuse the spec → plan → implement **idea** in our existing tasks skill; **do not install** the CLI, generated constitutions, task registers or extra agents. Verify no new dependency or folder machinery.
- **Third-party — MODEL:** [DataCamp: Spec-driven development](https://www.datacamp.com/tutorial/spec-driven-development-with-claude-code), *What is spec-driven development?* Apply observable criteria and progressive planning to `templates/spec.md` and `templates/plan.md`; **do not adopt** its larger role-by-role framework or mandatory review for each small step.
- **Third-party — REFERENCE ONLY:** [Digital-Tvilling/plan.md](https://github.com/Digital-Tvilling/plan.md), *Schema Files / Plan Files*. Plain Markdown format only; **do not copy** experimental schema validation.
- **Third-party — MODEL:** [Claude Code Intent Masterclass](https://newsletter.claudecodemasterclass.com/p/claude-code-intentmd-masterclass), *Intent structure*. Use short problem/outcome/constraints questions, not a second skill or a requirement to interview for every change.
- **Third-party — REFERENCE ONLY:** [Dev Genius: intent/spec/plan](https://blog.devgenius.io/i-thought-claude-md-was-enough-then-i-discovered-intent-md-spec-md-and-plan-md-a9e94252dc7c), *distinct responsibilities*. Helpful explanation; not official Claude Code loading behavior.

## What proves success?

A different coding agent can open the *same* Linear issue after a restart, identify the current code/PR owner and next unproven gate, and finish without creating a second issue, new architecture, or redundant review. Measure repeated plan artifacts, PR fix/review cycles, and elapsed time per **verified** feature before claiming faster delivery.
