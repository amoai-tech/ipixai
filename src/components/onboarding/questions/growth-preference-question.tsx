"use client";

import { GROWTH_OPTIONS } from "../onboarding-options";
import type { OnboardingGrowthPreference } from "@/lib/onboarding";

export function GrowthPreferenceQuestion({
  value,
  onChange,
}: {
  value: OnboardingGrowthPreference | null;
  onChange: (value: OnboardingGrowthPreference) => void;
}) {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">How do you want to grow?</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Pick a direction or skip it. You stay in control of the strategy.
        </p>
      </div>
      <fieldset className="grid gap-3 border-0 p-0">
        <legend className="sr-only">How do you want to grow?</legend>
        {GROWTH_OPTIONS.map((option) => {
          const selected = value === option.id;
          return (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius)] border p-3 ${
                selected ? "border-[var(--ring)] bg-[var(--muted)]" : "border-[var(--border)]"
              }`}
            >
              <input
                type="radio"
                name="growthPreference"
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                aria-label={option.label}
              />
              <span className="text-sm font-medium">{option.label}</span>
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}
