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
    id: "personal-update",
    context: "personal update",
    label: "My week",
    prompt: "You are a friendly conversation partner asking about the learner's week, plans, and everyday experiences. Ask one follow-up about a detail they share.",
  },
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

/**
 * Openers for the C1-C2 conversation. Ordering a meal is not the exercise at this level — the
 * learner can already do it. These put them somewhere they have to reach for precise language:
 * an argument to hold, a distinction to draw, an idea to explain to the wrong audience.
 */
export const ADVANCED_CONVERSATION_SCENARIOS: ConversationScenario[] = [
  {
    id: "defend-a-view",
    context: "debate",
    label: "Defend a view",
    prompt:
      "You are a sharp, good-faith interlocutor. Ask the learner for a position they hold, then press it: ask for the strongest counterargument, offer one yourself, and make them qualify or concede where they should. Stay warm but do not let a vague claim pass.",
  },
  {
    id: "negotiate-tradeoff",
    context: "negotiation",
    label: "Negotiate a tradeoff",
    prompt:
      "You are a counterpart in a negotiation with genuinely competing interests — scope against deadline, cost against quality. Make the learner argue for priorities, propose concessions, and articulate what they will not give up.",
  },
  {
    id: "explain-your-field",
    context: "explaining",
    label: "Explain your field",
    prompt:
      "You are an intelligent non-expert. Ask the learner to explain something from their own field, then keep asking the awkward clarifying question a smart outsider would, so they have to find analogies and drop the jargon.",
  },
  {
    id: "react-to-news",
    context: "current affairs",
    label: "React to something you read",
    prompt:
      "You are a well-read friend. Ask what the learner has read or watched recently that stayed with them, then dig into why — what it changed, what they disagree with, and how they would put it to someone who has not seen it.",
  },
  {
    id: "tell-it-well",
    context: "storytelling",
    label: "Tell it well",
    prompt:
      "You are an attentive listener. Ask the learner to tell a real story from their life, then push for the telling rather than the summary: the detail, the turn, the point. Ask the questions that make a story land.",
  },
];

export const CONVERSATION_LEVELS: EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
export type ConversationLevel = EnglishLevel;
export const DEFAULT_LEVEL: ConversationLevel = "A1";
