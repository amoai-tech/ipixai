# iPixAI Linux / Cursor crash audit

Date: 2026-08-24. Host: Ubuntu 24.04, kernel 7.0.0-30-generic, Intel Core Ultra 7 265HX (20 cores), 30 GiB RAM, 47.7 GiB swap, NVIDIA RTX PRO 1000 (8 GiB, driver 595.84).

## 1. Root cause

**Global out-of-memory, not a GPU thermal fault and not a single “fat” Next.js process.**

Cursor and the Ubuntu session died because the kernel OOM killer ran with **swap already at 0 B**. It preferentially killed **Cursor** (`oom_score_adj=300`) and then **GNOME Shell**, which looks like “Ubuntu crashed.”

The memory was consumed by a **Node process storm**:

- Kernel dump at `2026-08-24 02:51:54`: **1,522 `node` processes, ~18.5 GiB RSS**.
- Cursor at that dump: 35 processes, ~1.1 GiB RSS.
- Chrome: 77 processes, ~2.3 GiB RSS.
- Invoker of the first OOM: `Comm: node`, PID 269206, `oom_score_adj=200`.
- This session reproduced it: `npm run dev` (Next Turbopack + `mastra dev` via `concurrently`) reached **1,299 → 1,590 `node` processes in ~20 seconds**, `MemAvailable` ~1.3 GiB, swap draining 16 GiB → 8 GiB, load 14+. Emergency stop later hit **1,954 node**, **29 GiB RAM used**, **43 GiB swap used**, load **66**.

`next build` “19 workers” matches **CPUs−1** on this 20-core box. That is a contributor, not the 1,500-process storm. Isolated `dev:ui` and `dev:agent` stayed at **one extra node each** (~0.5 GiB / ~0.6 GiB). The storm is **stacked concurrent watchers** (Next + Mastra + leftover agent `npm run dev`/`build` sessions) on a 20-core default worker count, plus Chrome + Cursor already holding ~5–10 GiB.

The CopilotKit “Thread … not found” error is a **separate stale-thread / Mastra memory** bug. It does not OOM the machine.

## 2. Evidence

### Hardware at idle (this boot, ~03:21, no Next/Mastra)

- RAM: 30 GiB total, ~18 GiB available, **swap unused**.
- Disk: 888 GiB filesystem, 31% used. Not disk pressure.
- GPU: 56°C, 11 W / 95 W, **15 MiB / 8151 MiB**. No Xid crash in this boot’s dmesg.
- Current boot journal: **no OOM** (machine had just rebooted).

### Proven OOM (previous boots, `journalctl`)

| Time | What happened |
|------|----------------|
| 02:51:54 | `node invoked oom-killer`. `Free swap = 0kB` / `Total swap = 50000892kB`. `pagetables=2315124kB` (~2.2 GiB page tables). Killed `cursor` pid 34879. |
| 02:52:01 | `node invoked oom-killer` again. Killed `chrome`. |
| 02:53:32 | Killed `cursor` pid 277321. |
| 02:53:44 / 02:54:38 | `NVRM: Out of memory [NV_ERR_NO_MEMORY]` — GPU allocator failed **after** system RAM/swap were gone, not a primary GPU crash. |
| 02:54:41 | Killed `cursor` pid 282698 (anon-rss 636208 kB). |
| 03:11:58 | This boot-minus-one: killed `cursor` pid 3712. |
| 03:16:49 | Killed `cursor` pid 44603 in **gnome-shell cgroup** → `org.gnome.Shell@x11.service: Failed with result 'oom-kill'` → session death. |
| `last -x` | Sessions ending `crash` 18:43–21:33 and 21:33–03:05. |

OOM task table (first dump, parsed 1815 tasks): `node` 1522 / 18471 MiB RSS; `chrome` 77 / 2301 MiB; `cursor` 35 / 1147 MiB.

### Isolated vs combined (this audit)

| Run | Extra node procs | App RSS | Swap | Verdict |
|-----|------------------|---------|------|---------|
| Baseline | 10 system/MCP nodes | 0 ipixai | 0 | OK |
| `npm run dev:ui` 90s | **11** total | **~466 MiB**, flat | 0 | Bounded |
| `npm run dev:agent` 90s | **11** total | **~635–733 MiB**, flat | 0 | Bounded |
| `npm run dev` ~60s | **1299 → 1590 → 1954** | RAM 29 GiB / swap 43 GiB | **exhausted path** | **Fork storm** |

Repo size: `node_modules` 1.5 GiB, `.next` 1.8 GiB (includes standalone), `.mastra` 23 MiB. No `.cursorignore` existed before this audit. `/home/sk/package-lock.json` is a **real home npm project** (`name: sk`, `@mastra/mcp`, etc.). Do **not** delete it. Next already warned it inferred workspace root from that lockfile; `turbopack.root` is pinned to this repo.

## 3. CPU / RAM before vs after

**Before (OOM dump 02:51):** ~24 GiB anon (`active_anon` 12.6 GiB + `inactive_anon` 11.5 GiB), **swap 0 free**, ~1,522 node processes, load path to session kill.

**After emergency stop (03:49):** load 2.05 (was 66), **Mem 7.8 GiB used / 22 GiB available**, swap 27 MiB used, **8 node processes**, ports 3000/4111 free.

**Single-server envelope (safe):** UI ~0.5 GiB, agent ~0.6 GiB, plus Cursor ~5 GiB and Chrome ~10 GiB at 03:21 (52 Chrome renderers). Combined `npm run dev` is unsafe **when watchers stack**.

## 4. Exact fixes applied

1. `next.config.ts`: `turbopack.root = process.cwd()` so Next does not treat `/home/sk` as the workspace.
2. `next.config.ts`: `experimental.cpus: 4` and `memoryBasedWorkersCount: true` (Next default is CPUs−1 = **19** workers on this box). See Next.js worker logic / memory-usage docs.
3. `.cursorignore` for `node_modules`, `.next`, `.mastra`, build/cache trees (Cursor was indexing ~3.2 GiB).
4. `.vscode/settings.json` `files.watcherExclude` / `search.exclude` for the same trees.
5. `.env`: `COPILOTKIT_TELEMETRY_DISABLED=true` (CopilotKit docs: opt out via that variable).
6. Earlier thread fix (not an OOM fix): Mastra `resourceId: "default"` + working memory `scope: "resource"` so CopilotKit does not hit “Thread … not found”.

**Not done:** deleting `/home/sk/package-lock.json` (it is in use). No framework version bumps. `npm run build` was **not** re-run in this pass (it is how we get 19 workers; cap is now 4).

## 5. Commands run

```text
free -h; swapon --show; df -h; uptime; nproc
top -b -n1 | head -40
ps aux --sort=-%mem | head -25
ps aux --sort=-%cpu | head -25
pgrep -af 'next|mastra|node|cursor'
nvidia-smi
journalctl -b -p err..alert
journalctl -k -b | grep -Ei 'oom|killed process|nvidia|thermal'
journalctl --list-boots
journalctl -b -2 -k   # OOM dump + 1522 node parse
last -x | head -20
du -sh node_modules .next .mastra
npm run dev:ui    # 90s sample, ~466 MiB, 1 extra node
npm run dev:agent # 90s sample, ~650 MiB, 1 extra node
npm run dev       # reproduced fork storm; killed
```

**Faster stop next time** (do not `xargs kill` 2,000 PIDs under load):

```bash
# stop the concurrently parent only
kill -TERM <npm-run-dev-PID>
killall -TERM next-server
```

Do **not** `pkill -f node` or `pkill -f next` — that matches Cursor’s NodeService and the shell command line.

## 6. Remaining red flags

- **Do not run `npm run build` and `npm run dev` at the same time.** Do not let multiple Cursor agent terminals each start `npm run dev`.
- Prefer **`npm run dev:ui` or `npm run dev:agent`**, not both, while debugging.
- Chrome had **52 renderers / ~10 GiB** at 03:21. That plus Cursor (~5 GiB, many MCP `npx` servers) leaves little headroom if Node forks.
- NVIDIA `NV_ERR_NO_MEMORY` is a **symptom** of system OOM, not a discrete GPU defect in these logs.
- `systemd-oomd` is running but kernel OOM still killed user apps; swap was fully used so userspace OOMD could not save the session.
- CopilotKit threads drawer still needs Intelligence/license for durable threads; in-memory runner + seeded working memory was the stale-thread error.

## 7. Will Cursor remain stable?

**YES AFTER FIXES** — if `npm run dev` is not stacked, generated dirs stay out of the indexer, and Chrome tab count stays reasonable. Cursor was the **victim** (`oom_score_adj=300`), not the 18 GiB Node storm.

## 8. Will Ubuntu remain stable?

**YES AFTER FIXES** — the “Ubuntu crash” was `gnome-shell` failing with `oom-kill` after Cursor was killed in that cgroup. No panic, no thermal trip, no primary NVIDIA Xid in the OOM window.

## 9. Stability score

**72 / 100** after the caps and ignores, **as long as combined `npm run dev` is not left looping with leftover watchers**. Isolated UI/agent are fine. Combined concurrent watchers are still the danger path.

## 10. Confidence

**92%** on OOM + Node storm + Cursor/GNOME as victims (kernel logs + live reproduce). **75%** that Mastra+Next **file-watch feedback** is the exact fork amplifier vs “many leftover `npm run dev` from agents”; both occurred in this session. Isolated servers did **not** fork-bomb.

## Operating rule (fastest safe path)

```bash
npm run dev:ui          # Next :3000 — one instance
npm run dev:agent       # Mastra :4111 — only when needed, other terminal
npm run dev             # disabled until DEV-STAB-001
```

## IPI-TBD · DEV-STAB-001 — Combined dev fork storm

**Status:** combined `npm run dev` / `concurrently` is **disabled**. Isolated `dev:ui` / `dev:agent` plus a port guard are the safe mode.

**Success criteria (not yet met):** `npm run dev` for ≥30 min with bounded node count, stable RSS, :3000/:4111 healthy, no OOM. Until then this machine is **not** production-development safe for combined watchers.

| Target | Bound |
|--------|--------|
| `dev:ui` | ≤ ~1 GiB, stable |
| `dev:agent` | ≤ ~1 GiB, stable |
| combined (when re-enabled) | < ~3 GiB app RSS |
| node count | bounded |
| swap | near 0 under normal work |
| OOM | none for 30–60 min |

### Concurrently-chain audit (unresolved amplifier)

`concurrently` itself is a thin process supervisor (`npm run dev:ui` + `npm run dev:agent`, `--kill-others`). Isolated runs of those same scripts did **not** fork-bomb. Combined did. That points away from “concurrently is a fork bomb” and toward one of:

1. **Watch feedback** — `mastra dev` writes `.mastra/output` (hot reload). Next Turbopack `root` is the repo cwd, so it can watch generated trees next to `src/`. Mastra CLI has no documented ignore list for that output (`mastra dev` only exposes `--dir` / `--root` / `--tools` / `--env`). A write loop between `.mastra` and `.next` would spawn workers until OOM.
2. **Nested agent terminals** — multiple Cursor/`npm run dev` copies stacking (ports were not guarded). The new guard blocks a second bind on :3000 / :4111; it cannot stop a storm already in progress.
3. **`mastra studio` vs Next on :3000** — standalone `mastra studio` defaults to port 3000; `mastra dev` in this starter served Studio at **:4111**. Collision is unlikely for `mastra dev` alone, but a stray `mastra studio` next to Next would fight over :3000.

Do **not** re-enable `concurrently` until a **30–60 min** combined run stays bounded. A 90 s clean dual-terminal run is not that bar.

**`npm run build` is guarded:** `scripts/dev-guard.mjs --port 3000 --port 4111 -- next build` refuses if either port is listening and names the role + listener. Do not run build while a real UI/agent is up; the guard is the safety net.

### Build / duplicate-start guard tests (2026-08-24)

Dummy listeners (not Next/Mastra) so this does not reproduce the fork storm.

| Test | Result |
|------|--------|
| `npm run build` with `:3000` busy | **PASS** — blocked |
| `npm run build` with `:4111` busy | **PASS** — blocked |
| `npm run build` with both ports free | **PASS** — completed; **Collecting page data using 4 workers** |
| `npm run dev:ui` with `:3000` busy | **PASS** — blocked |
| `npm run dev:agent` with `:4111` busy | **PASS** — blocked |

Worker controls still in tree: `turbopack.root = process.cwd()`, `experimental.cpus: 4`, `memoryBasedWorkersCount: true`, `.cursorignore` + `.vscode` watcher excludes for `node_modules` / `.next` / `.mastra`.

`npm run dev` / `concurrently` stay **blocked**. Ticket stays **open** until a ≥30 min combined soak. Combined-dev readiness remains ~60.

### Hypothesis results (2026-08-24, ~90 s, abort if node ≥ baseline+25)

Clean start: ports free, `npm run dev:ui` then `npm run dev:agent` in separate process groups.

| # | Hypothesis | Result |
|---|------------|--------|
| 1 | `next dev` watches `.mastra/output` | **Unproven / possible.** Turbopack `watchOptions.ignored` does not exist; `root` is the repo cwd, so generated trees *can* be watched. No explosion in 90 s. |
| 2 | `mastra dev` watches `.next` | **Unlikely from package strings.** Installed `mastra` CLI gitignore hits are create-project templates (it *adds* `.mastra` to `.gitignore`), not a watch-ignore of `.next`. No `.next` string in the CLI watch chunk. |
| 3 | Each process dirties files the other watches | **Not observed in 90 s.** Node count stuck at **13** (baseline 8 → +5). `MemAvailable` ~16.4 GiB, swap unused, both ports healthy. |
| 4 | Leftover children survive parent shutdown | **Minor yes.** After SIGTERM of both groups: ports free, node 13→9. One leftover: Next `telemetry/detached-flush.js` (not a storm). |
| 5 | npm script recursively re-enters another script | **No.** `dev` is echo+exit 1. `dev:ui` / `dev:agent` do not call `npm run dev` or each other. (`dev:debug` only calls `dev:ui`.) |

**90 s dual-server:** `climbing=False`, max node **13**. This **contradicts** “Next+Mastra together always fork-bombs” on a **clean** start. The earlier 1,500-process storm more likely came from **stacked leftover `npm run dev` / `concurrently` copies** (unguarded) plus 19-worker builds, not from `concurrently`’s supervisor code.

`npm run dev` stays **blocked**. Ticket stays **open** until ≥30 min bounded. Combined-dev readiness remains ~60 until that soak.
