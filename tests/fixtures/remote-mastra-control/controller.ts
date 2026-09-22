import { MastraClient } from "@mastra/client-js";

async function main() {
  const mode = process.argv[2]!;
  const baseUrl = process.argv[3];
  if (!baseUrl) throw new Error("Fixture base URL is required");
  const token = mode === "org-b" ? "org-b-token" : "org-a-token";
  const resourceId = mode === "org-b" ? "org:b::user:u" : "org:a::user:u";
  const client = new MastraClient({ baseUrl, headers: { Authorization: `Bearer ${token}` } });
  const agent = client.getAgent("default");
  const post = async (path: string, body: object) => {
    const r = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    return r.json() as Promise<any>;
  };
  if (mode === "org-b") {
    const active = await post("/ipix/run-control/active", { threadId: "thread-1" });
    console.log(`B_ORG_B_ACTIVE run=${active.runId}`);
    const aborted = await post("/ipix/run-control/abort", { threadId: "thread-1", runId: "R1" });
    console.log(`B_ORG_B_ABORT aborted=${aborted.aborted}`);
    return;
  }
  const subscription = await agent.subscribeToThread({ resourceId, threadId: "thread-1" });
  console.log(`CONTROLLER_READY mode=${mode} pid=${process.pid}`);
  let ticks = 0;
  let acted = false;
  await subscription.processDataStream({ onChunk: async (chunk: any) => {
    if (chunk?.type !== "text-delta") return;
    ticks += 1;
    console.log(`B_TICK mode=${mode} n=${ticks} text=${chunk.payload?.text ?? ""}`);
    if (acted) return;
    acted = true;
    if (mode === "stop-r1") {
      const active = await post("/ipix/run-control/active", { threadId: "thread-1" });
      console.log(`B_ACTIVE run=${active.runId}`);
      const result = await post("/ipix/run-control/abort", { threadId: "thread-1", runId: "R1" });
      console.log(`B_ABORT_R1 aborted=${result.aborted}`);
    } else if (mode === "stale-r1") {
      const result = await post("/ipix/run-control/abort", { threadId: "thread-1", runId: "R1" });
      console.log(`B_STALE_R1 aborted=${result.aborted}`);
    }
  }});
  console.log(`CONTROLLER_DONE mode=${mode} ticks=${ticks}`);
}

void main().catch((error) => { console.error(error); process.exit(1); });
