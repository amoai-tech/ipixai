---
name: resolving-merge-conflicts
description: "Use when an iPix git merge or rebase has conflicts that must be resolved by intent rather than by choosing one side mechanically."
---

1. **See the current state** of the merge/rebase. Check git history, the conflicting files, and `git status`. Record any staged or unstaged changes that existed before conflict resolution so unrelated local work is not absorbed into the merge/rebase result.

2. **Find the primary sources** for each conflict. Understand deeply why each change was made, and what the original intent was. Read the commit messages, check the PRs, check original issues/tickets.

3. **Resolve each hunk.** Preserve both intents where possible. Where incompatible, pick the one matching the merge's stated goal only when primary-source evidence supports that choice. Do **not** invent new behaviour. If a safe evidence-backed resolution cannot be established, pause or abort the merge/rebase instead. If resolution requires a new design trade-off not established by the source work, require user confirmation before committing it.

4. Discover the project's **automated checks** and run the cheapest decisive checks for the affected paths, then broader checks when risk requires them. Fix anything the merge/rebase broke.

5. **Finish the merge/rebase safely.** Stage only the resolved files/hunks that belong to the current merge/rebase; never use a blanket stage that can capture unrelated work. Inspect `git diff --cached` and `git status` before committing or continuing. Commit/continue only after every conflict is safely resolved and the staged diff contains no unrelated changes. If rebasing, continue until all commits are rebased; if the operation was intentionally abandoned, leave the repository in the clean recoverable state produced by the abort.

## iPix safety additions

- Before editing, confirm the intended branch/worktree and preserve unrelated local work.
- Use the full `IPI-NNN · TASK-ID — Full Task Name` when Linear intent is part of the conflict source.
- For Supabase migrations/RLS/RPCs, auth/tenant code, Mastra memory/HITL/workflows, dependency families, publishing, payments, or production config, textual conflict resolution is not sufficient: run the owning domain skill's targeted verification afterward.
- Never resolve by blindly taking `ours`/`theirs` across a whole file unless primary-source evidence proves one side fully supersedes the other.
- After each resolved high-risk group, run the cheapest decisive proof before continuing the rebase/merge when practical.
