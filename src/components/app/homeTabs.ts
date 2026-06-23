export const HOME_TABS = [
  { id: "speech", label: "Speech" },
  { id: "discover", label: "Discover" },
  { id: "correct", label: "Correct" },
  { id: "study", label: "Study" },
] as const;

export type HomeTab = (typeof HOME_TABS)[number]["id"];
