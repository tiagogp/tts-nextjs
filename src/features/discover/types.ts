export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface DiscoverResult {
  sourceId: string;
  title: string;
  segments: TranscriptSegment[];
  /** False for text-only sources (article / PDF): no audio, no native clips. */
  hasAudio: boolean;
}

export type DiscoverSourceKind = "youtube" | "article" | "pdf";
export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
