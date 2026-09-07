// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => createElement("a", { href, ...props }, children),
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => createElement("span", { "data-testid": "arrow-left" }),
}));

vi.mock("./plan-dashboard.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

vi.mock("@/components/ui/status-chip.module.css", () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import { PlanDashboard } from "./plan-dashboard";
import type { PlanListRow } from "@/lib/plans/plan-types";

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function row(overrides: Partial<PlanListRow> = {}): PlanListRow {
  return {
    id: UUID(1),
    name: "Org A Campaign Shoot",
    entityType: "campaign",
    entityId: UUID(2),
    status: "active",
    plannedStart: "2026-09-01",
    plannedEnd: "2026-09-05",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    workflowName: "Campaign Workflow",
    ...overrides,
  };
}

function result(rows: PlanListRow[], hasMore: boolean) {
  return {
    ok: true as const,
    rows,
    nextCursor: hasMore ? rows[rows.length - 1]?.id ?? null : null,
    hasMore,
  };
}

afterEach(() => cleanup());

describe("PlanDashboard", () => {
  it("labels at-risk and due-today metrics as loaded-only when more pages exist", () => {
    const rows = [
      row({ id: UUID(1), status: "active", plannedEnd: "2026-09-01" }),
      row({ id: UUID(2), status: "planned", plannedEnd: "2026-09-05" }),
    ];
    render(
      <PlanDashboard result={result(rows, true)} todayIso="2026-09-07" />,
    );

    expect(screen.getByText("At risk")).toBeDefined();
    expect(screen.getByText("Due today")).toBeDefined();
    expect(
      screen.getAllByText(/Based on loaded plans — more pages exist\./),
    ).toHaveLength(2);
  });

  it("omits the loaded-only note when all plans are loaded", () => {
    const rows = [row({ id: UUID(1), status: "active", plannedEnd: "2026-09-01" })];
    render(
      <PlanDashboard result={result(rows, false)} todayIso="2026-09-07" />,
    );

    expect(
      screen.queryByText(/Based on loaded plans — more pages exist\./),
    ).toBeNull();
  });

  it("computes at-risk and due-today counts from the loaded rows", () => {
    const rows = [
      row({ id: UUID(1), status: "active", plannedEnd: "2026-09-01" }),
      row({ id: UUID(2), status: "planned", plannedEnd: "2026-09-07" }),
      row({ id: UUID(3), status: "completed", plannedEnd: "2026-08-01" }),
    ];
    render(
      <PlanDashboard result={result(rows, false)} todayIso="2026-09-07" />,
    );

    const values = screen.getAllByText(/^\d+$/).map((el) => el.textContent);
    expect(values).toContain("3"); // total plans
    expect(values).toContain("1"); // at risk (active, end passed)
    expect(values).toContain("1"); // due today (planned end today)
  });
});