import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "@napi-rs/canvas";
import { dedupeSegments, discoverArticle, discoverPdf, parseVtt, segmentText } from "./discovery";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("drops non-speech placeholders from transcript segments", () => {
    expect(dedupeSegments([
      { text: "[BLANK_AUDIO]", startMs: 0, endMs: 1000 },
      { text: "[BLANK_AUDIO] Hello there", startMs: 1000, endMs: 2000 },
    ])).toEqual([
      { text: "Hello there", startMs: 1000, endMs: 2000 },
    ]);
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
      "",
      "00:02:02.000 --> 00:02:03.000",
      "[BLANK_AUDIO]",
    ].join("\n");
    expect(parseVtt(vtt)).toEqual([
      { text: "Hello world", startMs: 1360, endMs: 3040 },
      { text: "Second line", startMs: 65000, endMs: 67500 },
    ]);
  });

  it("extracts readable article text with the lightweight parser", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`
      <!doctype html>
      <html>
        <head><title>Readable fixture</title></head>
        <body>
          <main>
            <article>
              <h1>Readable fixture</h1>
              <p>This is a complete sentence for PhraseLoop article discovery. It has enough detail to be selected as the primary readable content by the parser.</p>
              <p>Another complete sentence keeps the article body substantial and gives the segmenter useful text to return.</p>
            </article>
          </main>
        </body>
      </html>
    `, {
      status: 200,
      headers: { "content-type": "text/html" },
    })));

    const result = await discoverArticle("https://example.com/articles/readable");

    expect(result.title).toBe("Readable fixture");
    expect(result.hasAudio).toBe(false);
    expect(result.segments.map((segment) => segment.text).join(" "))
      .toContain("PhraseLoop article discovery");
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
