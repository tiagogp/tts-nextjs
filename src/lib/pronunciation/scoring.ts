import type {
  PronunciationAssessment,
  PronunciationWordFeedback,
} from "@/lib/pronunciation/types";

const CONTRACTIONS: Record<string, string> = {
  "i'm": "i am",
  "you're": "you are",
  "he's": "he is",
  "she's": "she is",
  "it's": "it is",
  "we're": "we are",
  "they're": "they are",
  "i've": "i have",
  "you've": "you have",
  "we've": "we have",
  "they've": "they have",
  "i'd": "i would",
  "you'd": "you would",
  "he'd": "he would",
  "she'd": "she would",
  "we'd": "we would",
  "they'd": "they would",
  "i'll": "i will",
  "you'll": "you will",
  "he'll": "he will",
  "she'll": "she will",
  "we'll": "we will",
  "they'll": "they will",
  "can't": "cannot",
  "won't": "will not",
  "n't": " not",
};

export function normalizePronunciationWords(text: string): string[] {
  let normalized = text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/&/g, " and ");

  for (const [from, to] of Object.entries(CONTRACTIONS)) {
    if (from === "n't") {
      normalized = normalized.replace(/\b([a-z]+)n't\b/g, "$1 not");
    } else {
      normalized = normalized.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, "g"), to);
    }
  }

  return normalized
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j < prev.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function simpleSoundKey(word: string): string {
  return word
    .replace(/ue$/g, "oo")
    .replace(/ew$/g, "oo");
}

function wordSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  const lexicalScore = Math.max(0, 1 - editDistance(a, b) / maxLen);
  if (simpleSoundKey(a) === simpleSoundKey(b)) return Math.max(lexicalScore, 0.86);
  return lexicalScore;
}

function alignWords(target: string[], spoken: string[]): PronunciationWordFeedback[] {
  type BackPointer = { i: number; j: number };

  const costs = Array.from({ length: target.length + 1 }, () =>
    Array.from({ length: spoken.length + 1 }, () => 0),
  );
  const back: (BackPointer | null)[][] = Array.from({ length: target.length + 1 }, () =>
    Array.from({ length: spoken.length + 1 }, () => null),
  );

  for (let i = 1; i <= target.length; i++) {
    costs[i][0] = i;
    back[i][0] = { i: i - 1, j: 0 };
  }
  for (let j = 1; j <= spoken.length; j++) {
    costs[0][j] = j;
    back[0][j] = { i: 0, j: j - 1 };
  }

  for (let i = 1; i <= target.length; i++) {
    for (let j = 1; j <= spoken.length; j++) {
      const sim = wordSimilarity(target[i - 1], spoken[j - 1]);
      const replaceCost = sim >= 0.72 ? 0.35 : 1;
      const choices = [
        { cost: costs[i - 1][j - 1] + replaceCost, prev: { i: i - 1, j: j - 1 } },
        { cost: costs[i - 1][j] + 1, prev: { i: i - 1, j } },
        { cost: costs[i][j - 1] + 1, prev: { i, j: j - 1 } },
      ].sort((a, b) => a.cost - b.cost);
      costs[i][j] = choices[0].cost;
      back[i][j] = choices[0].prev;
    }
  }

  const out: PronunciationWordFeedback[] = [];
  let i = target.length;
  let j = spoken.length;
  while (i > 0 || j > 0) {
    const prev = back[i][j];
    if (!prev) break;
    if (prev.i === i - 1 && prev.j === j - 1) {
      const score = wordSimilarity(target[i - 1], spoken[j - 1]);
      out.push({
        target: target[i - 1],
        spoken: spoken[j - 1],
        status: score >= 0.98 ? "match" : score >= 0.72 ? "close" : "missing",
        score: Math.round(score * 100),
      });
    } else if (prev.i === i - 1) {
      out.push({ target: target[i - 1], status: "missing", score: 0 });
    } else {
      out.push({ spoken: spoken[j - 1], status: "extra", score: 0 });
    }
    i = prev.i;
    j = prev.j;
  }
  return out.reverse();
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function fluencyScore(targetWords: number, spokenWords: number, durationMs?: number, referenceDurationMs?: number): number {
  if (spokenWords === 0) return 0;
  const expectedDuration = referenceDurationMs && referenceDurationMs > 0
    ? referenceDurationMs
    : Math.max(1400, targetWords * 520);
  if (!durationMs || durationMs <= 0) {
    const wordRatio = spokenWords / Math.max(1, targetWords);
    return clampScore(100 - Math.abs(1 - wordRatio) * 45);
  }
  const ratio = durationMs / expectedDuration;
  const penalty = Math.abs(1 - ratio) * 70;
  return clampScore(100 - penalty);
}

function tipsFor(words: PronunciationWordFeedback[], fluency: number): string[] {
  const missing = words.filter((word) => word.status === "missing" && word.target).map((word) => word.target!);
  const close = words.filter((word) => word.status === "close" && word.target).map((word) => word.target!);
  const tips: string[] = [];
  if (missing.length > 0) tips.push(`Missing words: ${missing.slice(0, 4).join(" / ")}`);
  if (close.length > 0) tips.push(`Try again: ${close.slice(0, 4).join(" / ")}`);
  if (fluency >= 82 && tips.length === 0) tips.push("Good rhythm.");
  if (tips.length === 0) tips.push("Nice. Try one more time for a cleaner match.");
  return tips;
}

export function assessPronunciationText(input: {
  targetText: string;
  transcript: string;
  durationMs?: number;
  referenceDurationMs?: number;
}): PronunciationAssessment {
  const target = normalizePronunciationWords(input.targetText);
  const spoken = normalizePronunciationWords(input.transcript);
  const words = alignWords(target, spoken);
  const targetCount = Math.max(1, target.length);
  const matched = words.filter((word) => word.status === "match").length;
  const close = words.filter((word) => word.status === "close").length;
  const missing = words.filter((word) => word.status === "missing" && word.target).length;
  const extras = words.filter((word) => word.status === "extra").length;
  const accuracy = clampScore(((matched + close * 0.65) / targetCount) * 100 - extras * 4);
  const completeness = clampScore(((target.length - missing) / targetCount) * 100);
  const fluency = fluencyScore(target.length, spoken.length, input.durationMs, input.referenceDurationMs);
  const overall = clampScore(accuracy * 0.45 + completeness * 0.35 + fluency * 0.2);

  return {
    targetText: input.targetText,
    transcript: input.transcript.trim(),
    scores: { overall, accuracy, completeness, fluency },
    words,
    tips: tipsFor(words, fluency),
    durationMs: input.durationMs,
  };
}
