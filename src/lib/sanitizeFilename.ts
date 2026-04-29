export function sanitizeFilename(text: string): string {
  return (
    text
      .trim()
      .replace(/[/\\:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .slice(0, 80)
      .replace(/\.+$/, "") || "audio"
  );
}

