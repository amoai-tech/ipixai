import { handleStartBrandCrawl } from "./handler.ts";

console.info("start-brand-crawl function started");

Deno.serve(handleStartBrandCrawl);
