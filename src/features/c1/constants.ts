/** A one- or two-paragraph sample is enough for the review model to find real patterns. */
export const MIN_SAMPLE_CHARS = 80;
export const MAX_SAMPLE_CHARS = 2000;

export const MAX_DOMAIN_CHARS = 80;

/** Minimum review count before an error type is shown as a grammar gap — avoids a noisy
 * single-review label (mirrors MIN_REVIEWS in src/lib/srs/analytics.ts). */
export const MIN_REVIEWS_FOR_GRAMMAR_GAP = 3;

export const MAX_GRAMMAR_GAPS_SHOWN = 5;
