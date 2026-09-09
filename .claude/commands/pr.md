---
description: "Compatibility shim for the canonical iPix /pr skill."
argument-hint: "[status|fix|ship|resolve|open|ready|post-merge] [PR#]"
---

# Legacy /pr command shim

Custom commands have been superseded by project skills. The authoritative workflow is:

`.claude/skills/pr/SKILL.md`

Invoke `/pr` normally; Claude Code prefers the project skill when a command and skill share the same name.

**If this file is the only thing that loaded** (your Claude Code version does not auto-prefer the project skill over this command), do not stop here: read `.claude/skills/pr/SKILL.md` directly right now and follow it for the requested `[status|fix|ship|resolve|open|ready|post-merge]` action. Re-invoking `/pr` will not help in that case.

Do not duplicate PR workflow logic here. Keep this file only for compatibility with older Claude Code sessions until the repository no longer needs `.claude/commands/pr.md`.
