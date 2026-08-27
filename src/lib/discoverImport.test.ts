import { describe, expect, it } from "vitest";
import {
  DiscoverImportError,
  classifyYtDlpFailure,
  discoverFailureMessage,
  discoverFailureReason,
  isRetriableDiscoverFailure,
} from "./discoverImport";
import { YOUTUBE_IMPORT_MAX_DURATION_MINUTES } from "./constants";

describe("classifyYtDlpFailure", () => {
  it("classifies the 403 that YouTube returns for perfectly valid short videos", () => {
    // Verbatim stderr from a failed import of a public 13-minute video.
    expect(
      classifyYtDlpFailure("ERROR: unable to download video data: HTTP Error 403: Forbidden\n"),
    ).toBe("blocked");
  });

  it("classifies rate limiting and bot checks as blocked", () => {
    expect(classifyYtDlpFailure("ERROR: HTTP Error 429: Too Many Requests")).toBe("blocked");
    expect(classifyYtDlpFailure("ERROR: Sign in to confirm you're not a bot")).toBe("blocked");
  });

  it("classifies genuinely unavailable videos", () => {
    expect(classifyYtDlpFailure("ERROR: Private video. Sign in if you've been granted access")).toBe("unavailable");
    expect(classifyYtDlpFailure("ERROR: Video unavailable")).toBe("unavailable");
    expect(classifyYtDlpFailure("ERROR: Join this channel to get access to members-only content")).toBe("unavailable");
  });

  it("falls back to unknown rather than guessing a cause", () => {
    expect(classifyYtDlpFailure("ERROR: something nobody has seen before")).toBe("unknown");
  });
});

describe("discoverFailureMessage", () => {
  it("only mentions the duration limit when the video is actually too long", () => {
    expect(discoverFailureMessage("too_long")).toContain(`${YOUTUBE_IMPORT_MAX_DURATION_MINUTES} minutos`);
    for (const reason of ["blocked", "unavailable", "unknown", "yt_dlp_missing"] as const) {
      expect(discoverFailureMessage(reason)).not.toContain(`${YOUTUBE_IMPORT_MAX_DURATION_MINUTES} minutos`);
    }
  });

  it("tells the learner a blocked import is worth retrying", () => {
    expect(discoverFailureMessage("blocked")).toMatch(/tempor/i);
  });
});

describe("discoverFailureReason", () => {
  it("reads the reason off an error that crossed a module boundary", () => {
    expect(discoverFailureReason(new DiscoverImportError("blocked", "403"))).toBe("blocked");
    expect(discoverFailureReason(Object.assign(new Error("x"), { reason: "too_long" }))).toBe("too_long");
  });

  it("ignores errors without a known reason", () => {
    expect(discoverFailureReason(new Error("boom"))).toBeNull();
    expect(discoverFailureReason(Object.assign(new Error("x"), { reason: "nonsense" }))).toBeNull();
    expect(discoverFailureReason(null)).toBeNull();
  });
});

describe("isRetriableDiscoverFailure", () => {
  it("retries transient blocks only", () => {
    expect(isRetriableDiscoverFailure("blocked")).toBe(true);
    expect(isRetriableDiscoverFailure("unavailable")).toBe(false);
    expect(isRetriableDiscoverFailure("too_long")).toBe(false);
  });
});
