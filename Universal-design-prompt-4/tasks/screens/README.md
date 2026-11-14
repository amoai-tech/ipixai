# Screen tasks — HTML → React (one file per SCR)

> **Verified:** 2026-07-06 · **Design index:** [`docs/handoff/02-screen-map.md`](../../docs/handoff/02-screen-map.md)
> **Build discipline:** [`../designtoreact.md`](../designtoreact.md) · [`design-to-production`](../../../.agents/skills/design-to-production/SKILL.md)
> **Task template:** [`SCR-TEMPLATE.md`](SCR-TEMPLATE.md) · **Wireframes:** [`wireframes/`](./wireframes/) · **Diagrams:** [`diagrams/`](./diagrams/)

Every `SCR-*.md` includes a **Conversion plan** block aligned with `designtoreact.md` + `design-to-production` Phase 0. Fill §0 Prove tables before coding.

## Compliance (2026-07-06)

| Requirement | Source | In every SCR task? |
|---|---|:---:|
| Target (route, page file, route status) | designtoreact §1 | ✅ |
| Skill routing | designtoreact + design-to-production | ✅ |
| Definition of Ready | designtoreact | ✅ |
| Phase 0 Prove tables | design-to-production | ✅ (fill at kickoff) |
| Negative rules + reuse audit | designtoreact §4–5 | ✅ |
| Verification gate §16 + visual regression §17 | designtoreact | ✅ |
| Wireframe ASCII matches DC shell | ipix-wireframe | ✅ |
| Mermaid layout + flow diagrams | mermaid-diagrams | ✅ |
| Full component map / integration matrix | SCR-TEMPLATE.md | ☐ fill per screen |
| Parity report §18 | SCR-TEMPLATE.md | ☐ at merge |

## Quick links

- **[MATRIX.md](./MATRIX.md)** — master status table + build order
- **[../README.md](../README.md)** — backend + framework backlog
- **[../checklists.md](../checklists.md)** — per-PR checklists

## Operator core

| SCR | Task | Status |
|:---:|:---|:--:|
| 01 | [Command Center](./SCR-01-command-center.md) | ✅ |
| 02 | [Brand List](./SCR-02-brand-list.md) | ✅ |
| 03 | [Brand Detail](./SCR-03-brand-detail.md) | ✅ |
| 04 | [Shoots List](./SCR-04-shoots-list.md) | ✅ |
| 05 | [Shoot Detail](./SCR-05-shoot-detail.md) | 🟡 |
| 06 | [Shoot Wizard](./SCR-06-shoot-wizard.md) | ✅ |
| 07 | [Campaigns](./SCR-07-campaigns.md) | 🔴 blocked D1 |
| 08 | [Assets](./SCR-08-assets.md) | 🔴 stub |
| 09 | [Matching](./SCR-09-matching.md) | 🟡 |
| 10 | [Channel Preview](./SCR-10-channel-preview.md) | ✅ |
| 11 | [Onboarding](./SCR-11-onboarding.md) | ✅ |
| 15 | [Notifications](./SCR-15-notifications.md) | ⚪ |
| 16 | [Analytics](./SCR-16-analytics.md) | ⚪ blocked D2 |
| 17 | [Campaign Performance](./SCR-17-campaign-performance.md) | ⚪ blocked D2 |
| 18 | [Collaboration](./SCR-18-collaboration.md) | ⚪ |

## Booking / talent

| SCR | Task | Status |
|:---:|:---|:--:|
| 20 | [Talent Profile](./SCR-20-talent-profile.md) | ⚪ |
| 21 | [Booking Wizard](./SCR-21-booking-wizard.md) | ⚪ blocked B0b |
| 22 | [Booking Detail](./SCR-22-booking-detail.md) | ⚪ |
| 23 | [Availability](./SCR-23-availability.md) | ⚪ |
| 24 | [Talent Onboarding](./SCR-24-talent-onboarding.md) | ⚪ |
| 25 | [Role Dashboards](./SCR-25-role-dashboards.md) | ⚪ |

## CRM (backend ✅ — highest ROI)

| SCR | Task | Status |
|:---:|:---|:--:|
| 26 | [Companies List](./SCR-26-crm-companies.md) | 🟡 stub |
| 27 | [Company Detail](./SCR-27-crm-company-detail.md) | 🟡 stub |
| 28 | [Contacts List](./SCR-28-crm-contacts.md) | 🟡 stub |
| 29 | [Contact Detail](./SCR-29-crm-contact-detail.md) | 🟡 stub |
| 30 | [Pipeline](./SCR-30-crm-pipeline.md) | 🟡 stub |
| 31 | [Deal Detail](./SCR-31-crm-deal-detail.md) | 🟡 stub |

## Deferred (no task file)

SCR-12 Product Catalog · SCR-13 Collections · SCR-14 Asset→PDP · SCR-19 Event Management

## Recommended next PRs

1. SC1/SC2 atoms (shared — unblocks CRM)
2. **SCR-26 → SCR-31** CRM UI
3. **SCR-05** Shoot Detail tabs
4. **SCR-08** Assets read-only
5. **SCR-09** Matching tabs
6. **SCR-15** Notifications
7. **BE-B0b** then **SCR-21–22** Booking
