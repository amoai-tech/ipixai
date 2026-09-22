import { MastraClient } from "@mastra/client-js";

async function main() {
  const runId = process.argv[2]!;
  const baseUrl = process.argv[3];
  if (!baseUrl) throw new Error("Fixture base URL is required");
  const client = new MastraClient({ baseUrl, headers: { Authorization: "Bearer org-a-token" } });
  const agent = client.getAgent("default");
  console.log(`STARTER_READY run=${runId} pid=${process.pid}`);
  const response = await agent.stream([{ role: "user", content: `start ${runId}` }], {
    runId,
    memory: { thread: "thread-1", resource: "org:a::user:u" },
  });
  await response.processDataStream({ onChunk: (chunk: any) => {
    if (chunk?.type === "text-delta") console.log(`START_TICK run=${runId} text=${chunk.payload?.text ?? ""}`);
  }});
  console.log(`STARTER_DONE run=${runId}`);
}

void main().catch((error) => { console.error(error); process.exit(1); });
