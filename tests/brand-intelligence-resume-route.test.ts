import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The route reads `mastra.getWorkflow(...)`; only auth/body-limit behavior is
// under test here, so give it an inert workflow that always succeeds.
const mocks = vi.hoisted(() => ({
  resume: vi.fn(),
  createRun: vi.fn(),
  getWorkflow: vi.fn(),
}));
const { resume, createRun, getWorkflow } = mocks;

vi.mock("@/mastra", () => ({
  mastra: { getWorkflow: mocks.getWorkflow },
}));

import { POST } from "@/app/api/workflows/brand-intelligence/resume/route";

const SECRET = "test-internal-webhook-secret";
const MAX_BODY_BYTES = 1_048_576;

function requestWithBody(body: string, opts: { auth?: boolean; contentLength?: number } = {}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (opts.auth !== false) headers.set("x-internal-secret", SECRET);
  if (opts.contentLength !== undefined) headers.set("content-length", String(opts.contentLength));
  return new Request("http://localhost/api/workflows/brand-intelligence/resume", {
    method: "POST",
    headers,
    body,
  });
}

// A body of exactly `size` valid-UTF8 bytes wrapped in a JSON string field,
// streamed with no Content-Length header (so the byte-count-while-reading
// path, not the fast Content-Length rejection, is what's under test).
function streamedJsonOfSize(size: number, payload: Record<string, unknown> = { runId: "run-1" }) {
  const skeleton = JSON.stringify({ ...payload, pad: "" });
  const padLen = Math.max(0, size - skeleton.length); // skeleton's pad:"" already has the quotes; only the inner chars grow
  const body = JSON.stringify({ ...payload, pad: "x".repeat(padLen) });
  const bytes = new TextEncoder().encode(body);
  let pullCount = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pullCount++;
      // Feed in 64KiB chunks so a mid-stream cancel is actually observable.
      const CHUNK = 65_536;
      const offset = (pullCount - 1) * CHUNK;
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.subarray(offset, Math.min(offset + CHUNK, bytes.length)));
    },
  });
  const req = new Request("http://localhost/api/workflows/brand-intelligence/resume", {
    method: "POST",
    headers: { "x-internal-secret": SECRET, "content-type": "application/json" },
    body: stream,
    // @ts-expect-error -- Node's fetch Request requires this for streaming bodies
    duplex: "half",
  });
  return { req, bytesTotal: bytes.length, getPullCount: () => pullCount };
}

beforeEach(() => {
  process.env.INTERNAL_WEBHOOK_SECRET = SECRET;
  vi.clearAllMocks();
  resume.mockResolvedValue({ status: "success" });
  createRun.mockResolvedValue({ resume });
  getWorkflow.mockReturnValue({ createRun });
});

afterEach(() => {
  delete process.env.INTERNAL_WEBHOOK_SECRET;
});

describe("brand-intelligence resume route — body size limit", () => {
  it("accepts a body at exactly the limit (Content-Length fast path)", async () => {
    const skeleton = JSON.stringify({ runId: "run-1", pad: "" });
    const padLen = MAX_BODY_BYTES - skeleton.length;
    const body = JSON.stringify({ runId: "run-1", pad: "x".repeat(padLen) });
    expect(Buffer.byteLength(body, "utf8")).toBe(MAX_BODY_BYTES);

    const res = await POST(requestWithBody(body, { contentLength: Buffer.byteLength(body, "utf8") }));

    expect(res.status).toBe(200);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("rejects a body one byte over the limit via the Content-Length fast path", async () => {
    const body = "x".repeat(MAX_BODY_BYTES + 1);
    const res = await POST(requestWithBody(body, { contentLength: MAX_BODY_BYTES + 1 }));

    expect(res.status).toBe(413);
    expect(getWorkflow).not.toHaveBeenCalled();
  });

  it("rejects an oversized body with no/absent Content-Length without buffering the whole thing", async () => {
    const { req, bytesTotal, getPullCount } = streamedJsonOfSize(MAX_BODY_BYTES + 200_000);
    expect(bytesTotal).toBeGreaterThan(MAX_BODY_BYTES);

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body).toMatchObject({ ok: false, error: { code: "payload_too_large" } });
    // Cancelled well before the full ~1.2MB stream was consumed (64KiB
    // chunks => ~19 total; bailing out at the limit means far fewer pulls).
    expect(getPullCount()).toBeLessThan(Math.ceil(bytesTotal / 65_536));
    expect(getWorkflow).not.toHaveBeenCalled();
  });

  it("rejects unauthorized requests before reading the body at all", async () => {
    const req = new Request("http://localhost/api/workflows/brand-intelligence/resume", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: "run-1" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    // Spec-guaranteed: bodyUsed only flips once something has actually
    // consumed the stream (getReader/text/json/...). If the route read the
    // body before the auth check, this would be true.
    expect(req.bodyUsed).toBe(false);
    expect(getWorkflow).not.toHaveBeenCalled();
  });
});
