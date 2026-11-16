import type { A2UIOperation } from "@copilotkit/shared";

import type { PlannerGenUIActivity } from "@/mastra/thread-persistence";
import { normalizePlannerGenUIActivity } from "@/mastra/thread-persistence";

const ACTIVITY_TYPE = "generative-ui-surface";
const TARGET = "planner-comparison";

type ActivityContent = {
  surfaceId?: unknown;
  target?: unknown;
  catalogId?: unknown;
  operations?: unknown;
  status?: unknown;
  rejected?: unknown;
};

type FinalActivity =
  | { kind: "none" }
  | { kind: "delete" }
  | { kind: "activity"; activity: PlannerGenUIActivity };

/** Minimal parser for the runtime's AG-UI activity events. It ignores every
 *  non-surface event and every event for a target other than the Planner page
 *  surface; the accepted operations are still revalidated before persistence. */
export class GenUIActivityCollector {
  private buffer = "";
  private readonly activities = new Map<string, ActivityContent>();
  private readonly surfaceByMessage = new Map<string, string>();
  private lastSurfaceId: string | null = null;

  push(chunk: string): void {
    this.buffer += chunk;
    let boundary = this.buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      this.handleBlock(block);
      boundary = this.buffer.indexOf("\n\n");
    }
  }

  finish(): FinalActivity {
    if (this.buffer.trim().length > 0) this.handleBlock(this.buffer);
    this.buffer = "";
    if (!this.lastSurfaceId) return { kind: "none" };
    const content = this.activities.get(this.lastSurfaceId);
    if (!content) return { kind: "none" };
    const operations = Array.isArray(content.operations) ? content.operations : [];
    if (operations.some((op) => op && typeof op === "object" && "deleteSurface" in op)) {
      return { kind: "delete" };
    }
    if (content.status !== "ready") return { kind: "none" };
    if (!Array.isArray(content.rejected) || content.rejected.length > 0) return { kind: "none" };
    if (!Array.isArray(operations)) return { kind: "none" };
    const activity = normalizePlannerGenUIActivity({
      target: content.target,
      operations,
    });
    return activity ? { kind: "activity", activity } : { kind: "none" };
  }

  private handleBlock(block: string): void {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }
    if (event.activityType !== ACTIVITY_TYPE) return;
    const type = event.type;
    if (type === "ACTIVITY_SNAPSHOT") {
      const content = event.content;
      if (!content || typeof content !== "object" || Array.isArray(content)) return;
      const row = content as ActivityContent;
      if (row.target !== TARGET) return;
      const surfaceId = typeof row.surfaceId === "string" ? row.surfaceId : "";
      if (!surfaceId) return;
      this.activities.set(surfaceId, structuredClone(row));
      this.surfaceByMessage.set(
        typeof event.messageId === "string" ? event.messageId : surfaceId,
        surfaceId,
      );
      this.lastSurfaceId = surfaceId;
      return;
    }
    if (type !== "ACTIVITY_DELTA") return;
    const surfaceId = typeof event.surfaceId === "string"
      ? event.surfaceId
      : typeof event.messageId === "string"
        ? this.surfaceByMessage.get(event.messageId)
        : this.lastSurfaceId;
    if (!surfaceId) return;
    const content = this.activities.get(surfaceId);
    if (!content) return;
    const patch = event.patch;
    if (!Array.isArray(patch)) return;
    for (const entry of patch) {
      if (!entry || typeof entry !== "object") continue;
      const op = entry as Record<string, unknown>;
      const path = op.path;
      if (path === "/status") content.status = op.value;
      else if (path === "/rejected") content.rejected = op.value;
      else if (path === "/rejected/-") {
        if (!Array.isArray(content.rejected)) content.rejected = [];
        (content.rejected as unknown[]).push(op.value);
      } else if (path === "/operations/-") {
        if (!Array.isArray(content.operations)) content.operations = [];
        (content.operations as unknown[]).push(op.value);
      }
    }
  }
}

/** Keep the SSE bytes untouched while collecting the final accepted Planner
 *  activity. Persistence happens only after a complete, ready event, so an
 *  aborted or failed turn cannot overwrite the last good card. */
export function capturePlannerGenUIStream(
  response: Response,
  options: {
    threadId: string;
    save: (activity: PlannerGenUIActivity | null) => Promise<void>;
  },
): Response {
  if (!response.body) return response;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const collector = new GenUIActivityCollector();
  let finished = false;

  const finish = async () => {
    if (finished) return;
    finished = true;
    collector.push(decoder.decode());
    const final = collector.finish();
    if (final.kind === "none") return;
    try {
      await options.save(final.kind === "delete" ? null : final.activity);
    } catch (error) {
      console.error("planner.genui.capture failed", {
        threadId: options.threadId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          await finish();
          controller.close();
          return;
        }
        collector.push(decoder.decode(value, { stream: true }));
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => undefined);
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
