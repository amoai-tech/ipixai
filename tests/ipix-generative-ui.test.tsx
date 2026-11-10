// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConceptComparison, ipixGenerativeUI } from "../src/lib/copilotkit/ipix-generative-ui";

const ENTRY = () =>
  (ipixGenerativeUI as unknown as {
    components: Map<string, { props: { safeParse: (value: unknown) => { success: boolean } } }>;
  }).components.get("ConceptComparison")!;

describe("iPix native GenUI catalog", () => {
  it("exposes one read-only ConceptComparison component", () => {
    const components = (ipixGenerativeUI as unknown as { components: Map<string, unknown> })
      .components;
    expect([...components.keys()]).toEqual(["ConceptComparison"]);
  });

  it("renders qualitative concept names and rationales", () => {
    render(
      <ConceptComparison
        title="Summer campaign concepts"
        options={[
          { name: "Editorial linen", rationale: "Soft natural light." },
          { name: "Studio color", rationale: "Controlled bold styling." },
        ]}
        note="Qualitative only."
      />,
    );

    expect(screen.getByTestId("genui-concept-comparison")).toBeTruthy();
    expect(screen.getByText("Summer campaign concepts")).toBeTruthy();
    expect(screen.getByText("Editorial linen")).toBeTruthy();
    expect(screen.getByText("Studio color")).toBeTruthy();
    expect(screen.getByText("Qualitative only.")).toBeTruthy();
  });

  it("accepts two or three options and rejects measured business facts", () => {
    const valid = {
      title: "Concepts",
      options: [
        { name: "A", rationale: "One." },
        { name: "B", rationale: "Two." },
      ],
    };
    expect(ENTRY().props.safeParse(valid).success).toBe(true);
    expect(
      ENTRY().props.safeParse({
        ...valid,
        budget: 12000,
        shotCount: 24,
      }).success,
    ).toBe(false);
    expect(
      ENTRY().props.safeParse({
        ...valid,
        options: [{ name: "A", rationale: "One.", budget: 100 }],
      }).success,
    ).toBe(false);
  });
});
