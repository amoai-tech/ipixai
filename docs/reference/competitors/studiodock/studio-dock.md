# StudioDock Feature Catalog

> **Status:** Historical competitor research supplemented with one current official capability check. This note is reference evidence only; re-verify current product details before making iPix product decisions. See [../README.md](../README.md) for screenshot provenance.

**Website:** [StudioDock](https://www.getstudiodock.com/)

## Executive Summary

StudioDock is a specialized booking platform for photography studios, content studios, creative spaces, podcast studios, cyclorama studios, and product-photography studios.

Unlike a generic scheduling tool, StudioDock is built around studio-rental operations where customers may book rooms, equipment, lighting, backdrops, staff assistance, and time blocks in one flow.

## Core Features

| Feature | Description | Real-World Example |
| --- | --- | --- |
| Room Booking | Book individual studio spaces | Book Studio A from 10am–2pm |
| Multi-Room Support | Manage multiple rooms | Daylight Loft + Cyclorama Room |
| Equipment Rentals | Add gear during checkout | Add Profoto lights |
| Backdrop Add-ons | Sell backdrop changes | White + Beige seamless |
| Setup Services | Sell setup assistance | Lighting technician support |
| Hourly Booking | Rent by hour | 3-hour ecommerce shoot |
| Day Booking | Full-day reservations | Fashion campaign production |
| Availability Calendar | Real-time availability | Show free slots instantly |
| Online Payments | Pay online | Credit card checkout |
| Pay Later / Deposit Options | Flexible booking payment flows | Reserve or deposit before full payment |
| Booking Confirmation | Automated confirmations | Instant email confirmation |
| Booking Summary | Full order review | Room + gear + services |
| Embedded Booking | Add booking to a website | Studio booking widget |
| Custom Pricing | Different room rates | Cyclorama costs more |
| Buffer Times | Setup/cleanup buffers | 30 mins before/after |
| Overtime Rules | Extra charges | +$50/hr overtime |
| Client Portal | Customer self-service | Manage eligible bookings |
| Repeat Bookings | Fast rebooking | Monthly fashion shoot |
| Client History | Track customers | Agency booking history |
| Multi-Currency | International checkout | Multiple supported currencies |
| Multi-Language | International booking | **10 supported booking languages as of 2026-09-07** |
| Add-On Upsells | Increase order value | Sell extra lighting |
| Offer Packages | Bundled services | Half-day package |
| Prepaid Hours | Studio credits / hour packages | Buy a creator bundle |
| Booking Analytics | Track revenue/utilization | Monthly utilization |

Current language count source: StudioDock's official [Features page](https://www.getstudiodock.com/features), which lists 10 supported booking languages as of 2026-09-07.

## Booking Flow

| Step | What Happens |
| --- | --- |
| 1 | Choose room / session |
| 2 | Choose date/time |
| 3 | Add equipment/options |
| 4 | Add backdrops/services |
| 5 | Add staff/assistants where applicable |
| 6 | Review booking |
| 7 | Pay, deposit, request, or reserve according to the offer |
| 8 | Receive confirmation |

## Revenue Features

| Feature | Benefit |
| --- | --- |
| Equipment Upsells | Higher average order value |
| Backdrop Upsells | Extra revenue |
| Setup Assistance | Service revenue |
| Prepaid Packages | Predictable cash flow |
| Repeat Client Flow | Higher retention |
| Online Payments | Faster cash collection |
| Add-On Catalog | Self-service sales |

## Client Management Features

| Feature | Purpose |
| --- | --- |
| Client Profiles | Store customer information |
| Booking History | Previous rentals |
| Repeat Booking | Faster rebooking |
| Customer Portal | Self-service |
| Agency / recurring-client context | Support repeat production customers |

## Payment / Operations Features

Historical screenshots and the current official product page show booking flows that keep availability, add-ons, contact information, payment state, staff/resources, buffers, and client history attached to the reservation.

The current official site also describes deposits, invoices, booking plans, admin scheduling, client portal balances, embeds, and integrations. These are StudioDock-owned operational capabilities, not evidence that iPix should reproduce a studio-management system.

## Studio Types Supported

| Studio Type | Fit |
| --- | --- |
| Fashion Photography | ⭐⭐⭐⭐⭐ |
| Ecommerce Product Photography | ⭐⭐⭐⭐⭐ |
| Cyclorama Studio | ⭐⭐⭐⭐⭐ |
| Portrait Studio | ⭐⭐⭐⭐⭐ |
| Content Creator Studio | ⭐⭐⭐⭐⭐ |
| Podcast Studio | ⭐⭐⭐⭐ |
| Video Production Studio | ⭐⭐⭐⭐ |
| Rental Equipment Studio | ⭐⭐⭐⭐⭐ |

## What iPix should learn

The useful concepts are structured production-resource selection and clear booking consequences.

| StudioDock Pattern | Better iPix Interpretation |
| --- | --- |
| Room selection | Planner expresses location/studio requirements |
| Equipment add-ons | Planner expresses equipment requirements |
| Staff add-ons | Planner expresses crew requirements |
| Packages | AI proposes a reviewable production bundle |
| Repeat bookings | Reuse approved production context/templates |
| Client history | Brand/CRM context links to production history |
| Booking summary | Show assumptions, cost, resources, and status in one production summary |

## What iPix should not copy

StudioDock should remain the model for a **studio booking source of truth**, not a reason to rebuild studio-management SaaS inside iPix.

Do not put these on the iPix critical path:

- full studio availability engine
- room inventory management
- general payment processing
- invoice/accounting system
- generic client portal for rental businesses
- generic studio revenue analytics

Where useful, iPix should integrate external booking providers and store the provider reference/status needed by the shoot plan.

## AI differentiation opportunity

StudioDock focuses on booking operations. iPix can differentiate before booking by helping answer:

- What production setup does this campaign require?
- Which studio characteristics matter?
- What equipment is required?
- What crew/talent roles are required?
- Which assumptions still need operator confirmation?

The AI should propose; the operator should approve consequential choices before an external booking or payment executes.

## Overall Rating

Historical category scoring from the original note:

| Category | Score /100 |
| --- | ---: |
| Studio Booking | 98 |
| Equipment Rental Management | 95 |
| Checkout Experience | 94 |
| Revenue Optimization | 93 |
| Client Management | 90 |
| AI Features | 20 |
| Automation | 80 |
| Ease of Use | 95 |
| Photography Studio Fit | 97 |

The unweighted mean of those nine historical category scores is **84.7/100**, rounded to **85/100**. No alternative weighting formula was documented, so this restored note does not preserve the old unsupported 89/100 total.

## Bottom line

StudioDock is strong evidence for a clear room/resource/add-on/booking flow. iPix should use that pattern to make production requirements concrete, while leaving studio availability, reservation, payment, and accounting truth with external booking systems where appropriate.
