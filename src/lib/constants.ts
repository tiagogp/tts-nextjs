/** Max text for one TTS request; keeps Kokoro latency and memory bounded. */
export const MAX_TTS_TEXT_CHARS = 4096;

/** Max uploaded/transcribed audio size accepted by browser-facing routes. */
export const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Max PDF upload size before extraction. */
export const MAX_PDF_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Max JSON body accepted by card-generation routes. */
export const MAX_CARD_JSON_BYTES = 2 * 1024 * 1024;

/** Max JSON body accepted by free-text correction. */
export const MAX_CORRECTION_JSON_BYTES = 256 * 1024;

/** Max JSON body accepted by settings writes/tests. */
export const MAX_SETTINGS_JSON_BYTES = 16 * 1024;

/** Max YouTube source length accepted by Discover import. */
export const YOUTUBE_IMPORT_MAX_DURATION_MINUTES = 30;

/** yt-dlp duration filter value for Discover import. */
export const YOUTUBE_IMPORT_MAX_DURATION_SECONDS = YOUTUBE_IMPORT_MAX_DURATION_MINUTES * 60;

/** Wall-clock timeout for YouTube download + local transcription. */
export const YOUTUBE_IMPORT_TIMEOUT_MS = YOUTUBE_IMPORT_MAX_DURATION_MINUTES * 60_000;

/** Local request default timeout. */
export const LOCAL_REQUEST_TIMEOUT_MS = 120_000;

/** Server-side timeout for full card generation including APKG export. */
export const CARD_GENERATION_TIMEOUT_MS = 390_000;

/** Per-provider call timeout while generating cards. */
export const PROVIDER_CALL_TIMEOUT_MS = 90_000;

/** APKG export timeout after cards are already generated. */
export const APKG_EXPORT_TIMEOUT_MS = 300_000;
