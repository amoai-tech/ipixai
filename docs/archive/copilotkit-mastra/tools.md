For iPix, I would use these in a **layered way**, not all at once.

|Tool|iPix fit|Best use|Phase|
|---|--:|---|---|
|**Firecrawl**|**96/100**|Brand website crawl + structured brand intelligence|**Core/MVP**|
|**Tavily**|**92/100**|Fresh web search, competitor/trend research|**MVP**|
|**AgentBrowser**|**90/100**|Reliable browser automation with Playwright|**Post-MVP**|
|**Stagehand**|**88/100**|AI-driven browser actions on messy sites|**Post-MVP**|
|**BrowserViewer**|**72/100**|CLI/browser-agent debugging in Studio|**Advanced/dev-only**|
|**WhatsApp Channel**|**95/100**|Client, crew, talent messaging|**Post-MVP**|

## 1. Firecrawl — keep and use heavily

Mastra describes Firecrawl as a web-data API that converts websites into clean Markdown or structured JSON for scraping/search workflows. ([Mastra](https://mastra.ai/integrations/tools/firecrawl "Guide: Web scraping with Firecrawl | Mastra Docs"))

This is an excellent fit for **Brand Intelligence**.

Real iPix flow:

```text
Brand enters:
https://brand.com

Firecrawl
↓
homepage
about
collections
product pages
brand story
visual references
↓
Mastra Brand Intelligence
↓
Brand DNA draft
↓
Human approval
↓
Supabase
```

Use it for:

- crawling a brand's whole website;
    
- extracting product/catalog information;
    
- collecting brand copy;
    
- gathering creative references;
    
- refreshing Brand DNA periodically.
    

You already have a Firecrawl workflow, so I would **keep it rather than replace it with Tavily crawl**.

---

## 2. Tavily — add for search, not as Firecrawl replacement

Mastra's official Tavily integration now provides four typed tools:

```text
search
extract
crawl
map
```

with Zod schemas and options for recency, domains, raw content and images. ([Mastra](https://mastra.ai/integrations/tools/tavily "Tavily | Tools | Mastra Docs"))

For iPix, its best role is **discovery**.

Example:

> Find the latest 2026 luxury handbag photography trends and competitor campaigns.

```text
Creative Director
↓
Tavily Search
↓
recent articles / campaigns / references
↓
Tavily Extract on best sources
↓
structured research summary
↓
creative concept
```

Another use:

> What image specifications does Amazon currently require for apparel listings?

Tavily can search current sources instead of relying on model memory.

### Recommended split

```text
TAVILY
= find the right websites/pages

FIRECRAWL
= deeply crawl and structure a chosen website
```

That is better than having both tools perform the same job.

---

# 3. AgentBrowser — my preferred browser automation option

Mastra's `@mastra/agent-browser` uses Playwright and accessibility-tree references for reliable element targeting. It supports screenshots and detailed browser actions. ([Mastra](https://mastra.ai/integrations/browsers/agent-browser "AgentBrowser | Browser | Mastra Docs"))

For iPix this is useful when a website has **no suitable API**.

Real examples:

### Talent research

```text
Agent
→ open agency website
→ search model roster
→ inspect profiles
→ collect public portfolio details
→ return shortlist
```

### Production research

```text
Planner
→ visit studio website
→ inspect facilities
→ check publicly listed availability/contact options
→ return studio comparison
```

### Marketplace QA

```text
Agent
→ open Shopify storefront
→ inspect product page
→ verify new image appears
→ screenshot evidence
```

I'd choose **AgentBrowser before Stagehand** for deterministic iPix workflows because Playwright + accessibility refs gives you more controlled, testable behavior. ([Mastra](https://mastra.ai/integrations/browsers/agent-browser "AgentBrowser | Browser | Mastra Docs"))

---

# 4. Stagehand — use when pages are unpredictable

Stagehand adds AI-based page understanding and lets the agent use natural-language actions like:

> Click the Sign In button.

or extract structured data directly from a page. ([Mastra](https://mastra.ai/integrations/browsers/stagehand "Stagehand | Browser | Mastra Docs"))

This is excellent when:

- selectors change often;
    
- websites are highly dynamic;
    
- you need ad-hoc research;
    
- the exact page structure isn't known beforehand.
    

Example:

> Search this unfamiliar casting site and extract models based in Miami with editorial experience.

Stagehand can reason about the page and use natural-language element targeting and structured extraction. ([Mastra](https://mastra.ai/integrations/browsers/stagehand "Stagehand | Browser | Mastra Docs"))

### My rule

```text
Known repeatable workflow
→ AgentBrowser

Unknown / changing website
→ Stagehand
```

Do not install both into every agent.

---

# 5. BrowserViewer — probably not part of customer-facing iPix

BrowserViewer is designed specifically for agents driving browsers through CLI tools. It launches Chrome, injects the CDP URL into CLI commands and streams the browser session into Mastra Studio. Mastra explicitly recommends AgentBrowser or Stagehand for SDK-based automation instead. ([Mastra](https://mastra.ai/integrations/browsers/browser-viewer "BrowserViewer | Browser | Mastra Docs"))

So for iPix:

**Don't use this in Core/MVP.**

Potential development use:

```text
Cursor / agent harness
↓
browser CLI
↓
BrowserViewer
↓
live browser stream in Mastra Studio
```

Good for debugging experimental autonomous agents.

Not necessary for normal Production Planner or Brand Intelligence.

---

# 6. WhatsApp — very strong iPix feature

Mastra now supports WhatsApp Business Cloud through its Channels system and the `@chat-adapter/whatsapp` adapter. Mastra handles agent/channel wiring and generates a webhook route for the agent. ([Mastra](https://mastra.ai/integrations/channels/whatsapp "WhatsApp | Channels | Mastra Docs"))

This could become one of iPix's most useful operational features.

### Crew communication

```text
Planner
↓
WhatsApp

"Call time tomorrow is 7:00 AM.
Studio: 221 King St.
Reply CONFIRM."
```

### Talent

```text
"Your fitting is Tuesday at 2 PM.
Please confirm."
```

### Client approvals

```text
"Your Spring campaign shot list is ready."

[Review plan]
```

### Production changes

Producer:

> Move tomorrow's fitting to 3 PM.

```text
WhatsApp
↓
Mastra Planner
↓
find shoot
↓
propose schedule change
↓
HITL approval
↓
Supabase
↓
notify affected people
```

Mastra's WhatsApp integration requires Meta access token, app secret, phone-number ID and webhook verification configuration. ([Mastra](https://mastra.ai/integrations/channels/whatsapp "WhatsApp | Channels | Mastra Docs"))

This should be **Post-MVP**, after authorization and HITL are solid.

---

# Recommended iPix web-tool architecture

```text
                    Mastra Agents
                         │
          ┌──────────────┼──────────────┐
          │              │              │
       Tavily        Firecrawl       Browser
          │              │              │
    SEARCH WEB       CRAWL SITE    ACT ON SITE
          │              │         ┌────┴────┐
          │              │         │         │
          │              │   AgentBrowser Stagehand
          │              │
          └──────────────┴─────────────┐
                                      │
                                 structured data
                                      │
                                   Supabase
```

Then:

```text
                    WhatsApp
                       ↕
                Mastra Channels
                       ↕
                 Planner Agent
                       ↕
                   Supabase
```

---

# Which agent gets which tool?

|Agent|Tools|
|---|---|
|**Production Planner**|Internal Supabase tools first; Tavily occasionally|
|**Brand Intelligence**|**Firecrawl + Tavily**|
|**Creative Director**|**Tavily Search/Extract**|
|**Talent/Model Match**|Tavily + AgentBrowser later|
|**Booking**|Internal APIs first; browser only when no API exists|
|**Commerce**|Mercur APIs; AgentBrowser only for external QA|
|**Social Discovery**|Tavily first; platform APIs preferred|
|**Customer/Crew assistant**|**WhatsApp Channel**|

---

# Important best practice

Do not give every agent:

```text
Tavily
Firecrawl
AgentBrowser
Stagehand
WhatsApp
```

That increases cost, latency and risk.

Use least privilege:

```text
Brand Intelligence
→ crawl/search

Creative Director
→ search

Browser Research Agent
→ browser

Production Planner
→ internal iPix tools

WhatsApp Agent
→ messaging + approved Planner actions
```

Mastra's new tool hooks are particularly useful here because they let you validate or block tool calls before execution and audit them afterward. ([Mastra](https://mastra.ai/blog/introducing-tool-hooks?utm_source=chatgpt.com "Introducing Tool Hooks for Mastra Agents | Mastra Blog"))

For iPix I'd eventually enforce:

```text
before browser action
→ permission?
→ safe domain?
→ read or write?
→ approval required?

after action
→ audit trace
```

# Recommended phases

**Core:** Firecrawl only where your existing Brand Intelligence requires it; no browser automation or WhatsApp.

**MVP:** add Tavily for current web/competitor/trend research.

**Post-MVP:** add AgentBrowser for deterministic web automation and WhatsApp for production communication.

**Advanced:** Stagehand for difficult/unpredictable sites; BrowserViewer for developer/agent-harness experimentation.

### Final recommendation

If I had to choose only three for iPix:

**1. Firecrawl — deep brand/site intelligence**  
**2. Tavily — fresh search/research**  
**3. WhatsApp — real-world production communication**

Then add **AgentBrowser** once there is a specific workflow where no API can do the job reliably.

That gives iPix a clean division: **search the web, understand brands deeply, communicate with humans, and only automate browsers when necessary.**