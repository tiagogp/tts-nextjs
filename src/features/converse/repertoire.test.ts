import { describe, expect, it } from "vitest";
import {
  buildRepertoireCards,
  detectRepertoireUse,
  markRepertoireUsed,
  mergeRepertoire,
  parseRepertoire,
  recentTaughtExpressions,
  repertoireUptake,
  segmentRepertoire,
  stripRepertoireMarkers,
  unusedRepertoire,
} from "./repertoire";

describe("parseRepertoire", () => {
  it("pulls the marked expressions and their glosses out of a well-formed reply", () => {
    const parsed = parseRepertoire(
      "That's **a sticking point** for most teams, so they **hedge their bets**. What would you do?\n" +
        "[[repertoire: a sticking point — an issue blocking agreement; hedge their bets — avoid committing to one option]]",
    );
    const carrier = "That's a sticking point for most teams, so they hedge their bets.";
    expect(parsed.items).toEqual([
      { expression: "a sticking point", gloss: "an issue blocking agreement", carrier },
      { expression: "hedge their bets", gloss: "avoid committing to one option", carrier },
    ]);
  });

  it("keeps markers in display but strips them, and the trailer, from the spoken text", () => {
    const parsed = parseRepertoire("You **nailed it**.\n[[repertoire: nailed it — got it exactly right]]");
    expect(parsed.display).toBe("You **nailed it**.");
    // The trailer and the asterisks must never reach Kokoro.
    expect(parsed.plain).toBe("You nailed it.");
    expect(parsed.plain).not.toContain("repertoire");
    expect(parsed.plain).not.toContain("*");
  });

  it("returns an ordinary reply untouched when there is no markup at all", () => {
    const reply = "So how was your week?";
    const parsed = parseRepertoire(reply);
    expect(parsed).toEqual({ display: reply, plain: reply, items: [] });
  });

  it("still highlights expressions when the model forgets the trailer", () => {
    const parsed = parseRepertoire("It was **a tall order**.");
    expect(parsed.items).toEqual([{ expression: "a tall order", gloss: "", carrier: "It was a tall order." }]);
    expect(parsed.plain).toBe("It was a tall order.");
  });

  it("tolerates the separators and casing models actually produce", () => {
    const enDash = parseRepertoire("**by and large** fine.\n[[Repertoire: by and large – mostly]]");
    expect(enDash.items[0].gloss).toBe("mostly");
    const colon = parseRepertoire("**off the cuff** remark.\n[[repertoire: off the cuff: without preparation]]");
    expect(colon.items[0].gloss).toBe("without preparation");
  });

  it("survives a truncated trailer without leaking it into the reply", () => {
    const parsed = parseRepertoire("Quite **a leap**.\n[[repertoire: a leap — a big jump");
    expect(parsed.display).toBe("Quite **a leap**.");
    expect(parsed.plain).toBe("Quite a leap.");
    expect(parsed.items).toEqual([{ expression: "a leap", gloss: "a big jump", carrier: "Quite a leap." }]);
  });

  it("ignores trailer entries that were never marked in the reply", () => {
    const parsed = parseRepertoire("Just **one thing**.\n[[repertoire: one thing — a single item; ghost phrase — never used]]");
    expect(parsed.items).toEqual([{ expression: "one thing", gloss: "a single item", carrier: "Just one thing." }]);
  });

  it("ignores a bolded gloss list the model restates above the trailer", () => {
    // Real output from a local 9B model: it repeated the whole trailer as a bold line. Before
    // the guard this parsed as one giant "expression" and got read aloud as a definition list.
    const parsed = parseRepertoire(
      "So what's your take on that tradeoff?\n\n" +
        "**a sticking point — an issue blocking agreement; to hedge one's bets — to avoid committing fully**\n\n" +
        "[[repertoire: a sticking point — an issue blocking agreement; to hedge one's bets — to avoid committing fully]]",
    );
    expect(parsed.items).toEqual([]);
    expect(parsed.plain).toBe("So what's your take on that tradeoff?");
    expect(parsed.plain).not.toContain("an issue blocking agreement");
  });

  it("rejects a marked span that is a sentence rather than an expression", () => {
    const parsed = parseRepertoire("**I think that most meetings really ought to be asynchronous these days**, right?");
    expect(parsed.items).toEqual([]);
    // The text still reads normally; only the highlight is refused.
    expect(parsed.plain).toBe("I think that most meetings really ought to be asynchronous these days, right?");
  });

  it("keeps a genuine marked expression on a line of its own", () => {
    const parsed = parseRepertoire("**a false economy**\n[[repertoire: a false economy — a saving that costs more later]]");
    expect(parsed.items).toEqual([
      { expression: "a false economy", gloss: "a saving that costs more later", carrier: "a false economy" },
    ]);
  });

  it("de-duplicates an expression the model marked twice", () => {
    const parsed = parseRepertoire("**a nitpick** here, **a nitpick** there.\n[[repertoire: a nitpick — a minor objection]]");
    expect(parsed.items).toHaveLength(1);
  });
});

describe("segmentRepertoire", () => {
  it("splits a reply into plain and marked pieces that rebuild the original text", () => {
    const { display, items } = parseRepertoire("It was **a tall order**, honestly.\n[[repertoire: a tall order — a demanding task]]");
    const segments = segmentRepertoire(display, items);
    expect(segments.map((segment) => segment.text).join("")).toBe("It was a tall order, honestly.");
    expect(segments.filter((segment) => segment.item)).toHaveLength(1);
    expect(segments.find((segment) => segment.item)?.item?.gloss).toBe("a demanding task");
  });

  it("returns a single plain segment for an unmarked reply", () => {
    expect(segmentRepertoire("Nothing marked here.", [])).toEqual([{ text: "Nothing marked here." }]);
  });
});

describe("mergeRepertoire", () => {
  it("accumulates across turns in first-seen order without duplicating", () => {
    const first = mergeRepertoire([], [{ expression: "a leap", gloss: "a big jump" }]);
    const second = mergeRepertoire(first, [
      { expression: "a leap", gloss: "a big jump" },
      { expression: "a nitpick", gloss: "a minor objection" },
    ]);
    expect(second.map((item) => item.expression)).toEqual(["a leap", "a nitpick"]);
  });

  it("fills in a gloss that arrived only on a later turn", () => {
    const first = mergeRepertoire([], [{ expression: "a leap", gloss: "" }]);
    const second = mergeRepertoire(first, [{ expression: "A Leap", gloss: "a big jump" }]);
    expect(second).toEqual([{ expression: "a leap", gloss: "a big jump" }]);
  });
});

describe("buildRepertoireCards", () => {
  const items = [
    { expression: "a sticking point", gloss: "an issue blocking agreement" },
    { expression: "a tall order", gloss: "" },
  ];

  it("builds production cards that prompt with meaning and answer with the expression", () => {
    const { cards } = buildRepertoireCards(items, { context: "negotiation", conversationId: "c1", now: 5 });
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      back: "a sticking point",
      direction: "production",
      skill: "vocabulary",
      context: "negotiation",
      source: { kind: "phrase" },
      createdAt: 5,
    });
    expect(cards[0].front).toContain("an issue blocking agreement");
  });

  it("skips expressions with no gloss instead of inventing a prompt", () => {
    const { skipped, cards } = buildRepertoireCards(items, { context: "negotiation", conversationId: "c1" });
    expect(skipped).toEqual([{ expression: "a tall order", gloss: "" }]);
    expect(cards.every((card) => card.front.trim().length > 0)).toBe(true);
  });

  it("pairs every card with a candidate under the same id so the deck stays grounded", () => {
    const { cards, candidates } = buildRepertoireCards(items, { context: "negotiation", conversationId: "c1" });
    expect(candidates).toHaveLength(cards.length);
    expect(candidates[0].id).toBe(cards[0].source.id);
    expect(candidates[0].status).toBe("accepted");
    expect(candidates[0].text).toBe("a sticking point");
  });

  it("gives cards from different conversations distinct ids", () => {
    const a = buildRepertoireCards(items, { context: "x", conversationId: "c1" }).cards[0].id;
    const b = buildRepertoireCards(items, { context: "x", conversationId: "c2" }).cards[0].id;
    expect(a).not.toBe(b);
  });
});

describe("detectRepertoireUse", () => {
  const items = [
    { expression: "a sticking point", gloss: "an issue blocking agreement" },
    { expression: "hedge your bets", gloss: "avoid committing" },
    { expression: "turn out to be", gloss: "prove to be" },
  ];

  it("credits an expression the learner said back verbatim", () => {
    const used = detectRepertoireUse("Honestly, that's a sticking point for us too.", items);
    expect(used.map((item) => item.expression)).toEqual(["a sticking point"]);
  });

  it("credits an inflected reuse — the point is that they reached for it", () => {
    const used = detectRepertoireUse("It turned out to be much harder than we thought.", items);
    expect(used.map((item) => item.expression)).toEqual(["turn out to be"]);
  });

  it("credits a reuse that swaps the possessive slot", () => {
    const used = detectRepertoireUse("So I hedged my bets and waited.", [
      { expression: "hedge someone's bets", gloss: "avoid committing" },
    ]);
    expect(used).toHaveLength(1);
  });

  it("ignores case and punctuation around the expression", () => {
    expect(detectRepertoireUse("A STICKING POINT — definitely!", items)).toHaveLength(1);
  });

  it("does not credit an expression that never appears", () => {
    expect(detectRepertoireUse("I completely agree with you on that.", items)).toEqual([]);
  });

  it("does not credit the same expression twice once it is stamped", () => {
    const stamped = markRepertoireUsed(items, [items[0]], 10);
    expect(detectRepertoireUse("Still a sticking point.", stamped)).toEqual([]);
  });

  it("does not match words that merely appear scattered in the turn", () => {
    // "hedge" and "bets" are both there, but not as the expression.
    expect(detectRepertoireUse("I hedge sometimes, and I place bets rarely.", items)).toEqual([]);
  });
});

describe("markRepertoireUsed", () => {
  const items = [
    { expression: "a leap", gloss: "a big jump" },
    { expression: "a nitpick", gloss: "a minor objection" },
  ];

  it("stamps only the given expressions and keeps order", () => {
    const next = markRepertoireUsed(items, [items[1]], 42);
    expect(next.map((item) => item.usedAt)).toEqual([undefined, 42]);
  });

  it("keeps the first timestamp when an expression is used again", () => {
    const once = markRepertoireUsed(items, [items[0]], 1);
    expect(markRepertoireUsed(once, [items[0]], 99)[0].usedAt).toBe(1);
  });

  it("returns the same list untouched when nothing was used", () => {
    expect(markRepertoireUsed(items, [])).toBe(items);
  });
});

describe("repertoireUptake", () => {
  it("counts what the learner produced against what they were handed", () => {
    const items = markRepertoireUsed(
      [
        { expression: "a leap", gloss: "" },
        { expression: "a nitpick", gloss: "" },
        { expression: "a tall order", gloss: "" },
      ],
      [{ expression: "a nitpick", gloss: "" }],
      7,
    );
    expect(repertoireUptake(items)).toEqual({ used: 1, total: 3 });
    expect(unusedRepertoire(items).map((item) => item.expression)).toEqual(["a leap", "a tall order"]);
  });
});

describe("mergeRepertoire uptake", () => {
  it("never loses a use stamp when the same expression comes round again", () => {
    const used = markRepertoireUsed([{ expression: "a leap", gloss: "a big jump" }], [{ expression: "a leap", gloss: "" }], 3);
    const merged = mergeRepertoire(used, [{ expression: "a leap", gloss: "a big jump" }]);
    expect(merged[0].usedAt).toBe(3);
  });

  it("fills in a carrier sentence that arrived only on a later turn", () => {
    const first = mergeRepertoire([], [{ expression: "a leap", gloss: "a big jump" }]);
    const second = mergeRepertoire(first, [{ expression: "a leap", gloss: "a big jump", carrier: "Quite a leap." }]);
    expect(second[0].carrier).toBe("Quite a leap.");
  });
});

describe("recentTaughtExpressions", () => {
  it("collects across sessions newest-last, without duplicates", () => {
    const taught = recentTaughtExpressions([
      { repertoire: [{ expression: "a nitpick", gloss: "" }] },
      { repertoire: [{ expression: "a leap", gloss: "" }, { expression: "A Nitpick", gloss: "" }] },
    ]);
    // Newest session is first in, so it ends up last — the prompt keeps the tail when truncating.
    expect(taught).toEqual(["a leap", "a nitpick"]);
  });

  it("keeps the newest expressions when it has to truncate", () => {
    const taught = recentTaughtExpressions(
      [{ repertoire: [{ expression: "newest", gloss: "" }] }, { repertoire: [{ expression: "older", gloss: "" }] }],
      1,
    );
    expect(taught).toEqual(["newest"]);
  });

  it("ignores conversations from before repertoire was stored", () => {
    expect(recentTaughtExpressions([{}, { repertoire: [] }])).toEqual([]);
  });
});

describe("stripRepertoireMarkers", () => {
  it("removes markers and leaves everything else alone", () => {
    expect(stripRepertoireMarkers("a **bold** move")).toBe("a bold move");
    expect(stripRepertoireMarkers("no markers")).toBe("no markers");
  });
});
