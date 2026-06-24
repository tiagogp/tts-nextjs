export const HOME_TABS = [
  { id: "speech", label: "Speech" },
  { id: "discover", label: "Discover" },
  { id: "converse", label: "Converse" },
  { id: "correct", label: "Correct" },
] as const;

export type HomeTab = (typeof HOME_TABS)[number]["id"];
