# CopilotKit Troubleshooting

> Status: Placeholder — add only verified failure modes and fixes.

## Purpose

Give engineers a fast path to diagnose CopilotKit runtime, streaming, reconnect, auth, and UI-state failures without repeating historical investigation.

## Troubleshooting areas

- Runtime endpoint/auth failures
- Missing or wrong tenant/resource context
- Stream starts but follow-up drops
- Refresh/reconnect loses history
- Stop/cancel does not terminate work
- Duplicate or late events
- AG-UI state mismatch
- Generative UI rendering failures
- Version compatibility failures
- Preview vs production differences

## Evidence format

For each failure record: symptom → likely layer → exact check → fix → verification → related issue/PR.

## Primary source material

- `../80-plans/prd-ipix-agent-platform.md`
- `../80-plans/iPix Agent Platform — Migration Plan.md`
- `../80-plans/iPix Agent Platform — Roadmap.md`

Do not copy old incident conclusions unless they still reproduce on the current version family.