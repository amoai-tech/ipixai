# Shipping templates (iPix)

These are compatibility examples only. Live Linear is the task/progress/evidence source of truth; do not maintain obsolete `todo.md` or local issue-file mirrors.

---

## Live Linear progress update

Update the current Linear issue directly:

```markdown
## Progress
- Current status: In Review
- Verified checkpoints: 8/10
- Exact head: <sha>
- Remaining blocker: <none / exact blocker>
- Next action: <exact action>
```

---

## Issue close-out

In the live Linear issue:

```markdown
## Acceptance criteria

- [x] **AC1** … — VERIFIED 2026-06-15 (`npm run build`, smoke: …)
- [x] **AC2** … — VERIFIED 2026-06-15
```

Record the applicable verification and post-merge evidence before Done.

---

## Linear description

Tick each completion step only when its proof exists:

```markdown
#### B. Implementation
- [x] **B1** Operator sees … — proof: screenshot / build log / targeted test
```

Set issue state **Done** only after all applicable verify + post-merge gates pass and evidence is recorded.

---

## Commit examples

```text
feat(plt): IPI-16 PLT-003 — brand profile row + RLS for operators
fix(ui): IPI-22 UI-001 — dashboard shell four-state loading
docs(linear): IPI-17 PLT-004 — update verified Linear evidence
```

---

## Linear updates

Use the available connected Linear connector/API. If Linear is unavailable, report the update as blocked rather than creating a local authoritative substitute.
