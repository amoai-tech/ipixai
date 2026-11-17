# graphify
- **graphify** (`.agents/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

# explain
- **explain** (`.claude/commands/explain.md`) — plain-English explanations. Trigger: `/explain`
Always-on voice: `.cursor/rules/explain.mdc` and `AGENTS.md`. When the user types `/explain`, follow that command (explain-only, do not change code). Every other reply still uses the always-on rule: analogy, no unexplained jargon, gist first.

# fastest
- **fastest** (`.claude/commands/fastest.md`) — vendor path before custom code. Trigger: `/fastest`
Always-on ladder: `.cursor/rules/verified-fast-path.mdc`. Once per phase: `.cursor/rules/fastest.mdc` — if a better/faster path exists, **use it**. `/fastest` is research only. Smallest diff: `ponytail.mdc`.
