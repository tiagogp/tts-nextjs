export function micFallbackAvailable(input: { allowTypedFallback: boolean; micDenied: boolean }): boolean {
  return input.allowTypedFallback && input.micDenied;
}
