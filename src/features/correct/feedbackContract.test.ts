import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@/lib/cards/schema";
import { countPolishFeedback, feedbackKey, focusFeedback, prioritizeFeedback, prioritizeLocalFeedback, recurrenceCounts } from "./feedbackContract";

function error(id: string, type: ErrorEvent["errorTypes"][number], rationale?: string): ErrorEvent {
  return {
    id,
    original: "I has time",
    corrected: "I have time",
    errorTypes: [type],
    sourceLang: "pt",
    targetLang: "en",
    rationale,
    createdAt: 1,
  };
}

describe("feedback contract", () => {
  it("puts communication-impacting feedback before polish and caps the retry focus", () => {
    const focused = prioritizeFeedback([
      error("naturalness", "collocation"),
      error("grammar", "tense"),
      error("polish", "register"),
    ]);

    expect(focused.map((item) => item.event.id)).toEqual(["grammar", "naturalness", "polish"]);
    expect(focused.slice(0, 2)).toHaveLength(2);
    expect(focused[0].category).toBe("grammar");
  });

  it("promotes a recurring lower-impact issue", () => {
    const [issue] = prioritizeFeedback([error("repeat", "collocation")], {
      recurrenceCounts: new Map([["repeat", 2]]),
    });
    expect(issue.priority).toBe("blocking");
    expect(issue.recurrenceCount).toBe(2);
  });

  it("normalizes provider-free lesson categories into the shared contract", () => {
    const [issue] = prioritizeLocalFeedback([{
      type: "other",
      category: "lessonLanguage",
      priority: "blocking",
      note: "Use the lesson frame.",
    }]);
    expect(issue).toMatchObject({ category: "vocabulary", priority: "blocking", lessonRelevance: 1 });
  });

  it("automatically detects recurrence across separately-created error records", () => {
    const first = error("first", "collocation");
    const second = { ...error("second", "collocation"), createdAt: 2 };
    const counts = recurrenceCounts([first, second]);
    expect(counts.get(feedbackKey(first))).toBe(2);
    expect(prioritizeFeedback([second], { recurrenceCounts: counts })[0].priority).toBe("blocking");
  });

  it("keeps polish visible but outside the default retry focus", () => {
    const issues = prioritizeFeedback([
      error("polish", "register"),
      error("grammar", "tense"),
      error("clarity", "missing-information"),
    ]);
    expect(focusFeedback(issues).map((issue) => issue.event.id)).toEqual(["clarity", "grammar"]);
    expect(countPolishFeedback(issues)).toBe(1);
  });
});
