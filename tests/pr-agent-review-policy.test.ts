import { describe, expect, it } from "vitest";
import {
  appendCertification,
  hasCertificationForBase,
  selectReviewCommand,
  verifyReviewResult,
} from "../scripts/pr-agent/review-policy.mjs";

const BASE_A = "a".repeat(40);
const BASE_B = "b".repeat(40);
const HEAD_A = "c".repeat(40);
const RUN_STARTED = Date.parse("2026-09-20T01:00:00Z");

function comment(body: string, updatedAt: string, login = "github-actions[bot]") {
  return { body, updated_at: updatedAt, user: { login } };
}

describe("IPI-1246 PR-Agent review policy", () => {
  it("uses incremental review only for a previously certified identical base", () => {
    const history = appendCertification("", { baseSha: BASE_A, headSha: HEAD_A });
    expect(selectReviewCommand({ action: "synchronize", certificationBodies: [history], baseSha: BASE_A })).toBe("/review -i");
    expect(selectReviewCommand({ action: "synchronize", certificationBodies: [history], baseSha: BASE_B })).toBe("/review");
    expect(selectReviewCommand({ action: "opened", certificationBodies: [history], baseSha: BASE_A })).toBe("/review");
  });

  it("accepts fresh canonical full and incremental reviews", () => {
    expect(verifyReviewResult({ comments: [comment("<!-- pr-agent:review:full -->", "2026-09-20T01:00:05Z")], startedAt: RUN_STARTED, reviewCommand: "/review", baseSha: BASE_A }).ok).toBe(true);
    expect(verifyReviewResult({ comments: [comment("<!-- pr-agent:review:incremental -->", "2026-09-20T01:00:05Z")], startedAt: RUN_STARTED, reviewCommand: "/review -i", baseSha: BASE_A }).ok).toBe(true);
  });

  it("accepts the iPix standalone fallback review", () => {
    const body = "## Standalone PR Review\nPR-Agent could not safely update the persistent review\n## iPix PR Review";
    expect(verifyReviewResult({ comments: [comment(body, "2026-09-20T01:00:05Z")], startedAt: RUN_STARTED, reviewCommand: "/review", baseSha: BASE_A }).ok).toBe(true);
  });

  it("accepts plain and linked incremental skip notices only for a certified same base", () => {
    const history = appendCertification("", { baseSha: BASE_A, headSha: HEAD_A });
    for (const skip of [
      "Incremental Review Skipped\nNo files were changed since the previous PR Review",
      "Incremental Review Skipped\nNo files were changed since the [previous PR Review](https://github.com/amoai-tech/ipixai/pull/1#issuecomment-1)",
    ]) {
      expect(verifyReviewResult({ comments: [comment(history, "2026-09-20T00:50:00Z"), comment(skip, "2026-09-20T01:00:05Z")], startedAt: RUN_STARTED, reviewCommand: "/review -i", baseSha: BASE_A }).ok).toBe(true);
      expect(verifyReviewResult({ comments: [comment(history, "2026-09-20T00:50:00Z"), comment(skip, "2026-09-20T01:00:05Z")], startedAt: RUN_STARTED, reviewCommand: "/review -i", baseSha: BASE_B }).ok).toBe(false);
    }
  });

  it("rejects stale, spoofed, absent, or wrong-marker results", () => {
    const cases = [
      [comment("<!-- pr-agent:review:full -->", "2026-09-20T00:59:59Z")],
      [comment("<!-- pr-agent:review:full -->", "2026-09-20T01:00:05Z", "someone-else")],
      [comment("<!-- pr-agent:review:incremental -->", "2026-09-20T01:00:05Z")],
      [],
    ];
    for (const comments of cases) {
      expect(verifyReviewResult({ comments, startedAt: RUN_STARTED, reviewCommand: "/review", baseSha: BASE_A }).ok).toBe(false);
    }
  });

  it("keeps certification history for multiple bases", () => {
    let history = appendCertification("", { baseSha: BASE_A, headSha: HEAD_A });
    history = appendCertification(history, { baseSha: BASE_B, headSha: "d".repeat(40) });
    expect(hasCertificationForBase(history, BASE_A)).toBe(true);
    expect(hasCertificationForBase(history, BASE_B)).toBe(true);
  });
});
