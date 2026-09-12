import { handleFirecrawlWebhook } from "./handler.ts";

console.info("firecrawl-webhook function started");

Deno.serve(handleFirecrawlWebhook);
