# Implementation workflow

Use this reference when a Linear issue is being implemented in code.

## iPix default

For iPix work, use `.claude/skills/tasks/SKILL.md` as the canonical execution contract. Live Linear is the task/progress source of truth; do not require a local issue mirror unless a separate task explicitly owns one.

## Generic workflow

1. **Fetch the issue**
   - Get title, description, status, priority, labels, project, initiative, assignee, and suggested branch name.

2. **Read local context**
   - For iPix: read the live Linear issue and `.claude/skills/tasks/SKILL.md`.
   - Search only related docs, PRDs, diagrams, and existing code needed to verify the task.

3. **Move to In Progress**
   - Update Linear state when the user asked you to work on it.
   - Use the team workflow state ID when available.

4. **Create or reuse branch**
   - Prefer Linear's suggested branch name.
   - If no branch name exists, use a concise prefix with issue identifier and slug.
   - Reuse an existing branch if present.

5. **Plan implementation**
   - Identify affected files.
   - Identify schema, edge, service, hook, UI, and tests.
   - Identify verification commands.
   - Ask only if the plan is ambiguous or risky.

6. **Implement**
   - Follow existing project conventions.
   - Add tests for meaningful behavior.
   - Keep changes scoped to the issue.
   - Do not commit unless the user explicitly asks.

7. **Verify**
   - Run the risk-matched commands from `tasks/references/pre-merge-tests.md`; do not invent missing scripts.
   - Run Supabase verification only when Supabase is touched.
   - Smoke-test browser flows when UI/auth/RLS/edge is touched.

8. **Update Linear traceability**
   - Add comments for meaningful milestones.
   - Link PR if created and requested.
   - Move state to `In Review` when a PR exists and the user asked for PR creation.
   - Move to `Done` only when explicitly requested and verification is complete.

9. **Report**
   - Summarize changes.
   - List Linear identifiers.
   - List verification evidence.
   - Note blockers or follow-up.

## Branch naming

Preferred:

```text
<issue-prefix>/<issue-id>-<short-slug>
```

Examples:

```text
ipi/ipl-16-add-brand-profile-schema
com-010-registry-search
plt-003-env-validation
```

Use lowercase, hyphens, and no spaces.

## PR creation

Create a PR only when the user explicitly asks. Include:

- Summary.
- Changes by area.
- Tests and verification.
- Linear issue reference.
- Screenshots or notes if UI changed.
- Breaking changes if any.

Do not merge or push unless explicitly asked.

## Verification by area

| Area | Verification |
|------|--------------|
| Frontend | `npm run build`, `npm run lint`, browser smoke |
| Tests | `npm run test` or targeted test command |
| Supabase schema/RLS | `npm run supabase:verify`, `npm run supabase:verify-rls` |
| Edge functions | `npm run supabase:verify-edge` |
| Env validation | `npm run check:env` |
| Commerce/Mercur | Follow Mercur package build/test commands |
