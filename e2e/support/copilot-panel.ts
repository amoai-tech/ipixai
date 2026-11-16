import { expect, type Page } from "@playwright/test";

const NAV_TIMEOUT_MS = 30_000;

/**
 * Desktop mounts `operator-chat-dock` with `data-open="true"` immediately;
 * anything at or below the panel-compact breakpoint mounts the same way and
 * then closes itself a render or two later, once `useMatchMedia()`'s
 * COPILOT_COMPACT check settles (see operator-panel.tsx's isCopilotCompact
 * auto-close effect — 1023px, wider than the nav's own 767px mobile
 * breakpoint, since a permanent 400-520px column plus the nav crushes the
 * workspace well before true mobile). A single `getAttribute()` read right
 * after `page.goto()`/`page.reload()` can land in that gap and observe the
 * still-true initial value before it flips — this then skips the click and
 * the panel stays closed for the rest of the test. Wait for the real
 * settled state at or below that width (kept in sync with
 * operator-panel.tsx's COPILOT_COMPACT, same duplication that file already
 * carries against its own CSS module) before deciding.
 */
export async function ensureCopilotOpen(page: Page) {
  const dock = page.getByTestId("operator-chat-dock");
  const isCompactViewport = (page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) <= 1023;
  // IPI-1451: /app docks the composer at the bottom and keeps it open on
  // compact screens; only other routes auto-close to a sheet.
  const isDashboard = new URL(page.url()).pathname === "/app";
  if (isCompactViewport && !isDashboard) {
    await expect(dock).toHaveAttribute("data-open", "false", { timeout: NAV_TIMEOUT_MS });
  }
  if ((await dock.getAttribute("data-open")) !== "true") {
    await page.getByRole("button", { name: "✦ Open Copilot" }).click();
    await expect(dock).toHaveAttribute("data-open", "true", { timeout: NAV_TIMEOUT_MS });
  }
  return dock;
}
