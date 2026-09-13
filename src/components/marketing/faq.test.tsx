// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Faq } from "./faq";

afterEach(() => {
  cleanup();
});

const items = [
  { question: "Question one?", answer: "Answer one." },
  { question: "Question two?", answer: "Answer two." },
];

// IPI-1060 · MARKETING-SERVICES-001 — required FAQ keyboard/aria-expanded proof.
describe("Faq (IPI-1060)", () => {
  it("starts with every panel collapsed", () => {
    render(<Faq items={items} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button.getAttribute("aria-expanded")).toBe("false");
    }
  });

  it("opens a panel on click, exposing aria-controls and the visible answer", () => {
    render(<Faq items={items} />);
    const button = screen.getByRole("button", { name: /question one/i });
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const panelId = button.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId as string)?.hidden).toBe(false);
    expect(screen.getByText("Answer one.")).toBeTruthy();
  });

  // jsdom doesn't run a native <button>'s real-browser "Enter/Space triggers
  // click" activation for synthetic events (confirmed: a raw
  // fireEvent.keyDown never fires a click here) — user-event implements
  // that translation itself, so this is a real keyboard-activation proof,
  // not a relabeled click test.
  it("is keyboard-operable: Enter activates the focused button", async () => {
    const user = userEvent.setup();
    render(<Faq items={items} />);
    const button = screen.getByRole("button", { name: /question two/i });
    button.focus();
    await user.keyboard("{Enter}");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const panelId = button.getAttribute("aria-controls") as string;
    expect(document.getElementById(panelId)?.hidden).toBe(false);
  });

  it("is keyboard-operable: Space activates the focused button", async () => {
    const user = userEvent.setup();
    render(<Faq items={items} />);
    const button = screen.getByRole("button", { name: /question two/i });
    button.focus();
    await user.keyboard(" ");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const panelId = button.getAttribute("aria-controls") as string;
    expect(document.getElementById(panelId)?.hidden).toBe(false);
  });

  it("closes again on a second click", () => {
    render(<Faq items={items} />);
    const button = screen.getByRole("button", { name: /question one/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(button.getAttribute("aria-controls") as string)?.hidden).toBe(true);
  });

  it("keeps only one panel open at a time", () => {
    render(<Faq items={items} />);
    fireEvent.click(screen.getByRole("button", { name: /question one/i }));
    fireEvent.click(screen.getByRole("button", { name: /question two/i }));
    expect(screen.getByRole("button", { name: /question one/i }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: /question two/i }).getAttribute("aria-expanded")).toBe("true");
  });
});
