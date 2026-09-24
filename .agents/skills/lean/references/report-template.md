# Lean audit — report template & scoring

After completing all six audit areas in `SKILL.md` (+ optional Audit 7), produce this exact
report. Fill in every section — never skip a section, even if the score is 100/100.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LEAN AUDIT — [repo name] — [date]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SPEED SCORE: [X]/100

  Repo health       [score]/20  [emoji]
  Ignore files      [score]/20  [emoji]
  Git workflow      [score]/15  [emoji]
  CI/CD pipeline    [score]/15  [emoji]
  Build & tests     [score]/15  [emoji]
  Linux & hardware  [score]/15  [emoji]

Emoji guide: ✅ >80% ⚠️ 50-80% 🔴 <50%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOP BOTTLENECKS  (ranked by impact)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#1 [bottleneck name] — saves ~[Xmin] per PR/day
   Why it hurts: [one sentence]
   Fix: [command or step]

#2 ...
#3 ...
(list all findings, minimum 5)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ QUICK WINS  (<5 minutes each)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ ] [fix name]
    $ [exact command to run]
    Verify: [command that confirms it worked]

[ ] ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 MEDIUM IMPROVEMENTS  (<30 minutes each)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ ] [fix name]
    What to do: [2-3 sentences]
    Verify: [command]
    Saves: ~[X min] per [occurrence]

[ ] ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏗️  ADVANCED IMPROVEMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ ] [fix name]
    Why: [reason]
    How: [approach, not a full tutorial]
    Saves: ~[X min] per [occurrence]

[ ] ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI CONTEXT WASTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Estimated tokens Claude is reading unnecessarily per session:
  [item]: ~[N]k tokens — fix: [action]

Total unnecessary context: ~[N]k tokens/session
At ~$[X]/1M tokens → ~$[Y]/day wasted (or [Z] minutes of slower responses)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALREADY GOOD ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- [thing that's already optimised] — keep it
- ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTIMATED TOTAL SAVINGS IF ALL FIXED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Per PR:    ~[X] minutes saved
  Per day:   ~[X] minutes saved
  Per week:  ~[X] minutes saved
```

## Scoring guide

| Area | Max | What earns full marks |
|---|---|---|
| Repo health | 20 | <3000 files, no stale worktrees, no merged branches, docs scoped |
| Ignore files | 20 | `.claudeignore` present, covers node_modules/dist/lock files/generated/docs |
| Git workflow | 15 | pre-push hook, fsmonitor on, typecheck+test scripts present |
| CI/CD | 15 | <8min avg run, node_modules cached, jobs parallelised where possible |
| Build & tests | 15 | incremental tsc, skipLibCheck, turbopack for dev, test parallelism |
| Linux & hardware | 15 | performance governor, ≥524288 inotify, <80°C, zram/swap adequate |

Deduct proportionally for partial wins (e.g., pre-push hook exists but only covers lint, not typecheck → 8/15 for git).
