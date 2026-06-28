export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
  /**
   * A self-contained audio clip for this segment (e.g. the bundled demo). When
   * set, playback uses this URL directly instead of seeking within the source's
   * single audio file.
   */
  clipUrl?: string;
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
