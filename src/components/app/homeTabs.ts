export const HOME_TABS = [
  { id: "discover", label: "Discover" },
  { id: "converse", label: "Practice" },
  { id: "correct", label: "Correct" },
  { id: "speech", label: "Speech" },
] as const;

export type HomeTab = (typeof HOME_TABS)[number]["id"];
