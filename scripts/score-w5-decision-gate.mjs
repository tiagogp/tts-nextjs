#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TT_FIRST_LOOP_TARGET_MS = 2 * 60 * 1000;
export const REQUIRED_DECISION_ROWS = 10;

const PRODUCT_BEGIN = "<!-- BEGIN:W5_DECISION_RECORD -->";
const PRODUCT_END = "<!-- END:W5_DECISION_RECORD -->";

const GATE_DEFS = [
  ["unaidedCompletion", "Unaided completion", ">= 6/10"],
  ["activation", "Activation / TT first loop", "median < 2m"],
  ["comprehension", "Explain-back", ">= 7/10"],
  ["retention", "Retention", "D+1 >= 40% and D+7 >= 25%"],
  ["differentiation", "Differentiation", ">= 3/10 unprompted"],
  ["paidPain", "Paid pain", ">= 3/10 same non-none pain"],
  ["replacement", "Replacement", ">= 3/10"],
];

const ROUTE_COPY = {
  pass: "Pass: proceed to Phase 4, then Phase 5.",
  frontDoorOnly:
    "Activation/comprehension fail: fix the front door only; re-run 3-5 sessions. Build nothing new.",
  positioning:
    "Differentiation fail: lead with the learner-memory/error-loop story, then re-test the pitch before the product.",
  researchBuild: "No replacement signal: keep PhraseLoop as a research build; do not launch broadly.",
  mixed: "Mixed signal: run 3-5 more sessions before choosing the launch path.",
  pending: "Pending: complete the 10-session ICP decision round before routing the roadmap.",
};

function normalizeHeader(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/d\+1/g, "day1")
    .replace(/d\+7/g, "day7")
    .replace(/7-day/g, "sevenDay")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function splitMarkdownRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function isTemplateRow(cells) {
  return cells.some((cell) => /\bY\/N\b/.test(cell)) || cells[1]?.includes(" / ");
}

export function parseCaptureTable(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /^\|\s*ID\s*\|\s*Segment\s*\|/.test(line));
  if (headerIndex === -1) return [];

  const headers = splitMarkdownRow(lines[headerIndex]).map(normalizeHeader);
  const rows = [];

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim().startsWith("|")) break;
    const cells = splitMarkdownRow(line);
    if (isSeparatorRow(cells) || isTemplateRow(cells)) continue;
    if (cells.length < headers.length) continue;

    const raw = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    const id = raw.id?.trim();
    if (!id) continue;

    rows.push({
      id,
      segment: raw.segment?.trim() || "unknown",
      ttFirstLoopMs: parseDurationMs(raw.ttFirstLoop),
      unaidedLoop: parseYes(raw.unaidedLoop),
      explainBackPass: parseYes(raw.explainBackPass),
      differentiator: raw.differentiator?.trim() || "",
      differentiatorSource: normalizeToken(raw.differentiatorSource),
      replacement7Day: parseYes(raw.sevenDayReplacement),
      paidPain: normalizePaidPain(raw.paidPain),
      day1Return: parseYes(raw.day1Return),
      day7Return: parseYes(raw.day7Return),
    });
  }

  return rows;
}

function parseYes(value) {
  const normalized = normalizeToken(value);
  if (["y", "yes", "sim", "true"].includes(normalized)) return true;
  if (["n", "no", "nao", "não", "false", "declined"].includes(normalized)) return false;
  return null;
}

function normalizeToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizePaidPain(value) {
  const raw = String(value ?? "").trim();
  const normalized = normalizeToken(raw);
  if (!normalized) return "";
  if (normalized.startsWith("other:")) return normalized.replace(/\s+/g, " ");
  if (["managed-cloud", "review-anywhere", "curated-content", "none", "other"].includes(normalized)) {
    return normalized;
  }
  return normalized.replace(/\s+/g, "-");
}

export function parseDurationMs(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (/^\d+(\.\d+)?\s*ms$/.test(raw)) return Number.parseFloat(raw) || null;
  if (/^\d+(\.\d+)?\s*s$/.test(raw)) return Math.round(Number.parseFloat(raw) * 1000);
  if (/^\d+(\.\d+)?\s*m$/.test(raw)) return Math.round(Number.parseFloat(raw) * 60_000);

  const words = raw.match(/(?:(\d+(?:\.\d+)?)\s*m)?\s*(?:(\d+(?:\.\d+)?)\s*s)?/);
  if (words && (words[1] || words[2])) {
    return Math.round((Number.parseFloat(words[1] ?? "0") * 60 + Number.parseFloat(words[2] ?? "0")) * 1000);
  }

  const clock = raw.match(/^(\d+):([0-5]\d)(?::([0-5]\d))?$/);
  if (clock) {
    const first = Number.parseInt(clock[1], 10);
    const second = Number.parseInt(clock[2], 10);
    const third = clock[3] ? Number.parseInt(clock[3], 10) : null;
    return third === null
      ? (first * 60 + second) * 1000
      : (first * 3600 + second * 60 + third) * 1000;
  }

  if (/^\d+(\.\d+)?$/.test(raw)) return Math.round(Number.parseFloat(raw) * 1000);
  return null;
}

function countTrue(rows, key) {
  return rows.reduce((count, row) => count + (row[key] === true ? 1 : 0), 0);
}

function median(values) {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  const low = sorted[mid - 1];
  const high = sorted[mid];
  if (!Number.isFinite(low) || !Number.isFinite(high)) return Number.POSITIVE_INFINITY;
  return (low + high) / 2;
}

function formatCount(count) {
  return `${count}/10`;
}

function formatPercent(count, total) {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return "incomplete";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function topPaidPain(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (!row.paidPain) continue;
    counts.set(row.paidPain, (counts.get(row.paidPain) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    label: sorted[0]?.[0] ?? "",
    count: sorted[0]?.[1] ?? 0,
    noneCount: counts.get("none") ?? 0,
    genericOtherCount: counts.get("other") ?? 0,
    counts: Object.fromEntries(sorted),
  };
}

function isUnpromptedDifferentiator(row) {
  return row.differentiatorSource === "unprompted" && row.differentiator.trim().length > 0;
}

function scoreSegment(rows) {
  const rowCount = rows.length;
  const completions = countTrue(rows, "unaidedLoop");
  const explainBack = countTrue(rows, "explainBackPass");
  const day1 = countTrue(rows, "day1Return");
  const day7 = countTrue(rows, "day7Return");
  const differentiation = rows.filter(isUnpromptedDifferentiator).length;
  const replacement = countTrue(rows, "replacement7Day");
  const segmentMedian = median(rows.map((row) => row.ttFirstLoopMs ?? Number.POSITIVE_INFINITY));
  const score = [
    rowCount >= 3,
    rowCount > 0 && completions / rowCount >= 0.6,
    segmentMedian < TT_FIRST_LOOP_TARGET_MS,
    rowCount > 0 && explainBack / rowCount >= 0.7,
    rowCount > 0 && day1 / rowCount >= 0.4 && day7 / rowCount >= 0.25,
    rowCount > 0 && differentiation / rowCount >= 0.3,
    rowCount > 0 && replacement / rowCount >= 0.3,
  ].filter(Boolean).length;

  return {
    rowCount,
    score,
    completions,
    explainBack,
    day1,
    day7,
    differentiation,
    replacement,
    medianMs: segmentMedian,
  };
}

function pickLaunchSegment(rows) {
  const bySegment = new Map();
  for (const row of rows) {
    const segment = row.segment || "unknown";
    bySegment.set(segment, [...(bySegment.get(segment) ?? []), row]);
  }

  const candidates = [...bySegment.entries()]
    .filter(([segment]) => ["self-study/Anki", "guided beginner"].includes(segment))
    .map(([segment, segmentRows]) => ({ segment, ...scoreSegment(segmentRows) }))
    .sort((a, b) => b.score - a.score || b.rowCount - a.rowCount || a.segment.localeCompare(b.segment));

  const top = candidates[0] ?? null;
  const runnerUp = candidates[1] ?? null;
  const clearWinner =
    top !== null &&
    top.rowCount >= 3 &&
    top.score >= 5 &&
    (!runnerUp || top.score - runnerUp.score >= 2 || runnerUp.rowCount < 3);

  return {
    selected: clearWinner ? top.segment : null,
    reason: clearWinner
      ? `${top.segment} clearly wins (${top.score} signal points across ${top.rowCount} rows).`
      : "No clear segment winner; do not launch to a blend.",
    candidates,
  };
}

export function scoreDecisionRound(rows, waitlistMix = null) {
  const total = rows.length;
  const decisionReady = total >= REQUIRED_DECISION_ROWS;
  const unaided = countTrue(rows, "unaidedLoop");
  const explainBack = countTrue(rows, "explainBackPass");
  const day1 = countTrue(rows, "day1Return");
  const day7 = countTrue(rows, "day7Return");
  const differentiation = rows.filter(isUnpromptedDifferentiator).length;
  const replacement = countTrue(rows, "replacement7Day");
  const roundMedian = median(rows.map((row) => row.ttFirstLoopMs ?? Number.POSITIVE_INFINITY));
  const paid = topPaidPain(rows);
  const paidWinnerIsConcrete =
    Boolean(paid.label) &&
    !["none", "other"].includes(paid.label) &&
    paid.count >= 3 &&
    paid.noneCount < paid.count;

  const gates = {
    unaidedCompletion: {
      passed: unaided >= 6,
      actual: formatCount(unaided),
      detail: `${unaided} unaided loops`,
    },
    activation: {
      passed: roundMedian < TT_FIRST_LOOP_TARGET_MS,
      actual: formatDuration(roundMedian),
      detail: `median TT first loop ${formatDuration(roundMedian)}`,
    },
    comprehension: {
      passed: explainBack >= 7,
      actual: formatCount(explainBack),
      detail: `${explainBack} explain-back passes`,
    },
    retention: {
      passed: day1 / REQUIRED_DECISION_ROWS >= 0.4 && day7 / REQUIRED_DECISION_ROWS >= 0.25,
      actual: `D+1 ${formatPercent(day1, REQUIRED_DECISION_ROWS)} / D+7 ${formatPercent(day7, REQUIRED_DECISION_ROWS)}`,
      detail: `${day1} D+1 returns, ${day7} D+7 returns`,
    },
    differentiation: {
      passed: differentiation >= 3,
      actual: formatCount(differentiation),
      detail: `${differentiation} unprompted differentiators`,
    },
    paidPain: {
      passed: paidWinnerIsConcrete,
      actual: paid.label ? `${paid.label} ${formatCount(paid.count)}` : "none recorded",
      detail:
        paid.noneCount >= paid.count && paid.noneCount > 0
          ? `"none" wins or ties (${paid.noneCount}/10)`
          : paid.genericOtherCount >= 3
            ? "generic other is not a concrete repeated paid pain"
            : paid.label
              ? `${paid.label} is top paid pain`
              : "no paid pain recorded",
    },
    replacement: {
      passed: replacement >= 3,
      actual: formatCount(replacement),
      detail: `${replacement} replacement yeses`,
    },
  };

  const allGatesPass = Object.values(gates).every((gate) => gate.passed);
  const primaryRoute = !decisionReady
    ? "pending"
    : allGatesPass
      ? "pass"
      : !gates.unaidedCompletion.passed || !gates.activation.passed || !gates.comprehension.passed
        ? "frontDoorOnly"
        : !gates.differentiation.passed
          ? "positioning"
          : !gates.replacement.passed
            ? "researchBuild"
            : "mixed";

  return {
    total,
    decisionReady,
    gates,
    allGatesPass: decisionReady && allGatesPass,
    primaryRoute,
    routeText: ROUTE_COPY[primaryRoute],
    billingFrozen: !gates.paidPain.passed,
    paidPainCounts: paid.counts,
    launchSegment: pickLaunchSegment(rows),
    waitlistMix,
  };
}

function loadWaitlistMix(path) {
  if (!path) return null;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const entries = Array.isArray(raw) ? raw : Array.isArray(raw.entries) ? raw.entries : null;
  const platforms = {};
  let signups = 0;

  if (entries) {
    for (const entry of entries) {
      const platform = String(entry.platform ?? "unknown").trim() || "unknown";
      platforms[platform] = (platforms[platform] ?? 0) + 1;
      signups += 1;
    }
  } else if (raw.platforms && typeof raw.platforms === "object") {
    for (const [platform, count] of Object.entries(raw.platforms)) {
      platforms[platform] = Number(count) || 0;
      signups += platforms[platform];
    }
  }

  return {
    visitors: Number.isFinite(raw.visitors) ? raw.visitors : null,
    signups: Number.isFinite(raw.signups) ? raw.signups : signups,
    platforms,
  };
}

function renderWaitlistMix(mix) {
  if (!mix) return "Not recorded yet.";
  const signups = mix.signups ?? Object.values(mix.platforms ?? {}).reduce((sum, count) => sum + count, 0);
  const visitors = mix.visitors ?? null;
  const rows = Object.entries(mix.platforms ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (rows.length === 0) return "No platform data recorded.";
  const platformText = rows
    .map(([platform, count]) => `${platform}: ${count} (${formatPercent(count, signups || 1)})`)
    .join("; ");
  return `${visitors === null ? "Visitors not recorded" : `${visitors} visitors`}; ${signups} signups; ${platformText}.`;
}

export function renderDecisionMarkdown(score, generatedAt = new Date()) {
  const date = generatedAt.toISOString().slice(0, 10);
  const gateRows = GATE_DEFS.map(([key, label, threshold]) => {
    const gate = score.gates[key];
    const result = score.decisionReady ? (gate.passed ? "Pass" : "Fail") : "Pending";
    return `| ${label} | ${threshold} | ${gate.actual} | ${result} | ${gate.detail} |`;
  }).join("\n");

  const paidCounts = Object.entries(score.paidPainCounts)
    .map(([pain, count]) => `${pain}: ${count}`)
    .join("; ") || "none";

  const segmentRows = score.launchSegment.candidates.length
    ? score.launchSegment.candidates
        .map(
          (candidate) =>
            `| ${candidate.segment} | ${candidate.rowCount} | ${candidate.score} | ${formatDuration(candidate.medianMs)} | ${candidate.completions}/${candidate.rowCount} | ${candidate.explainBack}/${candidate.rowCount} | ${candidate.replacement}/${candidate.rowCount} |`,
        )
        .join("\n")
    : "| No segment rows | 0 | 0 | incomplete | 0/0 | 0/0 | 0/0 |";

  return `${PRODUCT_BEGIN}
## W5 Decision Record

Status: ${score.decisionReady ? "scored" : "pending 10 complete ICP rows"}.
Generated: ${date}.
Rows scored: ${score.total}/10.
Primary route: ${score.routeText}
Billing route: ${score.billingFrozen ? "Billing stays frozen until one paid pain wins." : "Paid-pain gate passed; price test can proceed after Phase 4."}
Launch segment: ${score.launchSegment.selected ?? "No explicit launch segment selected yet."} ${score.launchSegment.reason}
Waitlist platform mix: ${renderWaitlistMix(score.waitlistMix)}

| Gate | Threshold | Actual | Result | Note |
| --- | --- | --- | --- | --- |
${gateRows}

Paid-pain counts: ${paidCounts}.

| Segment | Rows | Signal points | Median TT first loop | Unaided | Explain-back | Replacement |
| --- | --- | --- | --- | --- | --- | --- |
${segmentRows}
${PRODUCT_END}`;
}

function replaceProductDecisionRecord(productMarkdown, decisionMarkdown) {
  const begin = productMarkdown.indexOf(PRODUCT_BEGIN);
  const end = productMarkdown.indexOf(PRODUCT_END);
  if (begin !== -1 && end !== -1 && end > begin) {
    return `${productMarkdown.slice(0, begin)}${decisionMarkdown}${productMarkdown.slice(end + PRODUCT_END.length)}`;
  }

  const anchor = "## Guardrails De Launch\n";
  const anchorIndex = productMarkdown.indexOf(anchor);
  if (anchorIndex === -1) return `${productMarkdown.trimEnd()}\n\n${decisionMarkdown}\n`;

  const insertAt = anchorIndex;
  return `${productMarkdown.slice(0, insertAt)}${decisionMarkdown}\n\n${productMarkdown.slice(insertAt)}`;
}

function parseArgs(argv) {
  const args = {
    capturePath: "docs/w5/capture-table.md",
    waitlistPath: null,
    writeProductPath: null,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--waitlist") {
      args.waitlistPath = argv[++i];
    } else if (arg === "--write-product") {
      args.writeProductPath = argv[++i] ?? "docs/product.md";
    } else {
      positional.push(arg);
    }
  }

  if (positional[0]) args.capturePath = positional[0];
  return args;
}

function main() {
  const { capturePath, waitlistPath, writeProductPath } = parseArgs(process.argv.slice(2));
  const markdown = readFileSync(capturePath, "utf8");
  const rows = parseCaptureTable(markdown);
  const waitlistMix = loadWaitlistMix(waitlistPath);
  const score = scoreDecisionRound(rows, waitlistMix);
  const decisionMarkdown = renderDecisionMarkdown(score);

  if (writeProductPath) {
    const productPath = resolve(writeProductPath);
    const productMarkdown = readFileSync(productPath, "utf8");
    writeFileSync(productPath, replaceProductDecisionRecord(productMarkdown, decisionMarkdown));
  }

  console.log(decisionMarkdown);
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : "";
const currentPath = fileURLToPath(import.meta.url);
if (executedPath === currentPath) {
  main();
}
