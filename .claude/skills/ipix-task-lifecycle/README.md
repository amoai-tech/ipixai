# ipix-task-lifecycle

Five-phase orchestrator for **iPix / FashionOS** Linear team **IPI**: plan → research → implement → test → ship.

**Hub:** [SKILL.md](./SKILL.md) v1.8.0

---

## Phases

| Phase | Goal | Key refs |
|-------|------|----------|
| 1 Plan | Linear steps, AC, **domain skills** | [domain-skill-routing.md](./references/domain-skill-routing.md) · [linear-issue-steps.md](./references/linear-issue-steps.md) |
| 2 Research | MCP probes, graphify | [task-verifier](../task-verifier/SKILL.md) readiness |
| 3 Implement | Worktree + **Step 1b gate** + domain skills | [implementation.md](./implementation.md) · [worktrees](../worktrees/SKILL.md) |
| 4 Verify | Area matrix | [per-task-testing.md](./references/per-task-testing.md) |
| 5 Ship | PR + Linear Done | [pr-workflow](../pr-workflow/SKILL.md) |

---

## Quick links

| Resource | Path |
|----------|------|
| Canonical tracker | Live Linear issue/project + `tasks` progress standard |
| Executable task spec | Live Linear issue + `.claude/skills/tasks/SKILL.md` |
| Skill map | [`tasks/intelligence/ai/skill-map.md`](../../../tasks/intelligence/ai/skill-map.md) |
| Forensic gate | [task-verifier](../task-verifier/SKILL.md) |

---

## Linear MCP

- **Read:** `mcp__linear-ipix__get_issue`
- **Status:** `mcp__claude_ai_Linear__save_issue` (`In Progress` / `Done`) — not `linear-ipix` save

---

## Child skills

See routing table in [SKILL.md § Child skills](./SKILL.md).
