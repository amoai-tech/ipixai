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

  it("renders the fashion idiom 'one look at' but still rejects counted looks", () => {
    const concept = {
      title: "One Look at Nature",
      options: [
        { name: "Botanical studio", rationale: "Pressed-flower props." },
        { name: "Coastal linen", rationale: "Natural afternoon light." },
      ],
    };
    expect(ENTRY().props.safeParse(concept).success).toBe(true);
    const { container } = render(<ConceptComparison {...concept} />);
    expect(container.querySelector("[data-testid=genui-concept-comparison]")).not.toBeNull();
    expect(screen.getByText("One Look at Nature")).toBeTruthy();

    // A count of looks is still a business quantity, not concept vocabulary.
    expect(
      ENTRY().props.safeParse({ ...concept, note: "Sign off twelve looks by Friday." }).success,
    ).toBe(false);
  });

  it("rejects numerical business claims embedded in otherwise schema-valid text", () => {
    const options = [
      { name: "Editorial", rationale: "Natural light." },
      { name: "Studio", rationale: "Simple sets." },
    ];
    for (const unsafe of [
      { title: "Compare concepts", options, note: "Budget is COP 12,000." },
      { title: "Compare concepts", options: [{ ...options[0], rationale: "Three shots are already approved." }, options[1]] },
      { title: "Sales increased 20%", options },
      { title: "Compare concepts", options, note: "Fifty percent growth is promised." },
      { title: "Compare concepts", options, note: "Fifty shots are ready." },
      { title: "Compare concepts", options, note: "Thirteen assets exist." },
    ]) {
      expect(ENTRY().props.safeParse(unsafe).success).toBe(false);
    }
  });

  it("shows a safe message rather than rendering an unverified fact when invoked directly", () => {
    const { container } = render(<ConceptComparison
      title="Summer concepts"
      options={[
        { name: "Studio", rationale: "A 50% increase in sales is guaranteed." },
        { name: "Outdoor", rationale: "Natural sunlight." },
      ]}
      note="Unverified."
    />);
    expect(container.querySelector("[data-testid=genui-concept-comparison]")).toBeNull();
    expect(container.querySelector("[data-testid=genui-comparison-content-error]")?.textContent).toContain("unverified");
    expect(container.textContent).not.toContain("A 50% increase in sales is guaranteed.");
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
