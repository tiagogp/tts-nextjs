import type { WaitlistEntry, WaitlistPlatform } from "@landing/types/landing";

export type { WaitlistEntry, WaitlistPlatform } from "@landing/types/landing";

export const WAITLIST_PLATFORMS: readonly WaitlistPlatform[] = [
  "Mac Apple Silicon",
  "Mac Intel",
  "Windows",
  "Linux",
];

export function parseWaitlistEntry(value: unknown): WaitlistEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const body = value as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const platform = body.platform;
  const workflow = typeof body.workflow === "string" ? body.workflow.trim() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (
    typeof platform !== "string" ||
    !WAITLIST_PLATFORMS.includes(platform as WaitlistPlatform)
  ) {
    return null;
  }
  if (workflow.length < 8 || workflow.length > 2_000) return null;

  return { email, platform: platform as WaitlistPlatform, workflow };
}
