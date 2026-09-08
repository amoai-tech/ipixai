# Shipping templates (iPix)

---

## Live Linear progress update

Change dot in master table:

```markdown
| 12 | PLT-004 | Validate env at startup | M2 | 🟢 | [IPI-17](…) | IPI-17-PLT-004.md |
```

Update **Updated:** date in todo header. Refresh executive summary counts if milestone closed.

---

## Issue spec close-out

In the live Linear issue:

```markdown
## Acceptance criteria

- [x] **AC1** … — VERIFIED 2026-06-15 (`npm run build`, smoke: …)
- [x] **AC2** … — VERIFIED 2026-06-15
```

Fill `## Verify` checkboxes with command output summary.

---

## Linear description

Tick each step in completion block:

```markdown
#### B. Implementation
- [x] **B1** Operator sees … — proof: screenshot / build log
```

Set issue state **Done** only after all applicable verify + post-merge gates pass and evidence is recorded.

---

## Commit examples

```
feat(plt): IPI-16 PLT-003 — brand profile row + RLS for operators

fix(ui): IPI-22 UI-001 — dashboard shell four-state loading

docs(linear): IPI-17 PLT-004 — sync verify steps to Linear
```

---

## Sync script

```bash
node scripts/linear-update-issue.mjs IPI-16
node scripts/linear-update-issue.mjs --all
```

Update verified task descriptions/progress directly in Linear through the available connector/API.
