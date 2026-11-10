# Pilot spec — IPI-1389: Release behavior, not another upgrade

**Live requirements and status:** https://linear.app/amo100/issue/IPI-1389
**Intent:** [intent.md](./intent.md)

## Current code owner

The CopilotKit 1.85 / AG-UI 1.0.2 upgrade from [PR #319](https://github.com/amoai-tech/ipixai/pull/319) is already merged. Verify this against fresh `origin/main` and the package lock before proposing any implementation. The existing `src/app/api/copilotkit/[[...slug]]/route.ts`, Planner and `src/lib/copilotkit/tenant-abort-runner.ts` own the interaction; avoid another transport/runtime.

## Required observable contract

- Org A can authenticate, stream a Planner response, Stop only R1, start R2 and replay its authorized conversation after refresh.
- The displayed plan revision is the artifact reviewed by a human; the server rejects stale/replayed approvals or foreign-organization access.
- Failed/denied requests do not create a Shoot, execute another operator's action, or claim a successful publication.
- Exact hosted SHA, two-instance Stop and membership-revocation behavior require independent proof.

## Release boundary and errors

A signed-out public homepage test is **not** authenticated Planner certification. A merged GitHub commit is **not** a production deployment. Follow the protected release gates and paid-QA approval in [IPI-1091](https://linear.app/amo100/issue/IPI-1091) and integrated E2E gate in [IPI-1151](https://linear.app/amo100/issue/IPI-1151); do not run live writes or paid model calls without required approval.

All acceptance criteria and progress remain in the [issue](https://linear.app/amo100/issue/IPI-1389).
