"use client";

import { useId } from "react";

import { validateUrl } from "@/lib/onboarding";

export function BrandDetailsQuestion({
  brandName,
  websiteUrl,
  onBrandNameChange,
  onWebsiteUrlChange,
}: {
  brandName: string;
  websiteUrl: string;
  onBrandNameChange: (value: string) => void;
  onWebsiteUrlChange: (value: string) => void;
}) {
  const nameId = useId();
  const urlId = useId();
  const urlError = validateUrl(websiteUrl);
  const host = websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Tell us about your Brand</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">Brand name is required. Website is optional.</p>
      </div>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor={nameId} className="text-sm font-medium">Brand name</label>
          <input
            id={nameId}
            name="brandName"
            value={brandName}
            onChange={(event) => onBrandNameChange(event.target.value)}
            autoComplete="organization"
            placeholder="Maison Noir"
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={urlId} className="text-sm font-medium">
            Website <span className="font-normal text-[var(--muted-foreground)]">(optional)</span>
          </label>
          <input
            id={urlId}
            name="websiteUrl"
            value={websiteUrl}
            onChange={(event) => onWebsiteUrlChange(event.target.value)}
            inputMode="url"
            autoComplete="url"
            placeholder="https://maisonnoir.com"
            aria-invalid={urlError ? true : undefined}
            aria-describedby={urlError ? `${urlId}-error` : undefined}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
          {urlError ? (
            <p id={`${urlId}-error`} role="alert" className="text-xs text-[var(--destructive)]">{urlError}</p>
          ) : null}
          {!urlError && host ? (
            <p className="text-xs text-[var(--muted-foreground)]">We can analyse {host} after your Brand is created.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
