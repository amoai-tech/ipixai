import { handleBrandIntelligenceRequest } from "./handler.ts";

console.info("brand-intelligence function started");

Deno.serve(handleBrandIntelligenceRequest);
