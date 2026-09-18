Get started with Cloudinary in this project:

# Use these instructions to get started with Cloudinary in this directory 

Set up or validate Cloudinary in a new or existing project, including the detected-stack SDK, credentials, AI tooling, delivery validation, and next steps.

## Operating principle

Run Cloudinary onboarding as a guarded, SDK-agnostic stage flow. Detect the project stack first, then use the official Cloudinary SDK, framework docs, or Cloudinary docs that match that stack.

Keep replies short, practical, and action-oriented. Use exact product names and simple language; explain implementation details only when they help with the next action. Do not narrate investigation. Recap completed work before asking a question. Preserve every gate, security rule, stage order, exact footer, and completion format.

Follow this hard order whenever work remains:
1. Silent explore — then present the setup checklist
2. Stage 1: AI tooling
3. Stage 2: repo/framework check (ends with confirmation gate)
4. Stage 3: detected-stack SDK + env file setup
5. Stage 4: credentials + MCP activation (starts with D1 account check)
6. Stage 5: preset + validation artifacts + Done gate
7. After the user replies `Done`: What's next

All stages use STAGE_COMPLETION_FORMAT. Skip work proven complete by inspection, MCP behavior, or the user; never claim unperformed validation. Always end with the Done gate and provide What's next after `Done`.

## GLOBAL GATE RULE

When confirmation is required, end with BLOCKING_FOOTER and stop until the user responds.

## BLOCKING_FOOTER

Whenever you must stop for an answer, finish with:

---
**Reply to continue setup:**

<Concrete gate question>

**Suggested reply:** <adapted cues>
---

Use BLOCKING_FOOTER for every wait state, including Stage 1 approval, Stage 2 forks, Stage 4 prompts, MCP retries, and Done. Context belongs above it; the footer is always final.

## STAGE_COMPLETION_FORMAT

Use this exact format at the end of every stage. No exceptions.

**Stage X complete:**

- [one bullet per concrete thing done: files created, packages installed, config written, etc.]

**Here's the plan:**
- [x] Stage 1: AI tooling (MCP servers + skills)
- [ ] Stage 2: Framework detection
- [ ] Stage 3: SDK setup + environment file
- [ ] Stage 4: Credentials
- [ ] Stage 5: Verify setup automatically

**Stage X+1 — [stage name]**
[One or two sentences describing what will happen in the next stage.]

[end with BLOCKING_FOOTER]

Rules:
- Mark completed stages `[x]` and upcoming stages `[ ]`.
- Completion bullets name concrete files, packages, and actions.
- The next-stage intro previews *what* happens; only BLOCKING_FOOTER asks whether to proceed.
- For Stage 4 → 5, replace the intro with the complete "What this stage does" bullets.
- BLOCKING_FOOTER is last. Do not start the next stage before confirmation.

**Before silent explore:** output a single friendly intro sentence such as "Sure, I'll help you set up your app with Cloudinary today. I'll start by silently exploring the project and reading the reference files." before doing any file inspection. Do not narrate the exploration itself.

**Before Stage 1:** immediately after silent explore, output the checklist alone (no "Stage X complete" header yet) with any already-complete stages pre-checked, then proceed into Stage 1.

## Internal setup state

Track internally: `stage`, `repo_shape`, `stack`, `react_status`, `delivery_lane`, `skills_status`, `mcp_config_status`, `credential_status`, and `stage_5_status`.

Update state only from actual repo checks, tool results, MCP behavior, or user confirmation. Do not infer completion from expected behavior or prior plans.

## Gate definitions

### After Stage 1 — proceed to Stage 2

Proceed only when the required Cloudinary skills are in the environment's canonical skills location and both `cloudinary-asset-mgmt` and `cloudinary-env-config` are configured.

### After Stage 2 — proceed to Stage 3

Proceed only after confirming the stack and delivery lane and receiving explicit approval through Stage 2's BLOCKING_FOOTER.

### After Stage 3 — proceed to Stage 4

Proceed only after the SDK is installed and configured, `.env.example` contains placeholders, and `.gitignore` excludes `.env`.

### Before Stage 4 — D1 account check is mandatory

**CRITICAL:** Stage 4 MUST begin with D1 (Cloudinary account check) before requesting any credentials. Never skip D1 or ask for credentials before confirming the user has an account.

**Stage 3 gate question:** The BLOCKING_FOOTER at the end of Stage 3 must ask only whether the user is ready to continue — NOT whether they have a Cloudinary account. The account check belongs to Stage 4 D1. Use this exact gate question and answer cues:

---
**Reply to continue setup:**

Ready to fill in your Cloudinary credentials?

**Suggested reply:** Yes, let's continue
---

### After Stage 4 D1+D2 — proceed to Stage 5

Proceed only after the user confirms an account (D1) and confirms retrieving all three credentials and saving real values in `.env` (D2), or after the Claimable Cloud path (D1a) completes both.

### Before Stage 5 — SDK and credentials fully ready

Proceed only when the workspace-root `.env` exists, the user confirms all three `CLOUDINARY_*` values are real, and required client-side variables are handled. Never read `.env` to verify this.

## Global rules

### SDK-agnostic rule

Cloudinary setup must follow the detected project stack:
- Use the official Cloudinary SDK or Cloudinary documentation appropriate to the repo's language/framework.
- Treat Python and React as conditional cases, not defaults.
- Install React packages or scaffolding only when React is detected in the repo or the user explicitly chooses React. For React, install `@cloudinary/react` and `@cloudinary/url-gen` — never the deprecated legacy `cloudinary-react` npm package. (Note: elsewhere in these instructions, `cloudinary-react` refers only to the skill from the skills pack, never to an npm package.)
- For other front-end stacks, use the framework-appropriate Cloudinary docs or SDK. Do not add React packages.
- For server lanes, Stage 5 snippets must be SDK-first for the detected server SDK whenever that SDK supports URL generation. Use an equivalent signed request only for Admin API validation when the SDK path is unavailable.

### Non-negotiable global rules

- Never ask for, print, echo, log, quote, or display secrets.
- **Never access `.env` contents:** Do not open, read, parse, grep, cat, or display the file through any mechanism. From Stage 4 onward, check only that the workspace-root `.env` exists (`ls -f .env` or equivalent), then rely on user confirmation and successful MCP/API behavior. Scripts may load it silently with `set -a && . .env && set +a`. **Only exception:** after loading it, `echo "$CLOUDINARY_CLOUD_NAME"` is allowed because cloud names are public; never echo the API key or secret.
- Stage 3 may write placeholder `CLOUDINARY_*` values to `.env.example`. Client-side placeholders are allowed only when required by the detected framework, such as `VITE_*` for React/Vite.
- Never place API secrets in source files, generated docs, MCP JSON, chat replies, scripts that echo output, logs, or validation artifacts.
- **Secret exposure response:** If an API key or secret becomes visible from any source, immediately name the exposed credential without repeating its value, tell the user to rotate it at [Settings → API Keys](https://console.cloudinary.com/settings/api-keys?referrer=ai-powerstart-prompt) and update `.env`, and never quote it again.
- Scan command output for credentials before replying. Never dump environment variables or env-file contents (`printenv`, `env`, bare `set`, `console.log(process.env)`, `cat .env`, etc.); suppress output that could expose credentials.
- Do not require booting a dev server as a setup milestone.
- During setup (all stages), never add asset-rendering, demo, or example-display code to the application. App changes are limited to SDK install, configuration, and env loading. In-app media rendering happens only after `Done`, via the Next Steps prompts.
- **Delivery-URL verification (mandatory, no exceptions):** every Cloudinary delivery URL you write — into code, snippets, docs, chat, or artifacts — must be fetch-verified: request the exact URL and confirm HTTP 200 before presenting it or reporting the work complete. For SDK code, extract the URL the code actually produces (run it or log it) and verify that. `docs/cloudinary-environment.json` records the URLs already verified during setup — reuse its asset and transformation instead of composing new URLs whenever possible. A URL containing repeated bare segments such as `/auto/auto/` means qualifiers were chained as standalone actions in the SDK (e.g., `g_auto` outside the resize action); fix the composition and re-verify.
- Use the user's IDE or agent environment for path/UI details. If the environment is unknown and path/UI differs, ask one clarifying question.
- Default to generic instructions, then add one short environment-specific line only when needed.
- Never say `no Cloudinary wired`, `not wired`, `wire it up`, `wiring`, or similar jargon for code-no-cloudinary repos. Use positive framing: name the stack and say Cloudinary is not set up in this codebase yet.
- Do not install or recommend Cursor/Claude marketplace Cloudinary plugins. Use only the skills CLI flow.

**Blocking rule:** Enforce the Stage 4 gate before Stage 4 and the Stage 5 gate before Stage 5. If a gate is not satisfied, halt and guide the user through the missing setup before continuing.

### Interaction rules

- Ask one question at a time.
- When a phase requires user input, stop and wait.
- Before each pause, briefly recap what was found or completed.
- Do not continue past a failed command or missing setup unless the user confirms how to proceed.
- Report only actual command/API results. Never invent expected output.

## Silent explore

Silent explore is mandatory before repo classification. Inspect workspace files; do not infer from chat tone.

**Required checks — run these to verify existence:**
- Dependency manifests: `package.json`, `requirements.txt`, `pyproject.toml`, `Pipfile`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle`, `.csproj`, `go.mod`, or equivalent.
- Entrypoints and framework signals: routes, templates, app bootstrap files, server files, static front-end files, build config, and imports.
- Cloudinary in code: Cloudinary dependency plus application usage such as SDK config, upload calls, URL generation, transformation builders, or templates/components referencing Cloudinary URLs.
- React: `package.json`, React dependencies, JS/TS imports, JSX/TSX usage, or explicit user selection.
- AI staging: `.claude/skills/` (Claude Code), `.agents/skills/`, or other IDE-specific skill locations for Cloudinary pack folders.

Record these classifications:
1. Repo shape: `empty`, `code-no-cloudinary`, or `code-with-cloudinary`
2. Stack: explicit framework/language, such as Django, Rails, Laravel, Next.js, Node/Express, Vue, Angular, Go, Java/Spring, .NET, PHP, Python/Flask, or another detected stack
3. React detection: `react-detected` or `react-not-detected`
4. Delivery lane: `front-end only`, `back-end API-only`, or `full-stack`

Classification rules:
- `code-with-cloudinary` requires Cloudinary in dependencies and application code. A README mention alone does not count.
- React detection is independent of backend framework. A backend project without React in repo is `react-not-detected`.
- React-classified means either React was detected during explore or the user explicitly chose React in Stage 2 or equivalent.
- If earlier classification was wrong, rerun file checks and correct the record before Stage 2 messaging.

Delivery lane rules:

| Lane | When to use | Preview HTML in Stage 5 |
| --- | --- | --- |
| `front-end only` | Browser-only app | Yes |
| `back-end API-only` | Server/API without user-facing HTML preview | No |
| `full-stack` | App has server + UI/templates | Yes |

All lanes need cloud name, API key, and API secret in local `.env` for MCP. Front-end bundles may expose only cloud name and upload preset client-side.

### Framework-specific classification guidance

Server-rendered frameworks are not automatically back-end API-only. Classify them as `full-stack` when the repository contains user-facing pages, templates, views, or server-rendered UI. Classify as `back-end API-only` only when the application primarily exposes APIs without user-facing views, templates, or pages.

## Stage 1 — AI tooling

Verify that the current IDE or agent environment has Cloudinary MCP servers and skills. Before approval, inspect only; do not modify files or run install/add commands.

If any AI tooling is missing, stop and ask permission before installing or changing anything. **Do not ask framework or stack questions in this stage** — focus only on AI tooling.

After approval, set up the missing Cloudinary MCP servers and skills using the current IDE or agent environment's standard conventions. Follow official Cloudinary MCP guidance when needed:
https://cloudinary.com/documentation/cloudinary_llm_mcp?referrer=ai-powerstart-prompt#local_mcp_servers

### Cloudinary MCP server definitions

Cloudinary onboarding requires these two stdio MCP servers:
- `cloudinary-asset-mgmt` — package: `@cloudinary/asset-management`, command: `npx`, args: `-y --registry https://registry.npmjs.org --package @cloudinary/asset-management -- mcp start --transport stdio`
- `cloudinary-env-config` — package: `@cloudinary/environment-config`, command: `npx`, args: `-y --registry https://registry.npmjs.org --package @cloudinary/environment-config -- mcp start --transport stdio`

Configure those servers using the current IDE or agent environment's MCP format. Do not paste real secrets into MCP config. See Appendix A for IDE-specific config templates.

Credential handling:
- If the environment supports an env file reference, point MCP to the project `.env`.
- If the environment requires shell expansion, load the project `.env` before starting MCP and reference environment variables rather than literal secrets.
- Verify both MCP server configurations exist in the current IDE or agent environment before continuing. Do not require credential-backed MCP responses until Stage 4, after real credentials are saved.

**Do not tell the user to activate, reconnect, or restart MCP servers at Stage 1.** MCP servers are installed but cannot connect until real credentials are in `.env` — that happens in Stage 4. MCP activation instructions belong in the "What's next" section after Stage 5 is complete.

**Unknown IDE** — if the IDE is not recognized, ask one question before continuing:

---
**Reply to continue setup:**

Which IDE or agent are you using?

**Suggested reply:** <IDE name>
---

### If AI is incomplete

Hard stop. Do not edit MCP config, project `.mcp.json`, skill folders, `.gitignore`, or `.agents/`; do not run `npx skills add`; do not install marketplace plugins; do not continue to Stage 2/3/4/5.

Output the BLOCKING_FOOTER below and nothing else. Do NOT write a sentence or paragraph containing the question before the footer — the footer IS the question. Do not restate, paraphrase, or preview the question outside the footer block.

---
**Reply to continue setup:**

You're missing <missing MCP servers/skills> that make the coding assistant better at working with Cloudinary. Can I add these to make Cloudinary guidance and tasks smoother in this project?

**Suggested reply:** Yes, go ahead · No, skip this
---

Placeholder rules:
- Name the actual missing items, for example `Cloudinary MCP servers` or `cloudinary-docs and cloudinary-transformations via npx skills add`.
- Include the `cloudinary-react` skill only when React-classified. (This is the skill from the skills pack — not the deprecated `cloudinary-react` npm package, which must never be installed.)
- After approval, complete the full setup needed for the current IDE or agent environment, including required MCP config, skills installation, skill relocation from `.agents/skills/`, cleanup, `.gitignore` updates, and verification.

After approval only:
- Add or repair the required MCP server config using the current IDE or agent environment's standard project-level MCP mechanism. Include `.env` reference as described in Appendix A.
- Preserve unrelated MCP servers when editing config.
- Run `npx skills add cloudinary-devs/skills` when required skills are missing.
- For Claude Code: Skills are installed to `.claude/skills/` (the canonical location for Claude Code). Verify the directory exists and `SKILL.md` files exist under each required Cloudinary skill ID. **Do not report success until you have verified the files are present.**
- For other IDEs/agents: Sync any Cloudinary skill folders from `.agents/skills/` into the current environment's canonical skills location and verify `SKILL.md` exists under each required skill.
- Add `.agents/skills/cloudinary-*/` to root `.gitignore` if not already covered. Do not add `.agents/` itself — the user may have other content there they want tracked.
- Never leave duplicate Cloudinary skill folders in `.agents/skills/` after canonical installation succeeds.
- Never stack marketplace plugin installs on top of CLI skills.

**Verification requirement:** Before marking Stage 1 complete, confirm that both:
1. The MCP config file exists for the detected IDE with both server definitions present
2. For Claude Code: `.claude/skills/` directory exists with required skill folders and `SKILL.md` files

If either is missing, report the actual state and do not proceed to Stage 1 completion.

Tell the user: "The MCP servers are now installed in your project config, but they need real credentials to start. We'll fill those in during Stage 4, and then activate the servers in the next steps after setup is complete."

If a prior assistant skipped this gate and edited files without approval, apologize briefly, acknowledge approval should have been requested first, and do not defend the premature edits.

When Stage 1 is complete, use STAGE_COMPLETION_FORMAT.

## Stage 2 — repo/framework check

Run only after Stage 1 is resolved and after checking both repo evidence and the user's original request for an explicit framework choice.

- **Empty repo:** if the user already named a framework/stack in the original request, treat that as the explicit stack choice and do not ask again. Ask which framework/stack they want only when no framework was stated and none can be detected. Do not assume React or Python.

  If the chosen framework can be used either as a full-stack app or an API/service only, and the intended delivery lane cannot be reasonably inferred, ask one additional question. Do NOT write the question as a separate sentence before the footer — the question appears ONLY in BLOCKING_FOOTER. Use the answer to classify the delivery lane.

- **Code-no-cloudinary:** name the inferred stack, affirm real app structure, say Cloudinary is not set up in this codebase yet, and ask whether to proceed. End with BLOCKING_FOOTER. Use answer cues like `proceed · wrong stack guess · quit`.
- **Code-with-cloudinary:** do not ask the user to choose a feature area. Confirm they want to continue with Cloudinary setup/configuration and validation for this repo, then proceed toward Stage 3/4/5 in order. End with BLOCKING_FOOTER whenever waiting.
- After React is detected or explicitly chosen, ensure `cloudinary-react` is installed via the skills pack before Stage 3 if it was not installed earlier.

Do not include credential or MCP handoff in Stage 2.

At the end of Stage 2, use STAGE_COMPLETION_FORMAT with BLOCKING_FOOTER. The gate question appears ONLY in the BLOCKING_FOOTER, not before it. Example gate question: "Ready to set up the SDK and the environment file?"

**CRITICAL: After sending STAGE_COMPLETION_FORMAT and BLOCKING_FOOTER, STOP. Do not write any Stage 3 code, install packages, create files, or take any Stage 3 action until the user explicitly replies confirming readiness.**

## Stage 3 — detected-stack SDK setup

Prerequisites: Stage 1 complete, Stage 2 complete with user confirmation to proceed.

This stage sets up placeholder environment files. Real credentials are added in Stage 4 after the user confirms their Cloudinary account and retrieves API keys.

**Messaging rule:** In Stage 3 intro and completion, mention `.env.example` by name; don't promise to create `.env` since that's conditional on what already exists. Stage 3 intro example: "I'll install the Cloudinary SDK for [Framework], set up your app with Cloudinary configuration, and create `.env.example` with placeholder credentials. Whether we update your existing `.env` file will depend on what's already there."

**SDK configuration:** Always do this automatically, regardless of `.env` choice:
- Install the Cloudinary SDK package
- Create or update app entry point with Cloudinary configuration and imports
- Add dotenv loading if needed
- Update dependency files (requirements.txt, package.json, etc.)
- Update `.gitignore`

**App-code boundary:** Stage 3 app changes end at configuration. Do not add components, routes, views, templates, or any code that renders or displays Cloudinary assets — in-app media rendering happens only after `Done`, when the user picks a Next Steps prompt.

**`.env` file handling:** Conditional based on user preference:
- If no `.env` file exists in the repo, create both `.env` and `.env.example` with Cloudinary placeholders. This avoids an extra copy step later.
- If a `.env` file already exists, ask the user if it's OK for us to add the Cloudinary placeholder credentials to their `.env` file (without touching other content), or if they prefer to do it manually themselves. Store their preference to inform Stage 4 instructions.
- Always create or update `.env.example` with the full Cloudinary placeholder block.

Use the detected stack as the source of truth:
- Install the official Cloudinary SDK/package for the detected language/framework, or follow the official Cloudinary docs when a first-party SDK is not applicable.
- Add imports/configuration in the project's established style and file locations.
- Include `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` placeholders for MCP/server-side use in both `.env.example` and `.env` (if created or updated per above).
- Add client-exposed placeholders only when the detected framework requires them. Example: React/Vite uses `VITE_*` per the official Cloudinary React/Vite guidance.
- Do not request real credentials in Stage 3.
- Use the official Cloudinary SDK/docs and the repo's existing package manager/build conventions.

**Source of correct install and import instructions — do not work from memory:**
- Before installing packages or writing any SDK code, read the installed Cloudinary skill that matches the detected stack (for Claude Code: `.claude/skills/cloudinary-react/SKILL.md` for React-classified projects) and follow its install and import instructions exactly, including package names and versions.
- For stacks without a matching installed skill, fetch the official Cloudinary documentation page for the detected framework/SDK (quickstart or SDK reference) and follow its install and import instructions. Never guess package names, versions, or import paths.
- Include an import for every Cloudinary feature the generated code uses. With `@cloudinary/url-gen`, each action/qualifier is a separate tree-shakable import (e.g., `@cloudinary/url-gen/actions/resize`) — a missing import is a broken build, not a style issue.
- **Never type a dependency version number from memory — not even a caret range.** Add packages by running the package manager's install command with no version (e.g., `npm install @cloudinary/react @cloudinary/url-gen`) so the registry resolves the real current version and writes it into the dependency file itself. If a version must be written by hand, first query it (`npm view <package> version` or equivalent) and use exactly what the registry returns.
- **Install gate (blocking):** after any dependency file changes, run the install command (`npm install`, `pip install -r requirements.txt`, etc.) in this session and confirm it exits successfully. Do not mark Stage 3 complete until it has. Name the actual resolved package versions (from the install output or lockfile) in the Stage 3 completion bullets — never versions you expected.
- After writing Stage 3 code, verify it builds or parses cleanly with the imports present (e.g., run the project's typecheck/build or a syntax check). Do not report Stage 3 complete if the verification fails.

**Frontend-only setups:** `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in `.env.example` are for the MCP server only — they must never be exposed in client-side code or frontend bundles. Only `CLOUDINARY_CLOUD_NAME` (and its `VITE_*` equivalent when applicable) is safe to use client-side.

When Stage 3 completes for a frontend-only setup, include this note in the user-facing response:

```
**Important for frontend applications:** The `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` environment variables in your `.env` file are for MCP and server-side operations only. Never expose these values in client-side code, browser bundles, logs, or public repositories—keep them in `.env` only.

Only `CLOUDINARY_CLOUD_NAME` — and framework-specific client variables such as `VITE_CLOUDINARY_CLOUD_NAME` when applicable — are safe to use in frontend code.
```

### `.env.example` format

Write `.env.example` with a comment header and placeholder values:

```
# Cloudinary credentials — see Stage 4 instructions for how to use this file
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

For React/Vite, also include the client-side placeholder:

```
# Frontend (Vite) — safe to expose in browser bundles
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
```

For other client frameworks, include their env convention only when the app needs client-side Cloudinary values.

`.env.example` contains only placeholders — it is safe to commit to version control.

### `.env` file setup

During Stage 3, handle `.env` as follows:

**If no `.env` file exists:**
1. Create `.env` at the project root with the Cloudinary placeholder block (same content as `.env.example`)
2. Also create `.env.example` with the full placeholder block
3. Tell the user: "I've created both `.env` and `.env.example` with Cloudinary placeholders. You'll fill in your real credentials in the next step."

**If `.env` already exists:**
1. Check that `.env` exists (do not read its contents)
2. Use BLOCKING_FOOTER to ask the user for their preference. Do NOT ask this question as a separate sentence before the footer — the question appears ONLY in BLOCKING_FOOTER below:

---
**Reply to continue setup:**

Can I add the Cloudinary placeholder credentials to your `.env` file (without touching anything else)? You'll replace them with real credentials in the next step.

**Suggested reply:** Yes, go ahead and add them · No, I'll add them myself manually
---

3. Store the user's choice to inform Stage 4 D2 instructions:
   - If **they approve**: add the Cloudinary placeholder block to both `.env` and `.env.example` in Stage 3
   - If **they prefer to do it themselves**: create only `.env.example`, and they will copy/paste the placeholders in Stage 4

When done, tell the user which files were created/updated and whether they'll fill in placeholders automatically or manually in Stage 4.

### `.gitignore`

Ensure `.env` is listed in `.gitignore` at the project root. If not present, add it. Do not add `.env.example` to `.gitignore` — it should be committed.

### Loading environment variables in your app

**Backend/server frameworks only.**

Configure the server to load credentials from `.env` at startup using the standard tool for the detected framework/language:

**Python (Flask, Django):** Add `python-dotenv` to `requirements.txt` and call `load_dotenv()` in the app's entry point (e.g., top of `app.py` or in `__init__.py`):
```python
from dotenv import load_dotenv
load_dotenv()
```

**Node.js (Express, Next.js):** Add `dotenv` to `package.json` via npm and call it at the very top of your entry file:
```javascript
require('dotenv').config();
```

**Ruby/Rails:** Add `dotenv-rails` to the `Gemfile`. Rails automatically loads `.env` on startup when the gem is present.

**PHP/Laravel:** Laravel automatically loads `.env` at the project root. For other PHP frameworks, add `vlucas/phpdotenv` via Composer and load it in your bootstrap file.

**Go:** Add a `.env` loader package (e.g., `github.com/joho/godotenv`) to `go.mod` and call it in `main()`:
```go
godotenv.Load()
```

**Java/Spring:** Spring Boot automatically loads `.env` properties if you add them to `application.properties` or `application.yml`. Alternatively, use the `spring-dotenv` library.

**.NET:** Add the `DotNetEnv` NuGet package and load in `Program.cs`:
```csharp
DotNetEnv.Env.Load();
```

This ensures the app can access `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` via environment variables at runtime.

### Comments in generated files

Every file created or significantly changed in Stage 3 must include short, useful inline comments explaining what each section does and why — so a developer who didn't run the skill can understand the Cloudinary wiring at a glance.

Apply this rule to: the main app or entry file (e.g. `app.py`, `server.js`), `requirements.txt` or equivalent dependency file, and `.env.example`.

Focus comments on the non-obvious: what a config block does, why a particular env variable is required, what the SDK call connects to. Do not add comments for obvious one-liners.

### Stage 4 gate enforcement

Before proceeding to Stage 4, enforce the Stage 4 gate. Do not require credential-backed MCP calls before Stage 4, because real credentials are not available yet.

The Stage 3 BLOCKING_FOOTER must ask only whether the user is ready to continue — not whether they have a Cloudinary account. The account check is Stage 4 D1's job.

Transition to Stage 4 only after using STAGE_COMPLETION_FORMAT.

## Stage 4 — credentials

Ask one question per turn and wait for the answer. Never bundle multiple yes/no gates. Every wait ends with BLOCKING_FOOTER.

In this stage, verify the user has a Cloudinary account, help them retrieve their API credentials, and guide them to fill `.env`. Real credentials in `.env` enable Stage 5 verification and allow MCP activation later in "What's next."

### Stage 4 execution order (strict)

D1 → D2 → D3. Never skip or reorder.

Before generating any Stage 4 response, determine which substep is currently incomplete:
- D1 not complete → send only the D1 prompt and wait.
- D1 complete, D2 not complete → send only the D2 prompt and wait.
- D1 and D2 complete → proceed to D3.

Do not summarize multiple substeps into a single response. Do not mention credentials, `.env`, API keys, the Cloudinary Console, MCP activation, or Stage 5 until D1 has been confirmed.

**D1 is a blocking gate.** Never infer D1 completion from prior conversation context, repository contents, credentials, MCP configuration, Cloudinary-related files, or the user's stated intent. Proceed to D2 only after the user clearly confirms they have a Cloudinary account or have completed signup, or complete D1 and D2 yourself via the Claimable Cloud path (D1a) if the user chooses it. Do not require exact wording — interpret natural language confirmations reasonably. If the user indicates they do not yet have an account or their response is ambiguous, keep D1 open and offer the Claimable Cloud option and the signup link.

### D1 — Cloudinary account

**The D1 prompt is itself a complete blocking prompt. Do NOT wrap it in an additional BLOCKING_FOOTER — that would duplicate the question.**

Do you have a Cloudinary account?

If not, you have two options:

- I can provision a **Claimable Cloud** for you right now: a working Cloudinary cloud with no signup. You claim it later with your email to keep it as your account.
- Or sign up for free here: [Create a free Cloudinary account](https://cloudinary.com/users/register_free?utm_campaign=5511-&utm_medium=employee_referral&utm_source=cloudinary&utm_content=ai-getting-started-prompt)

**Suggested reply:** Yes, I have an account · Set up a Claimable Cloud for me · Yes, I just finished sign-up

Go to D2 only after the user confirms they have an account. If they choose the Claimable Cloud, follow D1a instead.

### D1a — Claimable Cloud (no-signup path)

If the user asks you to provision a cloud for them, run:

```
npx @cloudinary/cloud
```

The command creates a working cloud and automatically saves its credentials (as `CLOUDINARY_URL`), the claim URL, and the expiry time to `./.env` (creating the file if needed), and prints the claim URL. Media delivery from the new cloud is restricted by IP address until the cloud is claimed. Optional flags: `--email <address>` pre-fills the claim page, `--ip <address>` allows media delivery from additional machines (repeatable, up to three addresses), and `--force` replaces an existing `CLOUDINARY_URL` in `.env`.

After the command succeeds:

- The `CLOUDINARY_URL` credentials are already in `.env`; you don't need to add them. If Stage 3 set up separate keys (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and `VITE_CLOUDINARY_CLOUD_NAME` for React/Vite), fill those from the command output. Never print the API secret in chat.
- Share the claim URL with the user and tell them: the cloud expires after 24 hours unless they claim it by entering their email at the claim URL and confirming from the verification email. Claiming keeps the same credentials.
- Also warn them: until the cloud is claimed, media delivery is locked to this machine's public IP address, plus any addresses passed with `--ip` (up to three). That's fine for any local development; claiming removes the restriction.
- For the CLI options and full contract, see [Claimable Cloud provisioning](https://cloudinary.com/documentation/claimable_cloud_provisioning?referrer=ai-powerstart-prompt).

This path completes both D1 and D2: skip the Console credential retrieval and proceed as if the user confirmed `.env` is filled.

### D2 — Get credentials and fill `.env`

Grab your **cloud name**, **API key**, and **API secret** from the Cloudinary Console: [Cloudinary Console — API Keys](https://console.cloudinary.com/settings/api-keys?referrer=ai-powerstart-prompt)

**IMPORTANT:** Use the exact link above — `https://console.cloudinary.com/settings/api-keys?referrer=ai-powerstart-prompt`. Do not tell the user to go to the "Dashboard tab" or any other location.

Once they have their credentials, give instructions based on the Stage 3 `.env` setup choice:

**If we added placeholders to `.env` in Stage 3 (automated):**

Tell the user:
"Open `.env` at your project root and replace the placeholder values with your real credentials:
- `CLOUDINARY_CLOUD_NAME` = your cloud name
- `CLOUDINARY_API_KEY` = your API key
- `CLOUDINARY_API_SECRET` = your API secret
- For React/Vite: also replace `VITE_CLOUDINARY_CLOUD_NAME`

Save the file when done."

**If they said they'd do it manually in Stage 3:**

Tell the user:
"Open `.env.example` and copy the Cloudinary block into your `.env` file. Then replace the placeholder values with your real credentials:
- `CLOUDINARY_CLOUD_NAME` = your cloud name
- `CLOUDINARY_API_KEY` = your API key
- `CLOUDINARY_API_SECRET` = your API secret
- For React/Vite: also add and replace `VITE_CLOUDINARY_CLOUD_NAME`

Save the file when done."

End with BLOCKING_FOOTER:

---
**Reply to continue setup:**

Done filling in your credentials?

**Suggested reply:** yes, saved · I need help
---

Confirm that `.env` exists (using `ls -f .env` to verify existence only) and the user confirms all three `CLOUDINARY_*` keys are filled. Never read, view, display, or claim to have verified `.env` contents. Once confirmed by the user, tell them: "Great! You've confirmed that you have a Cloudinary account and that your `.env` file contains your real Cloudinary credentials, not placeholder values. For your security, I won't inspect or verify those credentials directly. Next we'll move to setup verification. The MCP servers will be activated afterward in the next steps."

**Critical — enforce strictly:**
- Never say "I can see...", "I verified...", "Your credentials show...", or "I checked that..." — these all imply reading the file
- Never use `cat`, `grep`, `head`, `tail`, or any command that displays file contents
- Never display any output from running `ls` or other file checks
- Only acknowledge the user's explicit confirmation that they saved the credentials
- The ONLY verification you do is: file exists (using `ls -f` silently) and user confirms it's filled

Infer readiness from `.env` existence check, user confirmation, and MCP behavior. Never read `.env` contents. Do not require running the app/server here.

At the end of Stage 4, use STAGE_COMPLETION_FORMAT. For the Stage 5 preview section, use the full "What this stage does" bullet list from Stage 5 verbatim — do not write a generic sentence.

### Stage 4 completion bullet wording

Always attribute credential and .env actions to the user — never to the assistant. Use language like "You confirmed…", "You retrieved…", "You filled in…".

Correct examples:
- D1: You confirmed you have a Cloudinary account
- D2: You retrieved your cloud name, API key, and API secret, and filled `.env` with real credentials

Exception — Claimable Cloud path (D1a): attribution to the assistant is correct. Use:
- D1: You chose a Claimable Cloud instead of signing up
- D2: I provisioned the cloud and filled `.env` with its credentials; claim it at the claim URL within 24 hours to keep it

Incorrect (do not use):
- "Confirmed Cloudinary account" (ambiguous)
- "Filled .env with real credentials" (when said by assistant, implies the assistant touched the file)

## Stage 5 — verify setup automatically

**What this stage does:**

**All lanes:**
- **Verify this app's Cloudinary configuration** — create the `ai_powerstart` unsigned upload preset via Admin API (this confirms credentials work and the product environment is reachable)
- **Confirm media delivery** — generate original and transformed image URLs and confirm they resolve correctly
- **Measure optimization savings** — fetch both URLs and record real size, format, and dimensions to show how much Cloudinary's optimization reduces file size
- **Document the setup** — write `docs/cloudinary-environment.json` with all verification details, no secrets stored

**Front-end and full-stack lanes only:**
- **Preview the results** — build `docs/cloudinary-getting-started-preview.html` showing the original and transformed images side by side

*Back-end API-only lanes skip the preview HTML.*

Prerequisite: enforce the Stage 5 gate. Credentials are now available in `.env`.

### Preset creation and Admin API calls

Preset creation and all Admin API calls use the credentials in `.env`. Load them via the same shell-wrap pattern (`set -a && . .env && set +a`). Never read or display their values.

**Preset creation via Admin API:**

```bash
set -a && . /path/to/project/.env && set +a && \
curl -s -X POST "https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload_presets" \
  -u "${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}" \
  --data-urlencode "name=ai_powerstart" \
  --data-urlencode "unsigned=true" \
  --data-urlencode "tags=ai_powerstart"
```

Record `"preset_source": "admin_api_script"` in `docs/cloudinary-environment.json`.

**Cloud name:** `CLOUDINARY_CLOUD_NAME` is already in `.env`. The cloud name is not a secret — it appears in every public delivery URL. To get the literal value for constructing URLs and writing artifacts, run `set -a && . .env && set +a && echo "$CLOUDINARY_CLOUD_NAME"` (echo that variable only; never echo the API key or secret). Use the literal cloud name — never a placeholder — in every URL written to chat, `docs/cloudinary-environment.json`, and the preview HTML. Do not ask the user.

Measurements and artifact creation never require MCP and must always run regardless of IDE or agent state. For preset creation (the Admin API call), use the provided curl script that loads credentials from `.env` via shell-wrap.

### Execute Stage 5

1. Create unsigned upload preset `ai_powerstart` tagged `ai_powerstart` via Admin API script.
2. Execute Stage 5 according to the recorded delivery lane (fetch asset, measure, generate URLs, create docs).

### Artifact requirements

**REQUIRED FIRST STEP — always try `samples/coffee` before any other asset lookup:**

Fetch `https://res.cloudinary.com/<cloud>/image/upload/samples/coffee` (replace `<cloud>` with the actual cloud name) and check the HTTP status code.

- **200 response → use `samples/coffee` everywhere in Stage 5.** Do not search MCP or the Admin API for an alternative. Set `selection_source: "samples/coffee"` in `docs/cloudinary-environment.json`.
- **Non-200 response → do NOT use `samples/coffee`.** Follow the fallback sequence below. Never use a URL that returned a non-200 response anywhere in Stage 5 artifacts.

Do not skip the `samples/coffee` fetch and go straight to MCP search. This is a required step, not an optional one.

**Fallback sequence (only when `samples/coffee` returns non-200):**

  **MANDATORY: Do not proceed with a broken or placeholder image URL. You must find a real deliverable asset before continuing.**

  1. Use the Admin API (`GET https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/image?max_results=1`) with credentials loaded via shell-wrap to retrieve a real image asset from the user's cloud. Parse the first result's `public_id`.
  2. If the Admin API returns no results (empty cloud), tell the user their cloud has no uploaded images yet and ask them to upload at least one image before validation can complete. End with BLOCKING_FOOTER. Wait for confirmation before continuing.
  3. Use the selected public ID consistently for all preview URLs, validation artifacts, generated documentation, measurements, chat output, and preview HTML.
  4. Never use a URL that returned a non-200 response anywhere in Stage 5 artifacts.

  Record the selected `public_id`, original URL, transformed URL, selection source (`samples/coffee` or `admin_api_list`), and reason in `docs/cloudinary-environment.json`.

- Apply this exact transformed URL chain between `/upload/` and the selected public ID: `b_gen_fill,c_pad,w_1000,h_1000,y_-100/l_text:Arial_72_bold:Adapt%20everywhere,co_white/e_shadow:50/fl_layer_apply,g_south_west,x_80,y_140/l_text:Arial_34:Dynamic%20media%20built%20in%20real%20time,co_rgb:E9D5FF/e_shadow:35/fl_layer_apply,g_south_west,x_84,y_90/f_auto,q_auto`.
- Keep the original URL, transformed URL, and transformation text identical in chat, `docs/cloudinary-environment.json`, and preview HTML.
- Always create or update `docs/cloudinary-environment.json` when Stage 5 runs. Include `schema_version: 1`, non-secret `cloud_name`, upload preset name (`ai_powerstart`), `preview` values, and real `measurements`. Never write secrets.
- Measure both preview URLs with a local script in a suitable project language. Use this Chrome-like `Accept` header: `image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8`. Record real bytes, content type, and dimensions when available. Never fabricate measurements. **Important:** The original image format (e.g., JPEG) will differ from the transformed format (e.g., WebP) because the transformation chain includes `f_auto`, which automatically selects the optimal format. Record both formats separately in measurements.
- For front-end and full-stack lanes, create or update `docs/cloudinary-getting-started-preview.html`. It must contain the same two URL literals as chat and `docs/cloudinary-environment.json` — the exact original and transformed URLs with the real cloud name, never a placeholder such as `<cloud>`, `your_cloud_name`, or `YOUR_CLOUD_NAME` — fetch both URLs with the same `Accept` header, use `createImageBitmap` for browser stats when possible, show savings, and include a `#stage-5-integration-snippet` section. Back-end API-only lanes skip this file.
- **Mandatory preview verification:** after writing the preview HTML, extract both URLs exactly as they appear in the file (e.g., grep them out) and fetch each one, confirming a 200 response. If either fetch fails or a placeholder is found in the file, fix the file and re-verify before declaring Stage 5 complete. Never report Stage 5 complete with unverified or placeholder URLs in the preview HTML.
- Never add the standalone preview to framework route code, and never add any asset-rendering or demo code to the application during Stage 5. All Stage 5 artifacts live in `docs/` — the app itself is not modified in this stage.
- **Comments in generated files:** Every file created or significantly changed in Stage 5 must include short, useful inline comments explaining what each section does and why. Apply this to `docs/cloudinary-getting-started-preview.html` (explain each section: image display, measurement fetch, SDK snippet, stats), `docs/cloudinary-environment.json` (top-level comment block describing what the file contains and where to find docs), and any validation scripts. Focus on the non-obvious — why a particular URL pattern is used, what the Accept header achieves. Do not comment every line.
- For server lanes, the chat snippet and `#stage-5-integration-snippet` must generate the delivery URL through the detected stack's Cloudinary SDK when available. Do not use a pasted static URL as the only server integration.
- **Snippet sourcing:** compose every SDK snippet (chat and `#stage-5-integration-snippet`) from the installed Cloudinary skill matching the stack (e.g., `.claude/skills/cloudinary-react/SKILL.md` for React), or from the official Cloudinary docs for stacks without one — never from memory. Get the API composition right: in `@cloudinary/url-gen`, qualifiers such as auto gravity belong inside the resize action (`fill().gravity(autoGravity())` → `c_fill,g_auto,...`), never chained as standalone actions (which produces broken URL segments like `/auto/auto/`).
- For front-end-only lanes, follow the framework-appropriate Cloudinary docs. A plain `<img src>` is acceptable when it matches the app. React-specific helpers are only for React-classified projects.
- Optional validation scripts may wrap measurements and Admin checks. Name them according to the project ecosystem; do not assume npm unless the repo is npm-based.
- In chat for front-end/full-stack lanes, echo the canonical transformed URL.

### Verification response format

For full success, use this exact structure — no repetition, no sections repeated elsewhere:

**Stage 5 complete:**

- Confirmed `samples/coffee` returns 200 — used as the preview asset (or: used Admin API to find asset `<public_id>`)
- Created `ai_powerstart` unsigned upload preset via Admin API (verified credentials and product environment are reachable)
- Measured original and transformed URLs: `<original size/format/dimensions>` → `<transformed size/format/dimensions>` — `<% savings>`
- Created `docs/cloudinary-environment.json`
- Created `docs/cloudinary-getting-started-preview.html` (front-end and full-stack only)

Your **<Stack>** app is configured with Cloudinary and ready to deliver optimized media.

**Original image:**
```
<plain URL>
```

**Transformed image:**
```
<plain URL>
```

**<Stack> SDK snippet:**
```
<minimal code block that generates the delivery URL through the SDK>
```

**Preview:** Open `docs/cloudinary-getting-started-preview.html` in a browser. You'll see the original image next to the optimized version — the transformed image is smaller and faster while keeping quality. This is Cloudinary's delivery optimization in action. (Omit for API-only lanes.)

**Environment docs:** Open `docs/cloudinary-environment.json` for all verification details — no secrets stored.

---
Let me know when you're done reviewing your configuration and I'll suggest some next steps.

**Suggested reply:** Done
---

**Shortcut rule:** If Stage 5 did not run this round, show only the Done gate above. Still close with STAGE_COMPLETION_FORMAT (all five stages checked off).

## What's next after setup

**Important:** The sections below are the complete and authoritative What's next content — they are NOT a summary and there is no other file to consult. Immediately before writing your What's next reply, re-read the sections below and copy each section you show verbatim from this text — word-for-word, no paraphrasing, no writing from memory. In particular, "Customize your cloud name" means renaming the cloud name on the product environments settings page — it is NOT the custom domain/CNAME feature; never mention CNAME, custom domains, subdomains, or Console paths like "Settings → Account".

After the user says `Done` (the Done gate appears at the end of Stage 5), reply with the full What's next sections in this order. The numbered list below is your internal ordering checklist, NOT the reply format — never reply with a numbered summary list of one-line blurbs in place of the full sections:
1. **Install the Cloudinary VS Code extension** (if using VS Code)
2. **Customize your cloud name** — ONLY if the cloud name is machine-generated (see that section's gate); otherwise this step does not exist: output nothing for it and renumber the remaining steps
3. **Run your app** — see the integration end-to-end from your browser
4. **Activate the MCP servers** — enable AI assistance in your IDE
5. **Choose a next step** — pick from the relevant use-case prompts

Use the delivery lane tracked during setup to choose which prompts to show. Replace `[framework]` in copy/paste prompts with the detected framework name, such as Flask, Django, Rails, or Next.js.

**What's safe to keep or delete:** The `docs/cloudinary-getting-started-preview.html` file was for validation — you can delete it anytime. Keep `docs/cloudinary-environment.json` for reference and `.env.example` for new developers. Never delete or commit `.env` (it contains real secrets).

### Install the Cloudinary VS Code extension

If you're using VS Code or a VS Code-based IDE (like Cursor), the [Cloudinary VS Code extension](https://cloudinary.com/documentation/cloudinary_vscode_extension?referrer=ai-powerstart-prompt) lets you manage, preview, and deliver media directly from your editor—no context switching needed.

1. Open VS Code extensions (Cmd+Shift+X on Mac, Ctrl+Shift+X on Windows/Linux)
2. Search for "Cloudinary" and click Install

### Customize your cloud name

Decide first, before writing anything for this step:

- **Machine-generated cloud name** (an unpronounceable consonant/digit jumble such as `dqj4x8f3k` or `hb2q1r5xj`): show this step by copying the marker block below exactly.
- **Anything else** — any cloud name containing a recognizable word, personal name, or brand-like string, including hyphenated or multi-word names (e.g., `yelenik`, `new-shop`, `mycompany`, `acme`): SKIP this step. Skipping means output NOTHING for it: no "Customize your cloud name" heading, no one-line summary, no improvised alternative, and no line for it in the numbered overview — continue directly to the next section. Writing ANY cloud-name content for a non-machine-generated cloud name is an error. All-lowercase alone does not mean random. **When in doubt, skip.**

**Scope guard:** this step renames the cloud name inside the delivery URL path (`res.cloudinary.com/<cloud_name>/...`). It is NOT the custom domain / CNAME feature (`media.yourcompany.com`) — never mention custom domains or subdomains here, and never invent Console paths such as "Account → Custom Domain". Do not write cloud-name steps from your own knowledge: the cloud name is NOT edited under "Settings → Account", there is no pencil/edit icon flow, and any navigation other than the marker block's steps is wrong. The only correct location is **Settings → Product Environments** (`https://console.cloudinary.com/app/settings/product-environments?referrer=ai-powerstart-prompt`), exactly as written in the marker block below.

When shown, reply with the exact text between the BEGIN and END marker lines — character-for-character, rendered as normal markdown. Do not include the marker lines themselves, do not wrap the text in a code fence, and do not shorten, reformat, merge, or reword any line:

<!-- BEGIN VERBATIM -->
### Customize your cloud name

Your cloud name appears in every delivery URL. A short, brand-related cloud name is better for SEO/AEO than the auto-generated default:

1. Go to: `https://console.cloudinary.com/app/settings/product-environments?referrer=ai-powerstart-prompt`
2. Find your product environment in the list.
3. Click the **More** button (three dots ⋮) on the right side of your product environment row.
4. Select **Edit** from the menu.
5. Change the "Cloud Name" field to your new name (e.g., `mycompany`, `cdn-assets`, etc.).
6. Click **Save**.

**After you change it,** update your `.env` file:
- Change `CLOUDINARY_CLOUD_NAME=<old_name>` to `CLOUDINARY_CLOUD_NAME=<new_name>`
- If using React/Vite, also update `VITE_CLOUDINARY_CLOUD_NAME=<new_name>`
- Restart your app so the new cloud name takes effect. The delivery URLs verified during setup used the old cloud name, so they'll change.
<!-- END VERBATIM -->

### Run your app

Install dependencies and start your dev server:

When the user's detected framework is one of the below, output these exact commands — word-for-word, do not paraphrase, abbreviate, or substitute alternative commands. Present them in code blocks ready to copy-paste:

**Python/Flask:**
```
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python3 app.py
```

**Node/Next.js:**
```
npm install
npm run dev
```

**Node/Express:**
```
npm install
node server.js
```

**Ruby/Rails:**
```
bundle install
rails server
```

**PHP/Laravel:**
```
composer install
php artisan serve
```

**Go:**
```
go mod tidy
go run .
```

If the detected framework is not listed above, determine and show the equivalent install-then-start sequence for that stack, but always include all prerequisite setup steps (venv, package manager install, etc.) before the server start command.

**Full-stack apps with separate client and server processes** (e.g., a Vite/React front end plus an Express API): show the start commands for BOTH processes, each clearly labeled with what it starts and its port. Showing only the server command leaves the user unable to open the app.

### Activate the MCP servers

Restart your IDE so the MCP servers load your credentials. You may see permission prompts—confirm them. If you need help, ask the AI assistant.

---
### Build your app with Cloudinary using prompts

**Optimize and deliver your product or marketing assets**

`Generate optimized delivery URLs from assets in my Cloudinary product environment and display them in my [framework] app`

**Transform and deliver video content**

`Transform, optimize, and deliver video assets retrieved from my product environment in my [framework] app using Cloudinary`

**Let users upload photos or files to your app**

`Set up users to upload images in my [framework] app using the ai_powerstart upload preset and the Cloudinary Upload widget`

### Build your API with Cloudinary using prompts (back-end only)

**Generate transformed and optimized delivery URLs**

`Generate transformed and optimized delivery URLs from my Cloudinary assets and return them in my [framework] API responses`

**Generate signed delivery URLs for protected assets**

`Add a server-side endpoint in my [framework] API that generates signed Cloudinary delivery URLs without exposing secrets to clients`

**Upload files from your server to Cloudinary**

`Upload files from my server to Cloudinary in my [framework] API`

**Build an admin workflow for finding and managing assets**

`Tag and search uploaded assets in Cloudinary using my [framework]`

### Rules for next steps

* **Output the startup commands exactly as written in the framework sections above.** Do not abbreviate, paraphrase, improvise, or substitute alternative commands. If Python/Flask is detected, output the full `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt` followed by `python3 app.py` — never skip steps or show `pip install` alone.
* **CRITICAL — The "Build your app/API with Cloudinary" items are copy/paste prompts, NOT code.** Copy and paste each prompt string EXACTLY as written above — verbatim (apart from the `[framework]` substitution), inside backticks for copy/paste. Do NOT generate, create, write, show, or include ANY code examples, SDK code, imports, functions, or implementation details in the What's Next section. Do NOT replace the prompt strings with tutorials or your own explanations. Never add extra sections (e.g., "Resources", example code, sample implementations) to What's Next. All code and examples are forbidden here — code is written only after the user runs one of the prompts, and then only per the matching installed `cloudinary-*` skill.
* **What to include in What's Next:** Show sections in this order: (1) Install Cloudinary VS Code extension, (2) Customize your cloud name (only if cloud name looks auto-generated), (3) Run your app, (4) Activate the MCP servers, (5) Build your app/API with Cloudinary (pick relevant prompts). Then finish with the "What's safe to keep or delete" section at the end.
* **Customize your cloud name — CONDITIONAL:** Show this section only when the cloud name looks machine-generated — an unpronounceable consonant/digit jumble like `dqj4x8f3k` or `hb2q1r5xj`. A pronounceable word, personal name, or brand-like string (e.g., `yelenik`, `new-shop`, `mycompany`) is NOT auto-generated — that includes hyphenated or multi-word names; all-lowercase alone does not mean random. When in doubt, skip — and when skipped, output NOTHING for it: no heading, no blurb, no substitute sentence, and no line in the numbered overview list. When shown, output the section EXACTLY as written above — verbatim, with all six steps and the "After you change it" bullet section. Do not summarize, paraphrase, or create a shorter version, and never substitute custom-domain/CNAME content for it. The six steps come ONLY from the marker block (Settings → Product Environments) — never replace them with a "Settings → Account" / pencil-icon flow or any other navigation written from memory.
* Always show the VS Code extension section — users in other editors will simply skip it.
* Use the detected delivery lane to choose which prompts to show. Show the "Build your app with Cloudinary" section for front-end/full-stack, or "Build your API with Cloudinary" for back-end API-only.
* For front-end/full-stack apps, show the "Optimize and deliver", "Transform and deliver video", and "Upload photos" prompts.
* For back-end API-only apps, show the "Generate transformed URLs", "Generate signed URLs", "Upload files", and "Build admin workflow" prompts.
* Don't mix lane-specific suggestions.
* Don't suggest optimization as a next step — Stage 5 already demonstrated it with real measurements. Only mention it if the user asks.
* Don't suggest UGC uploads as the primary next step. Lead with delivering assets already in the product environment; offer UGC as an optional step for apps that need it.
* Don't suggest responsive image delivery for an API-only app.
* Don't ask repeatedly if the preset should stay unsigned.
* Don't suggest API key changes unless the user reports a specific permission problem.
* Keep the suggestions focused on user scenarios, not Cloudinary feature names.
* For framework-specific details, let the user copy/paste the prompt and let the relevant skill answer.
* When the user runs one of the Build-with-Cloudinary prompts, read the matching installed `cloudinary-*` skill (e.g., `cloudinary-react` for React projects, `cloudinary-transformations` for URL building) before writing any code — never compose SDK code from memory.
* When users ask follow-up questions about transformations, optimization, or delivery URLs, direct them to use the `/cloudinary-transformations` skill to build and debug URLs.
* For questions about Cloudinary APIs, SDKs, webhooks, and implementation details not covered by specialized skills, direct them to use the `/cloudinary-docs` skill.
* In code examples for rendering or delivering images in the app, always verify that the asset exists in the product environment before outputting the delivery URL. Don't hardcode or assume assets exist — guide users to check their Cloudinary product environment first.
* **When writing app code that renders a Cloudinary asset, start from the verified URLs in `docs/cloudinary-environment.json`** — same asset, same or simpler transformation — instead of composing a new URL from memory. Before reporting the work complete, extract the exact URL the code produces (run it or log it) and fetch it: it must return HTTP 200. If the URL contains repeated bare segments like `/auto/auto/`, qualifiers were chained as standalone actions in `@cloudinary/url-gen` (correct form: `fill().gravity(autoGravity())`, producing `c_fill,g_auto,...`); fix the composition and re-verify. Never hand the user code whose generated URL was not fetch-verified.
* If the user needs help activating the MCP servers, suggest they use the AI assistant: "If you run into issues with MCP activation, ask me to help — I can walk you through the specific steps for your IDE."
