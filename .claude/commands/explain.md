---
description: "Compatibility shim for the canonical iPix /explain skill."
argument-hint: "<thing to explain> [--eli5|--dev] [--short]"
---

# Legacy /explain command shim

The authoritative workflow is `.claude/skills/explain/SKILL.md`.

Invoke `/explain` normally; Claude Code prefers the project skill when a command and skill share the same name. Keep this file only for compatibility with older sessions.

**If this file is the only thing that loaded** (your Claude Code version does not auto-prefer the project skill over this command), do not stop here: read `.claude/skills/explain/SKILL.md` directly right now and follow it for `<thing to explain>`. Re-invoking `/explain` will not help in that case.
