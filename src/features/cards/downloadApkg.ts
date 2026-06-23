"use client";

import { getElectronBridge } from "@/platform/electron/bridge";

function browserDownloadApkg(filename: string, base64: string): void {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveApkg(filename: string, base64: string): Promise<string> {
  const desktop = getElectronBridge()?.files?.saveApkg;
  if (desktop) {
    const result = await desktop(filename, base64);
    if (!result.ok) throw new Error(result.error ?? "Could not save the Anki package.");
    return result.path ? `saved to ${result.path}` : "saved to Downloads";
  }
  browserDownloadApkg(filename, base64);
  return "check your downloads";
}
