import type { A2UIOperation } from "@copilotkit/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTrustedBrandIds } from "@/lib/dashboard/command-center";
import { preauthorizeShootForOrg } from "@/lib/shoot/get-shoot-detail";

import type { PlannerGenUIActivity } from "@/mastra/thread-persistence";
import { normalizePlannerGenUIActivity } from "@/mastra/thread-persistence";

const ACTIVITY_TYPE = "generative-ui-surface";
const TARGET = "planner-comparison";

const SCOPE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The browser supplies a scope locator, never an authorization decision.
 * Its organization component must match the server-verified tenant. */
export function plannerScopeForOrg(value: unknown, trustedOrgId: string): string | null {
  if (value === "workspace") return "workspace";
  if (typeof value !== "string") return null;
  const match = /^(brand|shoot):([^:]+):([^:]+)$/.exec(value);
  if (!match || match[2] !== trustedOrgId || !SCOPE_UUID.test(match[3]!)) return null;
  return value;
}

/** Validate the browser-provided scope locator against real, authorized
 * Supabase rows before writing or returning a persisted GenUI card. A matching
 * org id in a string is NOT proof that a Brand/Shoot belongs to that org.
 * This is an additional scoped resource check, not a replacement for the
 * request's verified operator/organization and thread-owner checks. */
export async function authorizePlannerGenUIScope(
  client: SupabaseClient,
  rawScope: unknown,
  trustedOrgId: string,
): Promise<boolean> {
  const scope = plannerScopeForOrg(rawScope, trustedOrgId);
  if (!scope) return false;
  if (scope === "workspace") return true;
  const [kind, , resourceId] = scope.split(":");
  if (!resourceId) return false;
  try {
    if (kind === "brand") {
      const { data, error } = await client
        .from("brands")
        .select("id")
        .eq("id", resourceId)
        .eq("org_id", trustedOrgId)
        .maybeSingle();
      return !error && data?.id === resourceId;
    }
    if (kind === "shoot") {
      const scopedBrands = await loadTrustedBrandIds(client, trustedOrgId);
      if (!scopedBrands.ok) return false;
      const preauth = await preauthorizeShootForOrg(client, resourceId, scopedBrands.brandIds);
      return preauth.ok;
    }
    return false;
  } catch {
    return false;
  }
}

export function plannerRunScope(
  input: unknown,
  trustedOrgId: string,
): string | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const context = (input as { context?: unknown }).context;
  if (!Array.isArray(context)) return null;
  for (const row of context) {
    if (!row || typeof row !== "object") continue;
    let value = (row as { value?: unknown }).value;
    if (typeof value === "string") {
      try { value = JSON.parse(value); } catch { continue; }
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    if (!Object.prototype.hasOwnProperty.call(value, "scopeKey")) continue;
    // Malformed or foreign-tenant scope fails closed, even if other contexts
    // would happen to contain a usable scope later in the array.
    return plannerScopeForOrg((value as { scopeKey?: unknown }).scopeKey, trustedOrgId);
  }
  return null;
}



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
    // A huge/truncated SSE event cannot consume unbounded Vercel memory.
    if (this.buffer.length > 256_000) {
      this.disabled = true;
      this.buffer = "";
      this.activities.clear();
      // Emit one diagnostic without leaking tenant prompts or event bytes.
      console.warn("planner.genui.buffer_exceeded", { limit: 256000 });
      return;
    }
    let boundary = this.buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      this.handleBlock(block);
      boundary = this.buffer.indexOf("\n\n");
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
  const collector = new GenUIActivityCollector();
  let finished = false;
  let cancelled = false;

  const finish = async () => {
    if (cancelled || finished) return;
    finished = true;
    collector.push(decoder.decode());
    const final = collector.finish();
    if (final.kind === "none") return;
    try {
      await options.save(final);
    } catch {
      // Storage failures must not disclose thread ids, generated prompts,
      // operation payloads or tenant data in logs.
      console.error("planner.genui.capture_failed");
    }
  };

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        // reader.read() may resolve to done:true because cancel() closed the
        // upstream stream, not because the model completed successfully.
        if (cancelled) return;
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
