const DEFAULT_TTS_SERVER_URL = "http://localhost:5002";

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getTtsServerUrl(): string {
  const fromEnv = process.env.TTS_SERVER_URL?.trim();
  if (!fromEnv) return DEFAULT_TTS_SERVER_URL;
  return stripTrailingSlashes(fromEnv);
}

