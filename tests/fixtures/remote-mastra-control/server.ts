import { createNodeServer } from "@mastra/deployer/server";
import { mastra } from "./index";

async function main() {
  const server = await createNodeServer(mastra, { tools: {}, studio: false, isDev: false });
  console.log(`SERVER_READY pid=${process.pid}`);
  const shutdown = async () => { server.close(); await mastra.shutdown(); process.exit(0); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void main().catch((error) => { console.error(error); process.exit(1); });
