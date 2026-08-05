import { YOUTUBE_IMPORT_MAX_DURATION_MINUTES } from "./constants";

/**
 * Why a YouTube import failed. The import used to report every failure as
 * "too long or not public", which is a guess — a 403 from YouTube on a short
 * public video got the same copy as a private one. Classify instead, so the
 * message the learner reads matches what actually happened.
 */
export type DiscoverFailureReason =
  | "blocked"
  | "unavailable"
  | "too_long"
  | "yt_dlp_missing"
  | "unknown";

/** Error carrying a classified cause across the native → route → client hop. */
export class DiscoverImportError extends Error {
  readonly reason: DiscoverFailureReason;

  constructor(reason: DiscoverFailureReason, message?: string) {
    super(message ?? reason);
    this.name = "DiscoverImportError";
    this.reason = reason;
  }
}

/** Structural read: `instanceof` is unreliable once the error crosses bundles. */
export function discoverFailureReason(err: unknown): DiscoverFailureReason | null {
  const reason = (err as { reason?: unknown } | null)?.reason;
  return typeof reason === "string" && reason in DISCOVER_FAILURE_MESSAGES
    ? (reason as DiscoverFailureReason)
    : null;
}

const DISCOVER_FAILURE_MESSAGES: Record<DiscoverFailureReason, string> = {
  blocked:
    "O YouTube recusou o download desse vídeo agora (erro 403). Isso costuma ser temporário: tente de novo em alguns minutos ou escolha outro vídeo.",
  unavailable:
    "Esse vídeo não libera download — pode ser privado, restrito por idade ou indisponível na sua região. Tente um vídeo público.",
  too_long: `Esse vídeo passa de ${YOUTUBE_IMPORT_MAX_DURATION_MINUTES} minutos. Tente um vídeo mais curto.`,
  yt_dlp_missing:
    "O componente que baixa vídeos (yt-dlp) não está instalado. Instale o yt-dlp e tente de novo.",
  unknown: "Não consegui importar esse vídeo. Tente outro vídeo público.",
};

export function discoverFailureMessage(reason: DiscoverFailureReason): string {
  return DISCOVER_FAILURE_MESSAGES[reason];
}

/**
 * Map yt-dlp stderr to a reason. yt-dlp runs with `--quiet --no-warnings
 * --no-abort-on-error`, so stderr holds the one ERROR line and nothing else.
 */
export function classifyYtDlpFailure(stderr: string): DiscoverFailureReason {
  const text = stderr.toLowerCase();
  if (/private video|video unavailable|removed by the uploader|members-only|join this channel|not available in your country|sign in to confirm your age|age.restricted/.test(text)) {
    return "unavailable";
  }
  if (/http error 403|forbidden|unable to download video data|http error 429|too many requests|confirm you'?re not a bot/.test(text)) {
    return "blocked";
  }
  return "unknown";
}

/** A `blocked` failure is worth one more attempt with a different player client. */
export function isRetriableDiscoverFailure(reason: DiscoverFailureReason): boolean {
  return reason === "blocked";
}
