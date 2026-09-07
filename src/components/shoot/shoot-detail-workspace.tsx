import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StatusChip } from "@/components/ui/status-chip";
import type { ShootDetail } from "@/lib/shoot/get-shoot-detail";
import { shootStatusDotToken, shootStatusLabel } from "@/lib/shoot/shoot-list-filters";

import { ActivityTab } from "./shoot-detail-tabs/activity-tab";
import { ApprovalsTab } from "./shoot-detail-tabs/approvals-tab";
import { AssetsTab } from "./shoot-detail-tabs/assets-tab";
import { BudgetTab } from "./shoot-detail-tabs/budget-tab";
import { DeliverablesTab } from "./shoot-detail-tabs/deliverables-tab";
import { OverviewTab } from "./shoot-detail-tabs/overview-tab";
import { ScheduleTab } from "./shoot-detail-tabs/schedule-tab";
import { ShotsTab } from "./shoot-detail-tabs/shots-tab";
import { ShootDetailTabs } from "./shoot-detail-tabs/tabs-shell";
import { TeamTab } from "./shoot-detail-tabs/team-tab";
import styles from "./shoot-detail.module.css";

/**
 * IPI-1067 · SHOOT-001 — display-only shoot record shell. COPY+CLEAN of
 * Lumina's ShootDetailWorkspace: lifecycle tab IA kept, everything
 * interactive dropped (no wizard, no HITL, no booking, no AI runtime).
 *
 * A zero-shot shoot still renders this normal shell — every tab degrades
 * to its own honest empty state. The header meta is real payload data
 * only; no fake or disabled controls anywhere.
 */
export function ShootDetailWorkspace({ detail }: { detail: ShootDetail }) {
  const { shoot, brand } = detail;
  const tabs = [
    { key: "overview", label: "Overview", content: <OverviewTab detail={detail} /> },
    { key: "shots", label: "Shots", content: <ShotsTab detail={detail} /> },
    { key: "assets", label: "Assets", content: <AssetsTab detail={detail} /> },
    { key: "team", label: "Team", content: <TeamTab detail={detail} /> },
    { key: "schedule", label: "Schedule", content: <ScheduleTab detail={detail} /> },
    { key: "budget", label: "Budget", content: <BudgetTab detail={detail} /> },
    {
      key: "deliverables",
      label: "Deliverables",
      content: <DeliverablesTab detail={detail} />,
    },
    { key: "approvals", label: "Approvals", content: <ApprovalsTab detail={detail} /> },
    { key: "activity", label: "Activity", content: <ActivityTab detail={detail} /> },
  ];

  return (
    <div className={styles.root} data-testid="shoot-detail-workspace">
      <Link href="/app/shoots" className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden />
        Shoots
      </Link>

      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.heading}>{shoot.name}</h1>
          <StatusChip dot={shootStatusDotToken(shoot.status)} label={shootStatusLabel(shoot.status)} />
        </div>
        <p className={styles.subheading}>{brand.name}</p>
      </header>

      <ShootDetailTabs tabs={tabs} />
    </div>
  );
}