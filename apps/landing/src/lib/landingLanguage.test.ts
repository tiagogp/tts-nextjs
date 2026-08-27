import { describe, expect, it } from "vitest";
import {
  normalizeLandingLanguage,
  translateLanding,
} from "./landingLanguage";

describe("landing language", () => {
  it("keeps Portuguese as the default", () => {
    expect(normalizeLandingLanguage(undefined)).toBe("pt");
    expect(normalizeLandingLanguage("pt")).toBe("pt");
  });

  it("restores English when explicitly selected", () => {
    expect(normalizeLandingLanguage("en")).toBe("en");
  });

  it("translates known landing copy and preserves English learning content", () => {
    expect(translateLanding("en", "Lista de espera")).toBe("Waitlist");
    expect(translateLanding("pt", "Lista de espera")).toBe("Lista de espera");
    expect(translateLanding("en", "I agree with this idea.")).toBe(
      "I agree with this idea.",
    );
  });
});
