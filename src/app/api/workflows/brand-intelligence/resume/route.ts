import { createHash, timingSafeEqual } from "node:crypto";

import { mastra } from "@/mastra";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 1_048_576;

function verifyInternalSecret(header: string | null, expected: string | undefined): boolean {
  if (!header || !expected) return false;
  // Hash both sides to a fixed-length digest before comparing, rather than
  // branching on Buffer.length first. Comparing raw lengths before calling
  // timingSafeEqual leaks the secret's length through response-time
  // variance; hashing first means every comparison is on equal-length
  // (32-byte) buffers regardless of the header's length, so there's no
  // length-dependent branch at all.
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  // Auth is a static shared secret compared against the header only — it
  // needs no request body, so check it before reading/buffering the body.
  // Otherwise an unauthenticated caller could force full-body buffering
  // (up to MAX_BODY_BYTES) on every request before ever being rejected.
  const signature = request.headers.get("x-internal-secret");
  if (!verifyInternalSecret(signature, process.env.INTERNAL_WEBHOOK_SECRET)) {
    return Response.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: { code: "payload_too_large" } }, { status: 413 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: { code: "payload_too_large" } }, { status: 413 });
  }

  let body: { runId?: string; crawlId?: string; failed?: boolean; error?: string };
  try {
    body = JSON.parse(rawBody) as { runId?: string; crawlId?: string; failed?: boolean; error?: string };
  } catch {
    return Response.json({ ok: true, outcome: "noop_invalid_json" }, { status: 200 });
  }

  if (!body.runId || typeof body.runId !== "string") {
    return Response.json({ ok: false, error: { code: "invalid_input", message: "runId is required" } }, { status: 400 });
  }

  try {
    const workflow = mastra.getWorkflow("brand-intelligence");
    const run = await workflow.createRun({ runId: body.runId });
    const result = await run.resume({
      resumeData: {
        crawlId: body.crawlId,
        failed: body.failed === true,
        error: body.error,
      },
      step: "waitForCrawl",
    });
    return Response.json({ ok: true, status: result.status }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return Response.json(
      { ok: false, error: { code: "resume_failed", message } },
      { status: 503 },
    );
  }
}