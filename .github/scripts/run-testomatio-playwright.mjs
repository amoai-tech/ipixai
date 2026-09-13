import { spawn } from "node:child_process";

const args = ["playwright", "test"];
const grep = process.env.GREP;
if (grep) args.push("--grep", grep);

const child = spawn("npx", args, {
  stdio: "inherit",
  shell: false,
  env: process.env,
});

child.on("error", (error) => {
  console.error("Failed to start Playwright:", error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
