export type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

export function isPlainObject(value: unknown): value is JsonObject {
  return isObject(value) && !Array.isArray(value);
}
