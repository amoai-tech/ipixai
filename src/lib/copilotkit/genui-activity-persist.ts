import type { A2UIOperation } from "@copilotkit/shared";

import type { PlannerGenUIActivity } from "@/mastra/thread-persistence";
import { normalizePlannerGenUIActivity } from "@/mastra/thread-persistence";

// Keep the original exports stable for existing API routes and tests.
export { authorizePlannerGenUIScope, plannerRunScope, plannerScopeForOrg } from "./planner-genui-scope";

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
  | { kind: "delete" | "rejected"; surfaceId: string }
  | { kind: "update"; surfaceId: string; operations: A2UIOperation[] }
  | { kind: "activity"; activity: PlannerGenUIActivity };

/** Minimal parser for the runtime's AG-UI activity events. It ignores every
 *  non-surface event and every event for a target other than the Planner page
 *  surface; the accepted operations are still revalidated before persistence. */
export class GenUIActivityCollector {
  private buffer = "";
  private pendingCR = false;
  private readonly activities = new Map<string, ActivityContent>();
  private readonly surfaceByMessage = new Map<string, string>();
  private lastSurfaceId: string | null = null;
  private lastCreatedSurfaceId: string | null = null;
  private disabled = false;
  private runFinished = false;
  private runFailed = false;

  push(chunk: string): void {
    if (this.disabled) return;
    // Per HTML's SSE parser, CR, LF and CRLF each terminate one line.
    // Defer a trailing CR until the next chunk to avoid treating a split
    // CRLF pair as two lines (or an early blank-line event).
    if (this.pendingCR) {
      this.buffer += "\n";
      if (chunk.startsWith("\n")) chunk = chunk.slice(1);
      this.pendingCR = false;
    }
    if (chunk.endsWith("\r")) {
      this.pendingCR = true;
      chunk = chunk.slice(0, -1);
    }
    this.buffer += chunk.replace(/\r\n?|\n/g, "\n");
    // Process every complete SSE event before enforcing the cap. A single
    // transport chunk may contain many small, valid events; only an
    // incomplete event should count against the pending-buffer limit.
    let boundary = this.buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      this.handleBlock(block);
      boundary = this.buffer.indexOf("\n\n");
    }
    // An oversized/truncated individual event must not consume unbounded
    // memory. Log only the limit, never the private event contents.
    if (this.buffer.length > 256_000) {
      this.disabled = true;
      this.buffer = "";
      this.activities.clear();
      console.warn("planner.genui.buffer_exceeded", { limit: 256000 });
    }
  }

  finish(): FinalActivity {
    if (this.disabled) return { kind: "none" };
    if (this.pendingCR) this.push("");
    if (this.buffer.trim().length > 0) this.handleBlock(this.buffer);
    this.buffer = "";
    // A ready surface observed mid-stream is not durable evidence that the
    // entire model run succeeded. Aborted, disconnected or failed runs may
    // not update the saved comparison.
    if (!this.runFinished || this.runFailed) return { kind: "none" };
    // A new card wins over a later cleanup delete of an older card.
    const surfaceId = this.lastCreatedSurfaceId ?? this.lastSurfaceId;
    if (!surfaceId) return { kind: "none" };
    const content = this.activities.get(surfaceId);
    if (!content) return { kind: "none" };
    const operations = Array.isArray(content.operations) ? content.operations : [];
    if (!Array.isArray(content.rejected)) return { kind: "none" };
    if (content.rejected.length > 0) {
      return { kind: "rejected", surfaceId };
    }
    if (operations.some((op) => {
      const row = op && typeof op === "object" ? op as Record<string, unknown> : null;
      const deletion = row?.deleteSurface;
      return deletion && typeof deletion === "object" &&
        (deletion as { surfaceId?: unknown }).surfaceId === surfaceId;
    })) return { kind: "delete", surfaceId };
    if (content.status !== "ready") return { kind: "none" };
    const activity = normalizePlannerGenUIActivity({
      target: content.target,
      operations,
    });
    if (activity) return { kind: "activity", activity };
    // Existing surfaces produce DELTAs only: no new createSurface snapshot.
    // They may update only the same, already stored surface, validated again
    // by savePlannerGenUIActivity against the durable scope and surface id.
    if (operations.length > 0 && operations.every((operation) => {
      if (!operation || typeof operation !== "object") return false;
      const row = operation as unknown as Record<string, unknown>;
      const update = row.updateComponents ?? row.updateDataModel;
      return row.version === "1.0" && update &&
        typeof update === "object" &&
        (update as { surfaceId?: unknown }).surfaceId === surfaceId;
    })) return { kind: "update", surfaceId, operations: operations as A2UIOperation[] };
    return { kind: "none" };
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
    if (event.type === "RUN_ERROR") {
      this.runFailed = true;
      return;
    }
    if (event.type === "RUN_FINISHED") {
      this.runFinished = true;
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
      this.lastCreatedSurfaceId = surfaceId;
      return;
    }
    if (type !== "ACTIVITY_DELTA") return;
    const patch = event.patch;
    if (!Array.isArray(patch)) return;
    // The real middleware emits no snapshot for an update of an existing
    // surface. Its first /operations/- delta identifies the surface.
    let inferred: string | undefined;
    for (const entry of patch) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as { path?: unknown; value?: unknown };
      if (item.path !== "/operations/-" || !item.value ||
        typeof item.value !== "object") continue;
      const operation = item.value as Record<string, unknown>;
      const update = operation.updateComponents ?? operation.updateDataModel ??
        operation.deleteSurface;
      if (update && typeof update === "object" &&
        typeof (update as { surfaceId?: unknown }).surfaceId === "string") {
        inferred = (update as { surfaceId: string }).surfaceId;
        break;
      }
    }
    const messageId = typeof event.messageId === "string" ? event.messageId : "";
    const surfaceId = this.surfaceByMessage.get(messageId) ??
      (typeof event.surfaceId === "string" ? event.surfaceId : undefined) ??
      inferred;
    if (!surfaceId) return;
    let content = this.activities.get(surfaceId);
    if (!content) {
      content = {
        surfaceId,
        target: TARGET,
        operations: [],
        rejected: [],
        status: "streaming",
      };
      this.activities.set(surfaceId, content);
    }
    if (messageId) this.surfaceByMessage.set(messageId, surfaceId);
    this.lastSurfaceId = surfaceId;
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
    save: (change: Exclude<FinalActivity, { kind: "none" }>) => Promise<void>;
  },
): Response {
  if (!response.body) return response;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const collector = new GenUIActivityCollector();
  let finished = false;
  let cancelled = false;
  let pending = "";
  let terminal: string | null = null;

  // Keep RUN_FINISHED until the durable save has completed. AG-UI rejects
  // events appended after a terminal event, so failed persistence must use a
  // RUN_ERROR *instead* of letting the UI believe the run was fully saved.
  const isRunFinished = (block: string): boolean => {
    const data = block.split(/\r?\n|\r/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return false;
    try {
      const event: unknown = JSON.parse(data);
      return !!event && typeof event === "object" &&
        (event as { type?: unknown }).type === "RUN_FINISHED";
    } catch {
      return false;
    }
  };

  // Find SSE blank-line delimiters. CRLF is a single newline, even when
  // the CR and LF arrive in separate network chunks. A backtracking regex
  // can incorrectly treat CRLF as two blank lines and release RUN_FINISHED
  // before the save has completed.
  const eventBoundary = (text: string, atEnd: boolean): number | null => {
    let lineStart = 0;
    for (let i = 0; i < text.length;) {
      const char = text[i];
      if (char !== "\r" && char !== "\n") {
        i += 1;
        continue;
      }
      if (char === "\r" && i + 1 === text.length && !atEnd) return null;
      const after = char === "\r" && text[i + 1] === "\n" ? i + 2 : i + 1;
      if (i === lineStart) return after;
      lineStart = after;
      i = after;
    }
    return null;
  };

  const flushBlocks = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    atEnd = false,
  ): boolean => {
    let delivered = false;
    let boundary = eventBoundary(pending, atEnd);
    while (boundary !== null) {
      const block = pending.slice(0, boundary);
      pending = pending.slice(boundary);
      if (isRunFinished(block)) terminal = block;
      else {
        controller.enqueue(encoder.encode(block));
        delivered = true;
      }
      boundary = eventBoundary(pending, atEnd);
    }
    // The collector already bounds incomplete event data. Prevent this
    // transport parser from adding an independent unbounded memory buffer.
    if (pending.length > 256_000) {
      controller.enqueue(encoder.encode(pending));
      pending = "";
      delivered = true;
    }
    return delivered;
  };

  const finish = async (): Promise<boolean> => {
    if (cancelled || finished) return false;
    finished = true;
    const final = collector.finish();
    if (final.kind === "none") return false;
    try {
      await options.save(final);
      return false;
    } catch {
      // No model output, prompts, tenant ID or internal DB error in logs.
      console.error("planner.genui.capture_failed");
      return true;
    }
  };

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        // A ReadableStream pull without enqueue is not guaranteed to run again.
        // Keep reading until at least one event can be forwarded or the
        // upstream stream ends; otherwise split SSE chunks can deadlock.
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (cancelled) return;
          if (done) {
            const tail = decoder.decode();
            collector.push(tail);
            pending += tail;
            flushBlocks(controller, true);
            if (pending) controller.enqueue(encoder.encode(pending));
            pending = "";
            const saveFailed = await finish();
            if (saveFailed && !cancelled) {
              controller.enqueue(encoder.encode(
                'data: {"type":"RUN_ERROR","code":"GENUI_PERSIST_FAILED","message":"The AI comparison could not be saved."}\n\n',
              ));
            } else if (terminal) {
              controller.enqueue(encoder.encode(terminal));
            }
            controller.close();
            return;
          }
          const chunk = decoder.decode(value, { stream: true });
          collector.push(chunk);
          pending += chunk;
          if (flushBlocks(controller)) return;
        }
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      cancelled = true;
      await reader.cancel(reason).catch(() => undefined);
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
