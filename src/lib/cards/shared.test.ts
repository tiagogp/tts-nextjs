import { describe, expect, it } from "vitest";
import { normalizeMined } from "./shared";
import type { ContentSource, DiscoveryRequest, TranscriptSegment } from "./schema";

const source: ContentSource = {
  id: "source-1",
  kind: "youtube",
  title: "Test video",
  lang: "en",
  createdAt: 0,
};

const request: DiscoveryRequest = { source, targetLang: "en" };

const transcript: TranscriptSegment[] = [
  { text: "I have to get going, see you later.", startMs: 0, endMs: 2000 },
  { text: "That's a completely different sentence.", startMs: 2000, endMs: 4000 },
];

describe("normalizeMined", () => {
  it("keeps a phrase whose text is actually grounded in its claimed segment", () => {
    const out = normalizeMined(
      { phrases: [{ text: "I have to get going", translation: null, note: "", segmentIndex: 0 }] },
      transcript,
      request,
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("I have to get going");
  });

  it("tolerates punctuation/casing differences from the source segment", () => {
    const out = normalizeMined(
      { phrases: [{ text: "I HAVE TO get going!", translation: null, note: "", segmentIndex: 0 }] },
      transcript,
      request,
    );
    expect(out).toHaveLength(1);
  });

  it("drops a phrase attributed to a segment its text doesn't actually appear in", () => {
    const out = normalizeMined(
      {
        phrases: [
          { text: "This text was hallucinated and never said", translation: null, note: "", segmentIndex: 0 },
        ],
      },
      transcript,
      request,
    );
    expect(out).toHaveLength(0);
  });

  it("keeps a phrase with no valid segment index (structural check already handled it)", () => {
    const out = normalizeMined(
      { phrases: [{ text: "Some phrase", translation: null, note: "", segmentIndex: 99 }] },
      transcript,
      request,
    );
    expect(out).toHaveLength(1);
  });
});
