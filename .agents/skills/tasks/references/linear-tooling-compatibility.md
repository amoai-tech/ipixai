# Linear template API and historical CLI compatibility

**Owner:** [tasks skill](../SKILL.md). This is an exception-only reference, not a separate task or Linear truth. Prefer the current live Linear MCP with its actual template parameter; re-check installed CLI/tool signatures when unavailable.

**When the template field is unreachable (tooling gap).** The template field is only settable through tooling that exposes it. As of 2026-09-28 the sanctioned fallback `linear-cli` (0.3.28) has no `--template` flag, so a session without a template-capable Linear MCP cannot apply one. This is a third case — neither a non-standard issue nor a Linear outage. Handle it thus: create the issue with the closest approved template's structure written into the body, state in the body that the template field could not be set and why, record the tooling version, and continue. Do not block the task, and do not create a duplicate later solely to attach template metadata.

**Identifiers are assigned, not chosen.** Linear assigns `IPI-NNN` at creation, so the `IPI-NNN · TASK-ID — Full title` form cannot be set in the create call. Create as `TASK-ID — Full title`, then rename to include the assigned identifier. A missing identifier in the title is drift, not a style preference.


When the template API is available, use it. Never create a second issue just to change template metadata; preserve the original issue's history. Do not assume the old CLI limitation still applies to future tools.

**Official reference — REFERENCE ONLY:** https://linear.app/developers/graphql — verify supported template/create/issue-update calls against the connected Linear integration; do not invent unsupported flags.
