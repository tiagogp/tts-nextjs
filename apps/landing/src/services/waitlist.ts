import type { WaitlistEntry } from "@landing/types/landing";

export async function submitWaitlistEntry(
  entry: WaitlistEntry,
): Promise<void> {
  const response = await fetch("/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });

  if (!response.ok) {
    throw new Error("Waitlist submission failed.");
  }
}
