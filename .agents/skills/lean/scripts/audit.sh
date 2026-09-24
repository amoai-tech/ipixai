#!/bin/bash
# lean audit.sh — safe, read-only repo + environment scan
# Run from repo root: bash .agents/skills/lean/scripts/audit.sh

set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  LEAN AUDIT — $(basename "$REPO_ROOT") — $(date +%Y-%m-%d)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "── REPO SIZE ──────────────────────────────"
du -sh . --exclude=.git --exclude=node_modules 2>/dev/null || du -sh . 2>/dev/null
echo -n "File count (excl. node_modules/dist/.next): "
find . -not -path '*/node_modules/*' -not -path '*/.git/*' \
  -not -path '*/dist/*' -not -path '*/.next/*' -type f 2>/dev/null | wc -l

echo ""
echo "── LARGEST DIRS ───────────────────────────"
# Handle SIGPIPE from head truncating the pipeline
(du -sh */ 2>/dev/null | sort -rh | head -15) || true

echo ""
echo "── LARGEST FILES (excl. node_modules) ─────"
# Handle SIGPIPE from head truncating the pipeline
(find . -not -path '*/node_modules/*' -not -path '*/.git/*' -type f \
  -printf '%s %p\n' 2>/dev/null | sort -rn | head -15 \
  | awk '{cmd="numfmt --to=iec " $1; cmd | getline size; close(cmd); print size, $2}') || true

echo ""
echo "── IGNORE FILES ───────────────────────────"
for f in .gitignore .claudeignore .cursorignore .dockerignore; do
  if [ -f "$f" ]; then
    echo "✓ $f ($(wc -l < "$f") lines)"
  else
    echo "✗ $f MISSING"
  fi
done

echo ""
echo "── CLAUDEIGNORE GAPS ──────────────────────"
for pat in node_modules .next dist build coverage "*.log" package-lock.json \
           yarn.lock pnpm-lock.yaml ".cache" graphify-out; do
  if grep -q "$pat" .claudeignore 2>/dev/null; then
    echo "✓ $pat"
  else
    echo "✗ MISSING: $pat"
  fi
done

echo ""
echo "── GIT WORKFLOW ───────────────────────────"
echo -n "pre-push hook: "
[ -x .git/hooks/pre-push ] && echo "✓ exists" || echo "✗ MISSING"
echo -n "pre-commit hook: "
[ -x .git/hooks/pre-commit ] && echo "✓ exists" || echo "✗ missing"

echo "git config:"
echo "  fsmonitor: $(git config core.fsmonitor 2>/dev/null || echo NOT SET)"
echo "  untrackedCache: $(git config core.untrackedCache 2>/dev/null || echo NOT SET)"
echo "  manyFiles: $(git config feature.manyFiles 2>/dev/null || echo NOT SET)"

echo ""
echo -n "Stale merged branches: "
# Handle case where grep finds no matches (exit code 1) - capture output to prevent double print
count=$(git branch --merged main 2>/dev/null | grep -v '^\*\|main\|master\|develop' 2>/dev/null | wc -l | tr -d ' ' || true)
echo "${count:-0}"

echo ""
echo "── WORKTREES ──────────────────────────────"
git worktree list

echo ""
echo "── APP SCRIPTS ────────────────────────────"
if [ -f app/package.json ]; then
  python3 -c "
import json,sys
with open('app/package.json') as f: s=json.load(f).get('scripts',{})
for k in ('typecheck','test','build','lint','dev'):
  status = '✓' if k in s else '✗ MISSING'
  print(f'  {status} {k}: {s.get(k,\"\")}')
" 2>/dev/null
fi

echo ""
echo "── TSCONFIG ───────────────────────────────"
if [ -f app/tsconfig.json ]; then
  python3 -c "
import json
with open('app/tsconfig.json') as f: c=json.load(f)
opts=c.get('compilerOptions',{})
print('  incremental:', opts.get('incremental','NOT SET'))
print('  skipLibCheck:', opts.get('skipLibCheck','NOT SET'))
print('  exclude:', c.get('exclude','NOT SET'))
" 2>/dev/null
fi

echo ""
echo "── LINUX PERF ─────────────────────────────"
echo -n "CPU governor: "
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || echo "N/A"

echo -n "Power profile: "
powerprofilesctl get 2>/dev/null || echo "N/A"

echo -n "inotify watches: "
cat /proc/sys/fs/inotify/max_user_watches 2>/dev/null || echo "N/A"
echo " (recommended: ≥524288)"

echo ""
free -h | awk 'NR==1{print "  " $0} NR==2{print "  " $0}'

echo -n "SSD/NVMe: "
# Handle SIGPIPE from head truncating the pipeline
(lsblk -d -o NAME,ROTA 2>/dev/null | grep "0$" | awk '{print $1 " (SSD)"}' | head -3 \
  || echo "N/A") || true

echo ""
echo "── CI RECENT RUNS ─────────────────────────"
gh run list --limit 5 --json status,conclusion,createdAt,updatedAt,name \
  --jq '.[] | {name:.name, dur_s: ((.updatedAt | fromdateiso8601) - (.createdAt | fromdateiso8601)), ok:.conclusion}' \
  2>/dev/null || echo "gh CLI not authenticated or not available"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Audit complete — feed output to Claude"
echo "  for the scored report and recommendations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ All 11 audit sections completed successfully"
