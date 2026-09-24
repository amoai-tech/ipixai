---
name: refactor-plan
description: 'Use when a multi-file refactor needs investigation, sequencing, dependency analysis, rollback planning, or an explicit execution plan before code changes.'
---

# Refactor Plan

## Boundary

Use `writing-plans` for normal accepted-spec → implementation planning. Use this skill only when an existing system must be structurally migrated and dependency order, compatibility/coexistence, caller migration, or rollback materially affects safety.

Create a detailed plan before making any code changes.

## Instructions

1. Do not edit files while preparing the plan.
2. Search the codebase to understand the current state. Read enough implementation, tests, configuration, and docs to make the plan specific to the repository.
3. Identify affected files, ownership boundaries, dependencies, and likely hidden coupling.
4. Plan changes in a safe sequence. Prefer contracts and types first, then implementations, then callers, then tests, then cleanup.
5. Include verification steps between phases and a final validation command.
6. Include rollback or recovery steps for the riskiest phases.
7. Output the complete plan using the format below.
8. If the user asked for planning only, stop after the plan and ask for confirmation. If the user already asked to implement the refactor, present the plan/checkpoints and continue without a second confirmation unless a STOP condition, ambiguity, or materially changed scope requires a decision.

If the request is too ambiguous to plan safely, ask concise clarifying questions instead of editing files.

## Output Format

```markdown
## Refactor Plan: [title]

### Current State
[Brief description of how things work now]

### Target State
[Brief description of how things will work after]

### Affected Files
| File | Change Type | Dependencies |
|------|-------------|--------------|
| path | modify/create/delete | blocks X, blocked by Y |

### Execution Plan

#### Phase 1: Types and Interfaces
- [ ] Step 1.1: [action] in `file.ts`
- [ ] Verify: [how to check it worked]

#### Phase 2: Implementation
- [ ] Step 2.1: [action] in `file.ts`
- [ ] Verify: [how to check]

#### Phase 3: Tests
- [ ] Step 3.1: Update tests in `file.test.ts`
- [ ] Verify: Run `npm test`

#### Phase 4: Cleanup
- [ ] Remove deprecated code
- [ ] Update documentation

### Rollback Plan
If something fails:
1. [Step to undo]
2. [Step to undo]

### Risks
- [Potential issue and mitigation]
```

After the plan: if this was a planning-only request, ask: "Shall I proceed with Phase 1?" If implementation was already requested, continue directly to Phase 1 unless a STOP condition applies.
