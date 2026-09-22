import { once } from "node:events";
import { createNodeServer } from "@mastra/deployer/server";
import { mastra } from "./index";

async function main() {
  const server = await createNodeServer(mastra, { tools: {}, studio: false, isDev: false });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture server has no TCP address");
  console.log(`SERVER_READY pid=${process.pid} port=${address.port}`);

  const shutdown = async () => {
    server.close();
    await mastra.shutdown();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void main().catch((error) => { console.error(error); process.exit(1); });
