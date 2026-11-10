# Pilot intent — IPI-1389: Keep Production Copilot working after upgrade

**Live owner:** https://linear.app/amo100/issue/IPI-1389
**Related epic:** https://linear.app/amo100/issue/IPI-1384

## Problem and people

Fashion operators depend on Production Copilot for secure, persistent planning. A runtime upgrade must not break Stop, conversation continuity, or review of exact plans.

## Desired outcome

A signed-in operator can stream a Planner answer, stop **their intended run**, refresh with authorized history, review the correct Shoot Plan revision, and remain isolated from another organization — on the **actually deployed** release.

## Scope and non-goals

Preserve the existing user journey and human approval requirements. This pilot **does not authorize a second upgrade**, a second agent, or a second database. Its purpose is to demonstrate the distinction between **code merged** and **live certified**.

## Constraint and decision

PR [#319](https://github.com/amoai-tech/ipixai/pull/319) was verified merged; whether the upgrade is live and certified must be rechecked in the authoritative Linear issue and current deployment. Product owner approval remains required for release/paid QA.
