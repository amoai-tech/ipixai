---
description: "Compatibility shim for the canonical iPix /fastest skill."
argument-hint: "<IPI-XXX|task name|description>"
---

# Legacy /fastest command shim

The authoritative workflow is `.claude/skills/fastest/SKILL.md`.

Invoke `/fastest` normally; Claude Code prefers the project skill when a command and skill share the same name. Keep this file only for compatibility with older sessions.

**If this file is the only thing that loaded** (your Claude Code version does not auto-prefer the project skill over this command), do not stop here: read `.claude/skills/fastest/SKILL.md` directly right now and follow it for `<IPI-XXX|task name|description>`. Re-invoking `/fastest` will not help in that case.
