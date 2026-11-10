# Screen wireframes — ASCII layout (matches `Pages/`)

> **SSOT:** [`../../Pages/`](../../../Pages/) · Method: [`ipix-wireframe`](../../../../.agents/skills/ipix-wireframe/SKILL.md)
> **Regenerate:** `python3 ../_generate-layout-assets.py` (after DC layout changes)

Each file mirrors the **shell grid** and **Workspace zones** from its `.dc.html` — not a redesign.

| SCR | Wireframe | DC file |
|:---:|:---|:---|
| 01 | [SCR-01-command-center](./SCR-01-command-center.md) | `Command Center.v2.image-first.dc.html` |
| 02 | [SCR-02-brand-list](./SCR-02-brand-list.md) | `Brand List.v2.image-first.dc.html` |
| 03 | [SCR-03-brand-detail](./SCR-03-brand-detail.md) | `Brand Detail.v2.image-first.dc.html` |
| 04 | [SCR-04-shoots-list](./SCR-04-shoots-list.md) | `Shoots List.v2.image-first.dc.html` |
| 05 | [SCR-05-shoot-detail](./SCR-05-shoot-detail.md) | `Shoot Detail.v2.image-first.dc.html` |
| 06 | [SCR-06-shoot-wizard](./SCR-06-shoot-wizard.md) | `Shoot Wizard.v2.image-first.dc.html` |
| 07 | [SCR-07-campaigns](./SCR-07-campaigns.md) | `Campaigns.v2.image-first.dc.html` |
| 08 | [SCR-08-assets](./SCR-08-assets.md) | `Assets.v2.image-first.dc.html` |
| 09 | [SCR-09-matching](./SCR-09-matching.md) | `SCR-09-Matching-Talent.dc.html` |
| 10 | [SCR-10-channel-preview](./SCR-10-channel-preview.md) | `Channel Preview.v2.image-first.dc.html` |
| 11 | [SCR-11-onboarding](./SCR-11-onboarding.md) | `Onboarding.v2.zeely.dc.html` |
| 15 | [SCR-15-notifications](./SCR-15-notifications.md) | `SCR-15-Notification-Center.dc.html` |
| 16 | [SCR-16-analytics](./SCR-16-analytics.md) | `Analytics.v2.image-first.dc.html` |
| 17 | [SCR-17-campaign-performance](./SCR-17-campaign-performance.md) | `Campaign Performance.v2.image-first.dc.html` |
| 18 | [SCR-18-collaboration](./SCR-18-collaboration.md) | `SCR-18-Collaboration-Audit.dc.html` |
| 20 | [SCR-20-talent-profile](./SCR-20-talent-profile.md) | `SCR-20-Talent-Profile.dc.html` |
| 21 | [SCR-21-booking-wizard](./SCR-21-booking-wizard.md) | `Shoot Wizard.v2…` (standalone booking) |
| 22 | [SCR-22-booking-detail](./SCR-22-booking-detail.md) | `Shoot Detail.v2…` (standalone booking) |
| 23 | [SCR-23-availability](./SCR-23-availability.md) | `SCR-23-Availability-Editor.dc.html` |
| 24 | [SCR-24-talent-onboarding](./SCR-24-talent-onboarding.md) | `SCR-24-Talent-Onboarding.dc.html` |
| 25 | [SCR-25-role-dashboards](./SCR-25-role-dashboards.md) | `SCR-25-Role-Dashboards.dc.html` |
| 26 | [SCR-26-crm-companies](./SCR-26-crm-companies.md) | `SCR-26-CRM-Companies-List.dc.html` |
| 27 | [SCR-27-crm-company-detail](./SCR-27-crm-company-detail.md) | `SCR-27-CRM-Company-Detail.dc.html` |
| 28 | [SCR-28-crm-contacts](./SCR-28-crm-contacts.md) | `SCR-28-CRM-Contacts-List.dc.html` |
| 29 | [SCR-29-crm-contact-detail](./SCR-29-crm-contact-detail.md) | `SCR-29-CRM-Contact-Detail.dc.html` |
| 30 | [SCR-30-crm-pipeline](./SCR-30-crm-pipeline.md) | `SCR-30-CRM-Pipeline.dc.html` |
| 31 | [SCR-31-crm-deal-detail](./SCR-31-crm-deal-detail.md) | `SCR-31-CRM-Deal-Detail.dc.html` |

## Shell archetypes

| Archetype | DC pattern | Screens |
|---|---|---|
| `standard-v2` | `auto \| 1fr \| auto` + `data-screen-label` | 01–05, 07–08, 10, 16–17, 22 |
| `fixed-3col` | `56px \| 1fr \| 320–340px` | 09, 15, 18, 20, 25–31 |
| `wizard-full` | flex column 100vh | 06, 21 |
| `onboarding-full` | full-bleed centered card | 11 |
| `split-2col` | `400px \| 1fr` | 24 |
| `two-panel` | `56px \| 1fr` (no intel) | 23 |
