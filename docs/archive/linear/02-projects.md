The current **v2-ipix project structure is good**, but the execution metadata is still too loose. The best improvements are dates, current-cycle discipline, project updates, milestone coverage, and owner coverage.

## Current setup — score

|Area|Score|Review|
|---|--:|---|
|Initiative → Project hierarchy|98/100|Correct|
|Project purpose/description|96/100|Now concise and aligned|
|Milestone structure|95/100|Good business-outcome model|
|Project status/priority/lead|96/100|In Progress / High / lead set|
|Milestone dates|40/100|None set|
|Project target date|50/100|None set|
|Project updates/health|30/100|No disciplined update cadence yet|
|Issue ownership|45/100|Too many active/planned issues unassigned|
|Cycle discipline|55/100|No current cycle; work spans expired/future cycles|
|Dependency hygiene|92/100|Issue-level blockers are mostly the right choice|
|Documents/resources|90/100|Operating plan exists; can be more focused|

**Overall: 82/100 operationally.**

The hierarchy is not the problem. The project-management discipline is.

Linear’s current model supports this: projects should have a clear outcome/planned completion date, a lead, milestones, updates, and project graph/prediction data. Milestone dates and project target dates are optional, but they improve accountability and prediction. ([Linear](https://linear.app/docs/projects?utm_source=chatgpt.com "Projects – Linear Docs"))

## Corrections I recommend

|Change|Priority|Why|
|---|--:|---|
|**1. Set target dates for M1, M2, M3, Security**|P0|Milestones are active but undated|
|**2. Set a project target window**|P0|Required for useful completion prediction|
|**3. Start weekly project updates**|P0|Gives project health/history and surfaces risks|
|**4. Fix current cycle gap**|P0|There is no current iPix1 cycle|
|**5. Assign all active executable issues**|P0|Active work should have one accountable person|
|**6. Audit issues with no milestone**|P1|Every real project issue should map to an outcome or be explicitly out-of-scope|
|**7. Keep epics out of execution-count thinking**|P1|Epics organize; child issues execute|
|**8. Add focused project views**|P1|Easier Now/Next/Blocked execution|
|**9. Keep project dependencies unused for now**|P2|Only one execution project exists|
|**10. Keep long-form operating rules in docs, not project description**|P2|Prevent description staleness|

## 1. Set dates only where evidence exists

Linear explicitly supports milestone target dates, and the project graph uses project dates/velocity to estimate completion. ([Linear](https://linear.app/docs/project-milestones?utm_source=chatgpt.com "Project milestones – Linear Docs"))

Do this:

```text
M1 · Foundation
target date: set now

M2 · Product Workspace & Planning
target date: set now

M3 · Production
target date: set now

Parallel · Security & Reliability
target date: set review checkpoint

M4–M7
leave undated for now
```

Do not invent exact dates without capacity data. Month-level or quarter-level precision is better than fake precision.

## 2. Use weekly project updates

Linear specifically recommends Project Updates with:

- health: On track / At risk / Off track
    
- progress
    
- challenges
    
- next steps
    

and keeps update history in the project. ([Linear](https://linear.app/docs/initiative-and-project-updates?utm_source=chatgpt.com "Initiative and Project updates – Linear Docs"))

For `v2-ipix`, use:

```text
Health

Shipped / verified
- completed observable outcomes only

Current
- 3–6 active executable tasks

Risks
- blockers that can change milestone timing

Next
- next dependency-ordered slice
```

Do **not** list every backlog issue.

## 3. Fix cycle discipline

Current live state shows active work referencing expired and future cycles, but no current cycle.

That should be fixed before adding more work.

Best practice:

```text
Cycle = near-term commitment
not
Cycle = everything important
```

Only put work in the cycle when it is:

```text
owned
+ unblocked
+ acceptance criteria clear
+ actually expected to execute
```

For current iPix, that means a very small set around:

- **IPI-1065 · APP-001 — Give Operators One Consistent iPix Workspace Across the App**
    
- finishing/certification items in M1
    
- active Cloudinary 1110/1111/1112 lanes
    
- one security task if Agent 3 is actually working it
    

## 4. Assign active work, not backlog

Do not assign all 130 issues.

Assign only:

```text
In Progress
Todo in current cycle
next-ready tasks that are explicitly committed
```

Backlog can remain unassigned.

That follows Linear’s project model better than artificially giving every speculative task an owner.

## 5. Milestones need cleaner semantics

Your current milestone model is good:

```text
M1 Foundation
M2 Product Workspace & Planning
M3 Production
M4 Campaigns
M5 Measurement
M6 Learning
M7 Scale
Parallel Security & Reliability
```

Keep it.

Do not add technical milestones like:

```text
Mastra
Cloudinary
Supabase
Dashboard
```

Those belong as issue labels/views/workstreams.

Milestones should represent meaningful stages of project completion, which is exactly what Linear recommends. ([Linear](https://linear.app/docs/project-milestones?utm_source=chatgpt.com "Project milestones – Linear Docs"))

### One correction to recheck

**IPI-1069 · ASSETS-001 — Let Operators Browse Assets and Manage Asset Records** has shown conflicting milestone state across recent reads.

It should be:

```text
M2 = dashboard/list/detail installation
M3 = Cloudinary upload/approval/private delivery capability
```

That should be corrected/verified live.

## 6. Use project views aggressively

Linear lets project tabs contain attached issue views. ([Linear](https://linear.app/docs/projects?utm_source=chatgpt.com "Projects – Linear Docs"))

For `v2-ipix`, I recommend only these:

```text
Now
Next Ready
Blocked
Unassigned Active
Missing Milestone
COREV2
CLOUDINARYV2
```

Avoid creating 20 views.

### Best filters

**Now**

```text
project = v2-ipix
status = In Progress
exclude completed
```

**Next Ready**

```text
project = v2-ipix
status = Todo
no unresolved blocker
```

**Unassigned Active**

```text
project = v2-ipix
status = In Progress or Todo
assignee = none
```

**Missing Milestone**

```text
project = v2-ipix
milestone = none
exclude completed/duplicate/canceled
```

## 7. Project graph: use it, but only after metadata is real

Linear’s project graph tracks:

- scope
    
- progress
    
- velocity
    
- predicted completion
    

and updates hourly once enough issue data exists. ([Linear](https://linear.app/docs/project-graph?utm_source=chatgpt.com "Project graph – Linear Docs"))

But its signal will be poor if:

- dates are missing
    
- backlog is constantly entering/leaving scope
    
- epics and actual executable work are treated the same
    
- current-cycle discipline is weak
    

So first clean the execution metadata, then use the graph as a planning signal.

## 8. Project dependencies: do not use yet

Linear project dependencies are for blocking relationships **between projects**. ([Linear](https://linear.app/docs/project-dependencies?utm_source=chatgpt.com "Project dependencies – Linear Docs"))

Today:

```text
Initiative
└── v2-ipix
```

There is no second execution project to depend on.

Therefore:

```text
issue blockedBy = execution dependency
project dependencies = N/A for now
```

If later you split:

- Commerce
    
- Production Platform
    
- Marketing/Growth
    

into independent projects, then project dependencies become useful.

## 9. Documents/resources

Linear recommends project docs for PRDs, runbooks, specs, and long-form context. ([Linear](https://linear.app/docs/documents?utm_source=chatgpt.com "Documents – Linear Docs"))

Keep the project description short.

Move durable detail into 3–4 documents:

```text
1. v2-ipix · Operating Plan
2. Architecture / Source-of-Truth
3. Current Roadmap / Milestone Definition
4. Release / Verification Runbook
```

Do not repeat the same roadmap in project description + 10 issue descriptions + docs.

## Recommended final operating model

```text
Initiative
iPix V2 — strategic goal

Project
v2-ipix — one execution program

Milestones
business outcomes

Epics
feature/capability grouping

Issues
actual deliverables

blockedBy
hard execution sequence

Cycles
small near-term commitment

Views
Now / Next / workstreams

Updates
weekly health + progress + risks
```

### Faster/better approach:

Do **not** perform a 130-issue cleanup.

Do this in order:

```text
1. Set M1/M2/M3/Security target dates
2. Set a project target window
3. Create current cycle
4. Assign active tasks
5. Fix missing/wrong milestones on active + Todo only
6. Create first project update
7. Add Now / Next Ready / Blocked views
8. Clean backlog only as items approach execution
```

### Summary:

- **Best decision:** keep one project and current milestone structure.
    
- **Main problem:** execution metadata, not architecture.
    
- **Highest-value fixes:** dates, current cycle, ownership, weekly health update.
    
- **Avoid:** new projects, new milestones, or deeper hierarchy until independently owned/releasable work exists.