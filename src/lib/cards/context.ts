/**
 * Situational context normalization.
 *
 * `context` is a free-form situation tag on an ErrorEvent / Card ("work",
 * "ordering at a restaurant", …). Normalizing it before it's stored keeps grouping
 * stable — without this, "Work" and "work " would split a single weakness into two.
 *
 * Kept deliberately gentle: lowercase + trim + collapse internal whitespace. We keep
 * spaces (not hyphens) so the value stays readable as a label, and it's used as both
 * the grouping key and the display string.
 */
export function normalizeContext(value: string | undefined | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().toLowerCase().replace(/\s+/g, " ");
  return cleaned || undefined;
}
