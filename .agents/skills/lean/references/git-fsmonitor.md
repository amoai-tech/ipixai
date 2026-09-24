# Git Performance Config

## Enable for large repos (>1000 files)

```bash
# Untracked cache — remembers which directories haven't changed
git config --global core.untrackedCache true

# fsmonitor — uses OS file system events instead of scanning
git config --global core.fsmonitor true

# Feature flag that enables several large-repo optimisations at once
git config --global feature.manyFiles true
```

Verify:
```bash
time git status   # should be <200ms after warmup
```

## Pre-push hook template

```bash
#!/bin/bash
set -e
cd /path/to/app
echo "▶ typecheck..."
npm run typecheck
echo "▶ tests..."
npm test
echo "✓ gate passed"
```

Make executable:
```bash
chmod +x .git/hooks/pre-push
```

## Pre-commit hook (optional — for lint-on-changed-files only)

```bash
#!/bin/bash
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep '\.tsx\?$')
if [ -n "$STAGED" ]; then
  echo "$STAGED" | xargs npx eslint --fix
  echo "$STAGED" | xargs git add
fi
```

## Clean up stale branches

```bash
# See merged branches
git branch --merged main | grep -v '^\*\|main\|master\|develop'

# Delete them all
git branch --merged main | grep -v '^\*\|main\|master\|develop' | xargs git branch -d

# Prune remote tracking refs
git remote prune origin

# Compact the repository
git gc --aggressive --prune=now
```

## Remove stale worktrees

```bash
git worktree list          # see all
git worktree prune         # remove stale (no longer on disk)
git worktree remove <path> # remove specific
```
