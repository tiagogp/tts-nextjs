import { describe, expect, it } from "vitest";
import { DEFAULT_UI_LANG, resolveInterfaceLang } from "./config";

describe("resolveInterfaceLang", () => {
  it("uses Portuguese below B1", () => {
    expect(resolveInterfaceLang({ level: "A1", nativeLang: "pt" })).toBe("pt");
    expect(resolveInterfaceLang({ level: "A2", nativeLang: "pt" })).toBe("pt");
  });

  it("uses English from B1 upward", () => {
    expect(resolveInterfaceLang({ level: "B1", nativeLang: "pt" })).toBe(DEFAULT_UI_LANG);
    expect(resolveInterfaceLang({ level: "B2", nativeLang: "pt" })).toBe(DEFAULT_UI_LANG);
    expect(resolveInterfaceLang({ level: "C1", nativeLang: "pt" })).toBe(DEFAULT_UI_LANG);
    expect(resolveInterfaceLang({ level: "C2", nativeLang: "pt" })).toBe(DEFAULT_UI_LANG);
  });

  it("falls back to English when the native language is not Portuguese", () => {
    expect(resolveInterfaceLang({ level: "A1", nativeLang: "xx" })).toBe(DEFAULT_UI_LANG);
    expect(resolveInterfaceLang({ level: "A2", nativeLang: "es" })).toBe(DEFAULT_UI_LANG);
  });
});
