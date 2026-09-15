---
name: resolving-merge-conflicts
description: "Use when an iPix git merge or rebase has conflicts that must be resolved by intent rather than by choosing one side mechanically."
---

1. **See the current state** of the merge/rebase. Check git history, and the conflicting files.

2. **Find the primary sources** for each conflict. Understand deeply why each change was made, and what the original intent was. Read the commit messages, check the PRs, check original issues/tickets.

3. **Resolve each hunk.** Preserve both intents where possible. Where incompatible, pick the one matching the merge's stated goal and note the trade-off. Do **not** invent new behaviour. Always resolve; never `--abort`.

4. Discover the project's **automated checks** and run them, typically typecheck, then tests, then format. Fix anything the merge broke.

5. **Finish the merge/rebase.** Stage everything and commit. If rebasing, continue the rebase process until all commits are rebased.

## iPix safety additions

- Before editing, confirm the intended branch/worktree and preserve unrelated local work.
- Use the full `IPI-NNN · TASK-ID — Full Task Name` when Linear intent is part of the conflict source.
- For Supabase migrations/RLS/RPCs, auth/tenant code, Mastra memory/HITL/workflows, dependency families, publishing, payments, or production config, textual conflict resolution is not sufficient: run the owning domain skill's targeted verification afterward.
- Never resolve by blindly taking `ours`/`theirs` across a whole file unless primary-source evidence proves one side fully supersedes the other.
- After each resolved high-risk group, run the cheapest decisive proof before continuing the rebase/merge when practical.
