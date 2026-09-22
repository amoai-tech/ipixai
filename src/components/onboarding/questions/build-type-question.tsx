"use client";

import Image from "next/image";

import { BUILD_OPTIONS } from "../onboarding-options";
import type { OnboardingBuildType } from "@/lib/onboarding";

export function BuildTypeQuestion({
  value,
  onChange,
}: {
  value: OnboardingBuildType | null;
  onChange: (value: OnboardingBuildType) => void;
}) {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">What are you building?</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          This helps iPix understand your Brand. You can skip this for now.
        </p>
      </div>
      <fieldset className="grid gap-3 border-0 p-0">
        <legend className="sr-only">What are you building?</legend>
        {BUILD_OPTIONS.map((option) => {
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
                name="buildType"
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                aria-label={option.label}
              />
              <Image
                src={`/onboarding/${option.image}-fashionos.jpeg`}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 rounded-[var(--radius)] object-cover"
              />
              <span className="text-sm font-medium">{option.label}</span>
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}
