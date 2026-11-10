# Pilot plan — IPI-1389: Resume from the unproven release gate

**Canonical handoff:** https://linear.app/amo100/issue/IPI-1389
**Intent:** [intent.md](./intent.md) · **Spec:** [spec.md](./spec.md)
**Already merged:** [PR #319](https://github.com/amoai-tech/ipixai/pull/319). **Do not open another upgrade PR.**

## Step 1 — Re-establish code and deployment truth

- **Destination:** No code change by default; inspect `package.json`, `package-lock.json`, `src/app/api/copilotkit/[[...slug]]/route.ts` and relevant hosted SHA.
- **Reference — REFERENCE ONLY:** https://code.claude.com/docs/en/memory → project instructions and resumption guidance; use verified current sources, not an old session claim.
- **Do not copy:** old version pins, historical PR-head logs, or the MDE project runtime.
- **Verify:** `git fetch origin main`, record current main SHA, linked PR and exact hosted production SHA.
- **Checkpoint:** PASS when source and deployment facts are recorded in live Linear; **STOP if** an earlier snapshot or approval is stale.

## Step 2 — Follow existing protected certification gates

- **Destination:** Reuse `docs/production-release.md`, existing CI and browser tests — **do not create a new release mechanism**.
- **Reference — ADAPT existing iPix:** `AGENTS.md` → human merge/release; `tests/` / `e2e/` existing Planner tests; live Linear IPI-1091 and IPI-1151.
- **Use:** get explicit authorization for paid QA and persistent test writes; stage exact SHA using approved protected release process; verify authenticated Org A and Org B journeys, Stop, refresh, exact plan approval and negative cases.
- **Do not copy:** demo auth, unscoped database tests, manual production promotion, blanket "green CI means live".
- **Verify:** browser/session evidence, tenant denial, deployed SHA and production logs; record each checkpoint in IPI-1389 / release-owner issues.
- **Checkpoint:** PASS only with exact-release evidence and authorized human review; **STOP** if deployment approval, security proof or required dependencies are incomplete.

## Resume without duplication

On every new agent session, re-fetch **IPI-1389**, IPI-1091 and related current GitHub PR/CI; select the next unproven gate. These documents are a pilot of the optional handoff workflow, **not** a new progress tracker. No upgrade, database write, production deploy, or paid call is authorized by this plan.
