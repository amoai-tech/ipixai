"use client";

import { useState, type ReactNode } from "react";

import styles from "../shoot-detail.module.css";

export type TabDef = {
  key: string;
  label: string;
  content: ReactNode;
};

/**
 * IPI-1067 · SHOOT-001 — client tab shell for the shoot detail lifecycle
 * IA. Server-rendered tab content is passed in as children (the idiomatic
 * App Router pattern: interactivity here, data rendering stays server-
 * side). Accessible: role=tablist / tab / tabpanel + aria-selected.
 */
export function ShootDetailTabs({ tabs }: { tabs: TabDef[] }) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key ?? "");
  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];

  return (
    <div className={styles.tabs} data-testid="shoot-detail-tabs">
      <div role="tablist" aria-label="Shoot record sections" className={styles.tabList}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`shoot-tab-${tab.key}`}
            aria-selected={active?.key === tab.key}
            aria-controls={`shoot-panel-${tab.key}`}
            className={`${styles.tabButton} ${active?.key === tab.key ? styles.tabActive : ""}`}
            onClick={() => setActiveKey(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`shoot-panel-${tab.key}`}
          aria-labelledby={`shoot-tab-${tab.key}`}
          hidden={active?.key !== tab.key}
          className={`${styles.tabPanel} ${active?.key === tab.key ? "" : styles.tabPanelHidden}`}
          data-testid={`shoot-tab-panel-${tab.key}`}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}