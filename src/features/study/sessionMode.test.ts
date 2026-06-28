import { describe, expect, it } from "vitest";
import { Rating, applyGrade, initialSrs, type SrsRecord } from "@/lib/srs/fsrs";
import type { Card } from "@/lib/cards/schema";
import type { DueCard } from "./components/StudyCard";
import { buildLightQueue, isSaturated } from "./sessionMode";

function card(id: string, audio = false): Card {
  return {
    id,
    front: `front-${id}`,
    back: `back-${id}`,
    concept: "x",
    source: { kind: "phrase", id: `s-${id}` },
    audioClipPath: audio ? `/audio/${id}.wav` : undefined,
    createdAt: 0,
  };
}

/** A long-stabilized Review card (high predicted recall) at `now`, like the scaffold tests build. */
function stableCard(id: string, now: Date, audio = false): DueCard {
  let rec = initialSrs(id, now);
  for (let i = 0; i < 4; i++) {
    rec = applyGrade(rec, Rating.Easy, new Date(rec.due)).next;
  }
  return { card: card(id, audio), srs: rec };
}

function freshCard(id: string, now: Date): DueCard {
  return { card: card(id), srs: initialSrs(id, now) };
}

describe("buildLightQueue", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  // Stable cards are evaluated shortly after their last pass so recall is still high.
  const at = new Date(now.getTime() + 3600_000);

  it("keeps only already-stable cards and caps at 5", () => {
    const stable = Array.from({ length: 7 }, (_, i) => stableCard(`s${i}`, now));
    const fresh = [freshCard("f1", now), freshCard("f2", now)];
    const all = [...stable, ...fresh];
    const queue = buildLightQueue([], all, at);
    expect(queue.length).toBe(5);
    expect(queue.every((c) => c.card.id.startsWith("s"))).toBe(true);
  });

  it("orders audio cards first", () => {
    const all = [
      stableCard("text", now, false),
      stableCard("audio", now, true),
    ];
    const queue = buildLightQueue([], all, at);
    expect(queue[0]?.card.id).toBe("audio");
  });

  it("leads with cards that are both due and stable so reps still count", () => {
    const dueStable = stableCard("due", now);
    const otherStable = stableCard("other", now);
    const queue = buildLightQueue([dueStable], [dueStable, otherStable], at);
    expect(queue[0]?.card.id).toBe("due");
  });

  it("returns a short round rather than padding with fragile cards", () => {
    const all = [stableCard("s0", now), freshCard("f0", now), freshCard("f1", now)];
    expect(buildLightQueue([], all, at).length).toBe(1);
  });
});

describe("isSaturated", () => {
  it("is false until at least three answers exist", () => {
    expect(isSaturated([{ grade: Rating.Again }, { grade: Rating.Again }])).toBe(false);
  });

  it("fires on two or more Again in the last three", () => {
    expect(
      isSaturated([
        { grade: Rating.Good },
        { grade: Rating.Again },
        { grade: Rating.Good },
        { grade: Rating.Again },
      ]),
    ).toBe(true);
  });

  it("fires on monotonically rising, genuinely-slow latency", () => {
    expect(
      isSaturated([
        { grade: Rating.Good, latencyMs: 5_000 },
        { grade: Rating.Good, latencyMs: 9_000 },
        { grade: Rating.Good, latencyMs: 14_000 },
      ]),
    ).toBe(true);
  });

  it("ignores rising latency that never reaches the slow floor", () => {
    expect(
      isSaturated([
        { grade: Rating.Good, latencyMs: 1_000 },
        { grade: Rating.Good, latencyMs: 2_000 },
        { grade: Rating.Good, latencyMs: 3_000 },
      ]),
    ).toBe(false);
  });

  it("is calm for a healthy recent window", () => {
    expect(
      isSaturated([
        { grade: Rating.Good, latencyMs: 4_000 },
        { grade: Rating.Easy, latencyMs: 3_000 },
        { grade: Rating.Good, latencyMs: 5_000 },
      ]),
    ).toBe(false);
  });
});
