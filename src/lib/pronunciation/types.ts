export type PronunciationWordStatus = "match" | "close" | "missing" | "extra";

export interface PronunciationWordFeedback {
  target?: string;
  spoken?: string;
  status: PronunciationWordStatus;
  score: number;
}

export interface PronunciationScores {
  overall: number;
  accuracy: number;
  completeness: number;
  fluency: number;
}

export interface PronunciationAssessment {
  targetText: string;
  transcript: string;
  scores: PronunciationScores;
  words: PronunciationWordFeedback[];
  tips: string[];
  durationMs?: number;
}

export interface PronunciationAttempt extends PronunciationAssessment {
  id: string;
  createdAt: number;
  targetLang: string;
  cardId?: string;
  lessonId?: string;
  source: "study" | "lesson" | "c1";
}
