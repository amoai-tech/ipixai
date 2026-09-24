import "./sentry";
import { getMastra } from "./runtime";
import { resolveMastraSupabaseAuthConfig } from "./server-auth";

// IPI-1308: this entry is loaded only by the Mastra CLI server (`mastra dev` /
// the `mastra build` output), never by Next.js. Validate the standalone Supabase
// Auth config here so a misconfigured server exits before it listens instead of
// reporting /health while every authenticated request is rejected.
resolveMastraSupabaseAuthConfig();

// Mastra CLI contract: src/mastra/index.ts must export a named Mastra instance.
// The Next.js app must import getMastra from ./runtime instead of this CLI entry.
export const mastra = getMastra();

// The upstream starter's literal `new Mastra({ server: { host } })` cannot be
// restored here. IPI-1231's constraint is that this entry must not inline a
// `new Mastra({ ... })` configuration — it is NOT that getMastra() must never run
// here: the export above still evaluates and caches the instance when the Mastra
// CLI loads this file. Because there is no `server` literal for the CLI to read,
// the `mastra dev` listener host is enforced by MASTRA_HOST in
// scripts/dev-guard.mjs (IPI-1232), which pins it to 127.0.0.1.