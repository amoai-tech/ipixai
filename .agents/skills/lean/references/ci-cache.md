# GitHub Actions — Caching Patterns

## node_modules cache (saves 2-4min per run)

```yaml
- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: |
      app/node_modules
      ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('app/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

## Next.js build cache (saves 1-3min on incremental builds)

```yaml
- name: Cache Next.js build
  uses: actions/cache@v4
  with:
    path: app/.next/cache
    key: ${{ runner.os }}-nextjs-${{ hashFiles('app/package-lock.json') }}-${{ hashFiles('app/src/**') }}
    restore-keys: |
      ${{ runner.os }}-nextjs-${{ hashFiles('app/package-lock.json') }}-
```

## Parallelising jobs

Instead of:
```yaml
jobs:
  ci:
    steps:
      - lint
      - typecheck
      - test
      - build
```

Do:
```yaml
jobs:
  lint:
    steps: [lint]
  typecheck:
    steps: [typecheck]
  test:
    steps: [test]
  build:
    needs: [lint, typecheck, test]
    steps: [build]
```

This runs lint + typecheck + test in parallel. Build only runs if all pass.
Wall-clock time = slowest of the three parallel jobs, not their sum.

## Skip build on doc-only changes

```yaml
jobs:
  app-build:
    if: |
      !contains(github.event.head_commit.message, '[skip ci]') &&
      github.event.pull_request.changed_files > 0
    steps:
      - uses: actions/checkout@v4
      - name: Check if app files changed
        id: changes
        run: |
          git diff --name-only HEAD^ HEAD | grep '^app/' && echo "changed=true" >> $GITHUB_OUTPUT || echo "changed=false" >> $GITHUB_OUTPUT
```

## Recommended full workflow structure

```yaml
name: CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v4
        with:
          path: app/node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('app/package-lock.json') }}
      - run: cd app && npm ci --prefer-offline
      - run: cd app && npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v4
        with:
          path: app/node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('app/package-lock.json') }}
      - run: cd app && npm ci --prefer-offline
      - run: cd app && npm run typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v4
        with:
          path: app/node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('app/package-lock.json') }}
      - run: cd app && npm ci --prefer-offline
      - run: cd app && npm test

  build:
    needs: [lint, typecheck, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v4
        with:
          path: |
            app/node_modules
            app/.next/cache
          key: ${{ runner.os }}-build-${{ hashFiles('app/package-lock.json') }}
      - run: cd app && npm ci --prefer-offline
      - run: cd app && npm run build
```
