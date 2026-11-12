import { describe, expect, it } from "vitest";
import { standardUI } from "@copilotkit/react-core/v2/generative-ui";
import { ipixGenerativeUI } from "../src/lib/copilotkit/ipix-generative-ui";
import {
  STANDARD_CATALOG_VERSION,
  DEFERRED_STANDARD_COMPONENTS,
  PILOT_CUSTOM_COMPONENTS,
} from "../src/lib/copilotkit/ipix-standard-catalog-policy";

describe("IPI-1387 CopilotKit Standard catalog 1.85 policy", () => {
  it("classifies every one of the 69 installed standard components exactly once", () => {
    const installed = [...standardUI.components.keys()];
    expect(standardUI.id).toBe(STANDARD_CATALOG_VERSION);
    expect(installed).toHaveLength(69);
    expect(DEFERRED_STANDARD_COMPONENTS).toHaveLength(69);
    expect(new Set(DEFERRED_STANDARD_COMPONENTS).size).toBe(69);
    expect([...DEFERRED_STANDARD_COMPONENTS].sort()).toEqual(installed.sort());
  });

  it("activates only the custom read-only pilot and no standard map/input component", () => {
    const active = [...ipixGenerativeUI.components.keys()];
    expect(active).toEqual([...PILOT_CUSTOM_COMPONENTS]);
    const deferred = new Set<string>(DEFERRED_STANDARD_COMPONENTS);
    expect(active.every((name) => !deferred.has(name))).toBe(true);
    for (const name of ["Map", "Button", "Form", "Label", "Blockquote", "Chart", "HtmlView"]) {
      expect(DEFERRED_STANDARD_COMPONENTS).toContain(name);
      expect(active).not.toContain(name);
    }
  });
});
