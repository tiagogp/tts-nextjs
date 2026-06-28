export const HOME_TABS = [
  { id: "hoje", label: "Today" },
  { id: "discover", label: "Discover" },
  { id: "study", label: "Study" },
  { id: "correct", label: "Correct" },
  { id: "speak", label: "Speak" },
] as const;

export type HomeTab = (typeof HOME_TABS)[number]["id"];
