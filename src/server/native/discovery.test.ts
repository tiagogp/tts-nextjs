import { describe, expect, it } from "vitest";
import { PDFDocument } from "@napi-rs/canvas";
import { dedupeSegments, discoverPdf, parseVtt, segmentText } from "./discovery";

describe("discovery text processing", () => {
  it("segments readable text and drops short fragments", () => {
    expect(segmentText("Hi. This is a complete sentence. Here is another one!").map((x) => x.text))
      .toEqual(["This is a complete sentence.", "Here is another one!"]);
  });

  it("deduplicates normalized transcript lines", () => {
    expect(dedupeSegments([
      { text: "Hello, world!", startMs: 0, endMs: 1000 },
      { text: "hello world", startMs: 1000, endMs: 2000 },
    ])).toHaveLength(1);
  });

  it("parses WebVTT cues, stripping inline word-timing tags", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:01.360 --> 00:00:03.040",
      "<00:00:01.360><c>Hello</c> <00:00:02.000><c>world</c>",
      "",
      "00:01:05.000 --> 00:01:07.500",
      "Second line",
      "",
      "00:02:00.000 --> 00:02:01.000",
      "&nbsp;",
    ].join("\n");
    expect(parseVtt(vtt)).toEqual([
      { text: "Hello world", startMs: 1360, endMs: 3040 },
      { text: "Second line", startMs: 65000, endMs: 67500 },
    ]);
  });

  it("extracts text from a PDF using the Node runtime", async () => {
    const pdf = new PDFDocument({ title: "Fixture" });
    const context = pdf.beginPage(400, 200);
    context.font = "20px Arial";
    context.fillText("A complete sentence for PhraseLoop.", 20, 50);
    pdf.endPage();
    const result = await discoverPdf(pdf.close(), "fixture.pdf");
    expect(result.title).toBe("fixture");
    expect(result.segments[0]?.text).toContain("PhraseLoop");
  });
});
