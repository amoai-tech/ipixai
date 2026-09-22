"use client";

import { CHANNEL_OPTIONS } from "../onboarding-options";
import type { OnboardingChannelId } from "@/lib/onboarding";

export function ChannelsQuestion({
  channels,
  identity,
  onToggle,
  onIdentityChange,
}: {
  channels: OnboardingChannelId[];
  identity: string;
  onToggle: (id: OnboardingChannelId) => void;
  onIdentityChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Where is your Brand active?</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Choose any that apply. These are declarations, not verified evidence.
        </p>
      </div>
      <fieldset className="grid grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-2">
        <legend className="sr-only">Where is your Brand active?</legend>
        {CHANNEL_OPTIONS.map((channel) => {
          const selected = channels.includes(channel.id);
          return (
            <label
              key={channel.id}
              className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius)] border p-3 ${
                selected ? "border-[var(--ring)] bg-[var(--muted)]" : "border-[var(--border)]"
              }`}
            >
              <input
                type="checkbox"
                name="channels"
                value={channel.id}
                checked={selected}
                onChange={() => onToggle(channel.id)}
                aria-label={channel.label}
              />
              <span aria-hidden="true" className="w-5 text-center font-semibold">{channel.glyph}</span>
              <span className="text-sm font-medium">{channel.label}</span>
            </label>
          );
        })}
      </fieldset>
      <div className="grid gap-1.5">
        <label htmlFor="channelIdentity" className="text-sm font-medium">Optional public handle or URL</label>
        <input
          id="channelIdentity"
          name="channelIdentity"
          value={identity}
          onChange={(event) => onIdentityChange(event.target.value)}
          placeholder="@maisonnoir or public profile/store URL"
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <p className="text-xs text-[var(--muted-foreground)]">Saved as an unverified hint only.</p>
      </div>
    </div>
  );
}
