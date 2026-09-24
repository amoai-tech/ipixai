# Recommended .claudeignore patterns

## Critical (always exclude — huge token waste)
```
node_modules/
.git/
dist/
build/
out/
.next/
.nuxt/
.turbo/
.cache/
coverage/
```

## Generated files (exclude — Claude can't usefully edit these)
```
*.generated.ts
*.generated.js
*.d.ts.map
*.js.map
package-lock.json
yarn.lock
pnpm-lock.yaml
bun.lockb
```

## Logs and temp
```
*.log
*.log.*
logs/
tmp/
temp/
.tmp/
```

## Build artifacts
```
*.tsbuildinfo
.tsbuildinfo
storybook-static/
.storybook/
```

## Test output
```
test-results/
playwright-report/
cypress/videos/
cypress/screenshots/
```

## AI/tool caches (scope to what's useful)
```
graphify-out/
.mastra/
.cursor/cache/
```

## Documentation (often large, rarely needed in context)
```
# Uncomment if docs are large and separate from code:
# docs/
# Only exclude if docs are not the active work
```

## Common large reference dirs
```
supabase/old/
archive/
.obsidian/
```

## Recommended final .claudeignore for a Next.js + Supabase + Mastra project
```
node_modules/
.git/
dist/
.next/
.turbo/
coverage/
test-results/
playwright-report/
*.log
package-lock.json
yarn.lock
pnpm-lock.yaml
graphify-out/
.mastra/
supabase/old/
docs/linear/
docs/archive/
```
