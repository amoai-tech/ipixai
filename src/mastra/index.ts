import { getMastra } from "./runtime";

// Mastra CLI contract: src/mastra/index.ts must export a named Mastra instance.
// The Next.js app must import getMastra from ./runtime instead of this CLI entry.
export const mastra = getMastra();