import type { ErrorEvent } from "@/lib/cards/schema";
import type { ProviderKind } from "@/lib/cards/provider";
import { getLearnerLangs } from "@/features/settings/learningProfile";
import type { LevelTest, WritingGradeSummary } from "./testModel";

/** Ask the server to author a level-up test for the learner's current transition. */
export async function generateLevelTest(input: {
  provider: ProviderKind;
  selectedModel?: string;
  /** Weak concepts/error-types to bias one or two items toward. */
  focusGaps?: string[];
}): Promise<LevelTest> {
  const { nativeLang, targetLang, level } = getLearnerLangs();
  const response = await fetch("/api/level-test/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: input.provider,
      ollamaModel: input.selectedModel || undefined,
      currentLevel: level,
      nativeLang,
      targetLang,
      focusGaps: input.focusGaps?.slice(0, 3),
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    test?: LevelTest;
    error?: string;
  };
  if (!response.ok || !data.test) {
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }
  return data.test;
}

/** Grade the free-writing section against the target band. */
export async function gradeLevelWriting(input: {
  provider: ProviderKind;
  selectedModel?: string;
  targetLevel: LevelTest["targetLevel"];
  writingPrompt: string;
  text: string;
}): Promise<{ grade: WritingGradeSummary; events: ErrorEvent[] }> {
  const { nativeLang, targetLang } = getLearnerLangs();
  const response = await fetch("/api/level-test/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: input.provider,
      ollamaModel: input.selectedModel || undefined,
      targetLevel: input.targetLevel,
      writingPrompt: input.writingPrompt,
      text: input.text,
      nativeLang,
      targetLang,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    grade?: WritingGradeSummary;
    events?: ErrorEvent[];
    error?: string;
  };
  if (!response.ok || !data.grade) {
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }
  return { grade: data.grade, events: data.events ?? [] };
}
