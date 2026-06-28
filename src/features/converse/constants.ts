import type { EnglishLevel } from "@/features/discover/types";

export interface ConversationScenario {
  id: string;
  /** Normalized situational tag — becomes ErrorEvent.context downstream (Phase 2). */
  context: string;
  /** Menu label shown to the user. */
  label: string;
  /** Descriptive prompt handed to the LLM to role-play. */
  prompt: string;
}

/** Starter scenarios. The user can also type a custom one. */
export const CONVERSATION_SCENARIOS: ConversationScenario[] = [
  {
    id: "small-talk",
    context: "small talk",
    label: "Small talk",
    prompt: "You are a friendly colleague making small talk by the coffee machine.",
  },
  {
    id: "restaurant",
    context: "restaurant",
    label: "At a restaurant",
    prompt: "You are a waiter at a restaurant; the learner is a customer ordering a meal.",
  },
  {
    id: "job-interview",
    context: "job interview",
    label: "Job interview",
    prompt: "You are an interviewer for a job opening; the learner is the candidate.",
  },
  {
    id: "doctor",
    context: "doctor visit",
    label: "Doctor's visit",
    prompt: "You are a doctor; the learner is a patient describing a health concern.",
  },
];

export const CONVERSATION_LEVELS: EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
export type ConversationLevel = EnglishLevel;
export const DEFAULT_LEVEL: ConversationLevel = "A1";
