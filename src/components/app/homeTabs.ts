export const HOME_TABS = [
  { id: "hoje", label: "Today" },
  { id: "study", label: "Review" },
  { id: "speak", label: "Speak" },
  // "Talk" rather than "Conversation": the nav truncates anything much longer, and it pairs
  // with "Speak" the way the surfaces do — Speak drills a phrase, Talk holds a conversation.
  { id: "conversa", label: "Talk" },
  { id: "discover", label: "Phrases" },
  { id: "correct", label: "Mistakes" },
] as const;

export type HomeTab = (typeof HOME_TABS)[number]["id"];
