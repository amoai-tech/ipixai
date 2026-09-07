"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";

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
 * side). Accessible: role=tablist / tab / tabpanel + aria-selected,
 * roving tabIndex (only the active tab is tabbable), and the WAI-ARIA
 * tab keyboard pattern (ArrowLeft/ArrowRight/Home/End).
 */
export function ShootDetailTabs({ tabs }: { tabs: TabDef[] }) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key ?? "");
  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];

  function activate(key: string) {
    setActiveKey(key);
    document.getElementById(`shoot-tab-${key}`)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (tabs.length === 0) return;
    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    activate(tabs[nextIndex].key);
  }

  return (
    <div className={styles.tabs} data-testid="shoot-detail-tabs">
      <div role="tablist" aria-label="Shoot record sections" className={styles.tabList}>
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`shoot-tab-${tab.key}`}
            aria-selected={active?.key === tab.key}
            aria-controls={`shoot-panel-${tab.key}`}
            tabIndex={active?.key === tab.key ? 0 : -1}
            className={`${styles.tabButton} ${active?.key === tab.key ? styles.tabActive : ""}`}
            onClick={() => setActiveKey(tab.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
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