import { getMastra } from "./runtime";

// Mastra CLI contract: src/mastra/index.ts must export a named Mastra instance.
// The Next.js app must import getMastra from ./runtime instead of this CLI entry.
export const mastra = getMastra();

// The upstream starter's literal `new Mastra({ server: { host } })` cannot be
// restored here: IPI-1231 requires this entry to stay free of eager
// construction, which leaves the CLI no `server` literal to read. The
// `mastra dev` listener host is therefore enforced by MASTRA_HOST in
// scripts/dev-guard.mjs (IPI-1232), which pins it to 127.0.0.1.