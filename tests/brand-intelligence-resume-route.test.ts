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

describe("brand-intelligence resume route — IPI-1093 blocker #5 Phase B (wrong secret, wrong step, duplicate resume)", () => {
  it("rejects a present but WRONG secret — distinct from the no-header case, exercises the timingSafeEqual compare branch", async () => {
    const req = new Request("http://localhost/api/workflows/brand-intelligence/resume", {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": "not-the-real-secret" },
      body: JSON.stringify({ runId: "run-1" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(getWorkflow).not.toHaveBeenCalled();
  });

  it("rejects a missing runId with 400 before ever touching the workflow", async () => {
    const res = await POST(requestWithBody(JSON.stringify({ crawlId: "crawl-1" })));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(getWorkflow).not.toHaveBeenCalled();
  });

  it("PR review finding: a JSON literal null body must not crash with an uncaught TypeError on body.runId — clean 400, not 500", async () => {
    const res = await POST(requestWithBody("null"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(getWorkflow).not.toHaveBeenCalled();
  });

  it("PR review finding: a bare JSON array/number body is also rejected with 400, not treated as an object", async () => {
    for (const literal of ["[1,2,3]", "42", '"just a string"']) {
      const res = await POST(requestWithBody(literal));
      expect(res.status).toBe(400);
    }
    expect(getWorkflow).not.toHaveBeenCalled();
  });

  it("treats unparseable JSON as a clean 200 no-op, not a 500 — matches firecrawl-webhook's own tolerant-body contract", async () => {
    const res = await POST(requestWithBody("{not json"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, outcome: "noop_invalid_json" });
    expect(getWorkflow).not.toHaveBeenCalled();
  });

  it("'wrong step': resume() rejecting because the run is suspended at a different step surfaces as a clean 503, not an unhandled throw", async () => {
    resume.mockRejectedValueOnce(
      new Error('Step "waitForCrawl" is not the currently suspended step'),
    );

    const res = await POST(requestWithBody(JSON.stringify({ runId: "run-1", crawlId: "crawl-1" })));

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: false,
      error: { code: "resume_failed", message: expect.stringContaining("not the currently suspended step") },
    });
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("duplicate resume: a second call for an already-resumed run gets Mastra's real rejection message, mapped to a clean 503 with no duplicate side effect implied by a 200", async () => {
    // This is the exact message the real Mastra framework throws — proven
    // directly against a live suspend/resume/duplicate-resume cycle in the
    // blocker #5 restart/resume proof (three separate processes, real
    // PostgresStore) — not guessed here.
    resume.mockRejectedValueOnce(new Error("This workflow run was not suspended"));

    const res = await POST(requestWithBody(JSON.stringify({ runId: "run-1", crawlId: "crawl-1" })));

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: false,
      error: { code: "resume_failed", message: "This workflow run was not suspended" },
    });
    // The route itself is a thin pass-through — it calls resume exactly
    // once per request and reports whatever Mastra's own dedup decided,
    // rather than retrying or swallowing the rejection into a fake success.
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("passes the caller's failure signal straight through to resumeData on a genuine crawl failure", async () => {
    const res = await POST(
      requestWithBody(JSON.stringify({ runId: "run-1", failed: true, error: "Firecrawl reported crawl failure" })),
    );

    expect(res.status).toBe(200);
    expect(resume).toHaveBeenCalledWith({
      resumeData: { crawlId: undefined, failed: true, error: "Firecrawl reported crawl failure" },
      step: "waitForCrawl",
    });
  });
});
