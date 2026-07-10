export type LandingLanguage = "pt" | "en";

export type LandingSectionId = "workflow" | "inside" | "privacy" | "waitlist";

export type WaitlistPlatform =
  | "Mac Apple Silicon"
  | "Mac Intel"
  | "Windows"
  | "Linux";

export type WaitlistEntry = {
  email: string;
  platform: WaitlistPlatform;
  workflow: string;
};
