---
name: nextjs-review
description: Review iPix Next.js App Router changes for server/client boundary, auth, caching, routing, runtime, and deployment regressions.
metadata:
  owner: IPI-1246
---

# iPix Next.js PR Review

Verify against the installed Next.js version before API claims.

Material invariants:
- Keep secrets/service-role credentials server-only.
- Preserve the existing App Router auth/session boundary; client state is not authorization.
- Route handlers/server actions must validate caller and tenant before protected reads/writes.
- Do not introduce accidental static caching of user/tenant-specific data.
- Middleware/proxy changes must preserve Supabase session refresh and protected-route behavior.
- Runtime or deployment changes must remain compatible with current Vercel/OpenNext ownership documented in repo code.
- UI-only changes need browser proof only when the user-visible journey is materially changed.

Prefer targeted route/component tests plus `npm run typecheck`; require production build only when runtime/build behavior is in scope.
