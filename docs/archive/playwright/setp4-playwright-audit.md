# Playwright E2E Audit — PR #53

**Date:** 2026-09-04 · **Branch:** `e2e/playwright-setup` · **Head:** current working tree (post `c24b97a` + auth-dependency refactor)
**Verified against:** [playwright.dev/docs/auth](https://playwright.dev/docs/auth), [test-projects](https://playwright.dev/docs/test-projects), [ci-intro](https://playwright.dev/docs/ci-intro), [best-practices](https://playwright.dev/docs/best-practices), [writing-tests](https://playwright.dev/docs/writing-tests), [microsoft/playwright](https://github.com/microsoft/playwright) (via Context7, live docs, current as of query), and this project's own Supabase RLS via MCP `get_advisors`.

## Verdict

**Harness design: production-grade.** **Pipeline: not yet runnable end-to-end** — two external blockers, zero code defects.

| Dimension | Grade | Score |
|---|---|---|
| Auth architecture (setup project, storageState, multi-role) | **A** | 100% |
| `playwright.config.ts` / project dependencies | **A-** | 95% |
| Locators & assertions (best-practices.md compliance) | **A** | 100% |
| Secret handling | **A** | 100% |
| CI workflow structure | **A-** | 92% |
| Lint / type safety enforcement | **D** | 60% |
| Tests actually executing today | **F** | 30% (17/21 legitimately `.fixme`, external blocker) |
| CI operational readiness (secrets provisioned) | **F** | 15% |
| **Weighted overall** | **B-** | **~79%** |

The low overall score is almost entirely two external gates (PR #52 unmerged, CI secrets unprovisioned), not code quality. See [Blockers](#blockers) — neither is fixable from this repo alone.

---

## 1. Auth architecture vs. official docs

| Official pattern ([auth.md](https://playwright.dev/docs/auth)) | This repo | Match |
|---|---|---|
| `playwright/.auth/` dir, gitignored | [.gitignore:17](../../../.gitignore) `/playwright/.auth/` | ✅ |
| Setup project: `{ name: 'setup', testMatch: /.*\.setup\.ts/ }` | [auth.setup.ts](../../../e2e/auth.setup.ts) + `playwright.config.ts` `setup` project | ✅ |
| Dependent projects: `dependencies: ['setup']`, `use.storageState` | `chromium` / `mobile-chromium`, `dependencies: ["setup"]` | ✅ |
| Wait for final authenticated state before saving storageState (not just navigation) | [login.ts:22](../../../e2e/support/login.ts) `expect(page).toHaveURL(url => url.pathname === "/")` | ✅ — web-first assertion, stronger than the doc's own `waitForURL` example |
| **Multiple signed-in roles**: authenticate each role once, reuse via `storageState` file | Org A only (shared account, correct fit — normal tests don't modify server state) | ✅ |
| **Testing multiple roles together**: `browser.newContext({ storageState })` per role in one test | [tenant-isolation.spec.ts:37-54](../../../e2e/tenant-isolation.spec.ts) `signInOrgB()` | ✅ — Org B authenticates fresh into its own context, not a project dependency, because it's needed by exactly one test |
| **Avoid authentication in some tests**: `test.use({ storageState: { cookies: [], origins: [] } })` | [unauthenticated.spec.ts:5](../../../e2e/unauthenticated.spec.ts), [login-journey.spec.ts:12](../../../e2e/login-journey.spec.ts) | ✅ exact match |

**Real bug found + fixed during this audit's verification pass, not documented anywhere in Playwright's own docs:** `browser.newContext()` called manually inside a test inherits the *project's* `use.storageState` for any option not explicitly overridden. Under `chromium`, that default is Org A's saved session — so a naive `signInOrgB()` that didn't pass `storageState` would silently start Org B's "fresh" context **already authenticated as Org A**, `/login` would redirect away, and Org B would never actually sign in. Confirmed empirically with a throwaway probe test (real login, printed distinct `org_id`s), then fixed by passing `storageState: { cookies: [], origins: [] }` explicitly — see [tenant-isolation.spec.ts:45-50](../../../e2e/tenant-isolation.spec.ts). This is the single highest-value finding in this audit: it's the kind of bug that passes `tsc`, passes review-by-reading, and only surfaces at runtime.

**Prior review history on this exact question:** an earlier PR review round claimed manual `browser.newContext()` loses the project's `baseURL`. That claim was tested and disproven (baseURL *is* injected via Playwright's `runBeforeCreateBrowserContext`) — see PR #53 comment thread. This audit's finding is different and orthogonal: `baseURL` propagates correctly; `storageState` propagates too, and that's the part that bites you if you don't override it for a "logged out" role.

---

## 2. Project dependency graph vs. `test-projects.md`

Official minimal pattern (from Context7-verified current docs):
```ts
projects: [
  { name: 'setup', testMatch: '**/*.setup.ts' },
  { name: 'chromium', use: {...}, dependencies: ['setup'] },
]
```
This repo's [playwright.config.ts:54-77](../../../playwright.config.ts) matches exactly, plus a second dependent project (`mobile-chromium`) for a ~390px viewport. Confirmed semantics from official docs: *"dependent projects will only run after all tests in the dependency project have passed... If any dependency fails, the projects that rely on it will not be executed."* That means:
- `setup` (Org A) failing correctly fails the whole authenticated suite — intentional, fail-closed.
- Org B is **not** a project dependency, so a missing/broken Org B credential can never cascade into unrelated authenticated tests (dashboard, responsive, login-journey). This was a real, previously-reported bug (`kilo-code-bot` review comment on this PR) and is now structurally impossible rather than papered over with a `setup.skip()`.

No teardown project — correctly omitted; nothing here needs server-side cleanup (all tenant-isolation queries are read-only `SELECT`s).

---

## 3. Best-practices.md compliance

| Rule | Status | Evidence |
|---|---|---|
| User-facing locators only (no CSS/XPath) | ✅ | `getByRole`, `getByLabel`, `getByTestId`, `getByText` throughout — zero `page.locator('.class')` found |
| Web-first assertions (`await expect(...).toBeVisible()` etc.) | ✅ | Zero instances of `expect(await x.isVisible())` anti-pattern found |
| Test isolation (own context/storage per test) | ✅ | Every test either inherits project storageState or explicitly resets it |
| Don't test third-party dependencies | ✅ | N/A — no external-site assertions |
| `tsc --noEmit` in CI | ✅ | [ci.yml:34](../../../.github/workflows/ci.yml) `build` job runs `npm run typecheck` |
| `@typescript-eslint/no-floating-promises` lint rule | ❌ | **No ESLint config exists anywhere in this repo** (checked: no `.eslintrc*`, `eslint.config.*`, no `lint` script in `package.json`). This is repo-wide, not Playwright-specific, but it's the exact gap the official docs call out as the main defense against a silently-swallowed `await` in async test/page code. |
| Trace on first retry, screenshot on failure | ✅ | [playwright.config.ts:46-47](../../../playwright.config.ts) — matches official CI-recommended config exactly |
| Only install browsers you use | ✅ | [ci.yml:66](../../../.github/workflows/ci.yml) `playwright install --with-deps chromium` only |

---

## 4. CI workflow vs. `ci-intro` / release-notes (Context7-verified)

| Official recommendation | This repo | Gap |
|---|---|---|
| `reporter: process.env.CI ? 'github' : 'list'` (annotations on the Actions run) | Static `reporter: "html"` for both | 🟡 Minor — `html` still works and is uploaded as an artifact, but CI gets no inline failure annotations. Low effort, real UX win. |
| `workers: process.env.CI ? 2 : undefined}` (official example) | `workers: process.env.CI ? 1 : undefined` | 🟡 Deliberate, not a bug — single shared Org A test account + real hosted sign-ins; parallel workers would race two logins against one session. Defensible, but worth a comment in the config explaining why it deviates (currently undocumented). |
| `npx playwright install --with-deps` then `npx playwright test` | Matches, browser-scoped to `chromium` only | ✅ better than the generic official example |
| Upload `playwright-report/` as artifact, `if: ${{ !cancelled() }}` | Matches, plus also uploads `test-results/`, `retention-days: 7`, `if-no-files-found: ignore` | ✅ exceeds official example |
| `retries: 1` + `trace: on-first-retry` | `retries: process.env.CI ? 2 : 0` + `trace: on-first-retry` | ✅ compatible, slightly more generous retry budget |

None of these are blockers. The reporter change is the one worth doing.

---

## 5. Supabase / RLS spot-check (via `get_advisors`, project `nvdlhrodvevgwdsneplk`)

Security advisor scan returned **zero findings against `org_members`** — the table `tenant-isolation.spec.ts` depends on for its RLS-denial proof has no flagged gaps. All current findings are pre-existing and unrelated to this PR (chatbot tables with RLS-enabled-no-policy, `SECURITY DEFINER` RPCs callable by `authenticated`, extensions in `public` schema, leaked-password-protection disabled) — out of scope here, not re-listed as Playwright findings.

---

## 6. Errors, red flags, blockers

| # | Severity | Finding | Fix | Status |
|---|---|---|---|---|
| 1 | 🔴 Blocker (external) | 0/6 required CI secrets provisioned (`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `*_ORG_B` ×2, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) — `playwright-e2e` CI job fails every run with a clear "credentials missing" error (verified against latest run `33778116894`) | Repo admin adds the 6 secrets in GitHub Settings → Secrets → Actions | Not fixable from this session; documented in [ci.yml:37-44](../../../.github/workflows/ci.yml) |
| 2 | 🔴 Blocker (external) | [PR #52](https://github.com/amoai-tech/ipixai/pull/52) (IPI-1066, Command Center) unmerged → `/app` has no "Dashboard" heading yet → 17/21 tests are `test.fixme`, correctly, not weakened | Merge #52, then strip `.fixme` from `dashboard.spec.ts`, `responsive.spec.ts`, `login-journey.spec.ts`, `tenant-isolation.spec.ts` | Tracked, `.fixme` comments point at the exact PR |
| 3 | 🟢 Fixed this session | `signInOrgB()` context inherited Org A's storageState by default — Org B never actually authenticated | `storageState: { cookies: [], origins: [] }` passed explicitly; re-verified with real credentials, distinct `org_id`s returned | ✅ Fixed, verified |
| 4 | 🟡 Minor | No ESLint anywhere in repo — official `no-floating-promises` rule unenforced | Add ESLint (or at minimum a Playwright-scoped rule) — repo-wide effort, not Playwright-specific | Open, low urgency (tsc catches most await-shaped bugs already) |
| 5 | 🟢 Fixed this session | CI reporter was static `html`, no inline Actions annotations | `reporter: process.env.CI ? [["github"], ["html"]] : "html"` — annotations in CI, `playwright-report/` artifact still produced for the existing upload step | ✅ Fixed, `tsc` + `--list` re-verified |
| 6 | 🟢 Fixed this session | `workers: 1` on CI vs. official example's `2`, undocumented | One-line comment added explaining the deliberate deviation (shared real Org A account) | ✅ Fixed |

No credentials found in tracked diff (scanned). `.env.test` confirmed gitignored. `.gitignore` matches the official `/playwright/.auth/`, `/playwright-report/`, `/blob-report/`, `/test-results/` pattern exactly.

---

## 7. Fresh verification (this session)

- `npx tsc --noEmit` → clean
- `npx playwright test e2e/auth.setup.ts` → 1 passed (real Org A UI login)
- `npx playwright test e2e/tenant-isolation.spec.ts --project=chromium` → setup 1 passed, isolation test correctly `1 skipped` (`.fixme`, blocked on #52)
- Throwaway probe (real Org A + Org B logins, separate contexts) → distinct `org_id`s confirmed, proving the auth mechanism itself works end-to-end independent of the blocked dashboard UI
- `npm run e2e` → 4 passed / 17 skipped (all skips pre-existing `.fixme`, unchanged by this session's refactor)
- `npm test` → 230 passed / 3 skipped
- `npm run build` → green
- PR #53 review threads → 0 unresolved (checked via GraphQL)
- Supabase security advisors → 0 findings against `org_members`

---

## 8. Production-ready checklist

- [x] Project-dependency auth setup (`setup` → `chromium`/`mobile-chromium`)
- [x] `storageState` reused across authenticated tests
- [x] Multiple-roles pattern for Org B, scoped to the one test that needs it (not a global dependency)
- [x] Explicit logged-out `storageState` override where required (bug found + fixed)
- [x] Real UI login, waits for authenticated end-state before persisting storage
- [x] User-facing locators + web-first assertions throughout
- [x] Secrets gitignored locally, sourced from CI secrets remotely, fail-closed on missing
- [x] `E2E_BASE_URL` allowlisted to localhost + this project's own Vercel previews
- [x] Typecheck / unit tests / build green locally
- [x] Trace-on-retry + screenshot-on-failure configured
- [x] Browser install scoped to chromium only (fast CI)
- [x] CI-aware reporter (`github` + `html` in CI)
- [ ] ESLint / `no-floating-promises` — repo-wide gap, not yet done
- [ ] Merge PR #52 (IPI-1066) — external dependency
- [ ] Provision 6 GitHub Actions secrets — external, repo-admin action
- [ ] Remove `.fixme` from the 4 blocked spec files once #52 lands
- [ ] One green `playwright-e2e` CI run on the final PR SHA before merge

## 9. Will this succeed?

**Yes, conditionally.** The harness itself needs no further redesign — it is a textbook implementation of the official Playwright auth + project-dependency + multiple-roles patterns, and this audit caught and fixed the one real latent bug (Org B storageState inheritance) that static analysis and code review alone would not have caught. What remains is entirely outside this repo's test code: merging #52 and provisioning CI secrets. Once both land, flip `.fixme` → real, and the existing assertions (already correct, already reviewed, already RLS-verified) will pass as-is.
