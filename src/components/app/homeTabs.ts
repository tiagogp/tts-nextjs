export const HOME_TABS = [
  { id: "hoje", label: "Today" },
  { id: "study", label: "Review" },
  { id: "discover", label: "Phrases" },
  { id: "correct", label: "Mistakes" },
] as const;

export type HomeTab = (typeof HOME_TABS)[number]["id"];
